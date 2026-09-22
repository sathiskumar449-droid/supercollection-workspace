import { Order, OrderStatus, CourierStatus, SmsStatus, Role, UserSession, ActivityLog, DashboardMetrics, ActionRequiredItem } from "@/types/orderflow";
import { generateMockOrders, CURRENT_USER, INITIAL_COURIERS, STAFF_USERS } from "./mock-data";
import { 
  isSupabaseConfigured, 
  fetchSupabaseOrders, 
  updateSupabaseOrderStatus, 
  updateSupabaseCourierDetails, 
  subscribeToSupabaseRealtime 
} from "./supabase";

const STORAGE_KEY_ORDERS = "orderflow_orders_v1";
const STORAGE_KEY_USER = "orderflow_current_user_v1";

// Global in-memory cache
let globalOrders: Order[] = [];
let globalUser: UserSession = CURRENT_USER;
let globalSearchQuery: string = "";
let globalDateFilter: string = "All";
let globalCustomDate: string = "";
let listeners: Array<() => void> = [];
let supabaseInitialized = false;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

// Initializer
export function initStore(): Order[] {
  const isLive = isSupabaseConfigured();

  if (typeof window === "undefined") {
    if (isLive) {
      return globalOrders;
    }
    if (globalOrders.length === 0) {
      globalOrders = generateMockOrders();
    }
    return globalOrders;
  }

  try {
    // When connected to live Supabase, purge any legacy demo mock data
    if (isLive) {
      const cachedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (cachedOrders) {
        try {
          const parsed = JSON.parse(cachedOrders);
          const hasMock = Array.isArray(parsed) && parsed.some((o: any) =>
            o.id?.startsWith("order-") ||
            (typeof o.orderNumber === "string" && /^OF-9\d{3}$/.test(o.orderNumber))
          );
          if (hasMock) {
            localStorage.removeItem(STORAGE_KEY_ORDERS);
            globalOrders = [];
          } else {
            globalOrders = parsed;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY_ORDERS);
          globalOrders = [];
        }
      } else {
        globalOrders = [];
      }
      localStorage.setItem("orderflow_live_mode", "connected");
    } else {
      const cachedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (cachedOrders) {
        try {
          globalOrders = JSON.parse(cachedOrders);
        } catch {
          globalOrders = generateMockOrders();
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(globalOrders));
        }
      } else {
        globalOrders = generateMockOrders();
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(globalOrders));
      }
    }

    const cachedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (cachedUser) {
      globalUser = JSON.parse(cachedUser);
    }

    // Connect to Supabase when configured
    if (!supabaseInitialized && isLive) {
      supabaseInitialized = true;
      fetchSupabaseOrders().then((remoteOrders) => {
        if (remoteOrders !== null) {
          persistOrders(remoteOrders);
        }
      });

      subscribeToSupabaseRealtime(() => {
        fetchSupabaseOrders().then((remoteOrders) => {
          if (remoteOrders !== null) {
            persistOrders(remoteOrders);
          }
        });
      });

      // Background live sync from WooCommerce website every 30 seconds
      if (typeof window !== "undefined") {
        setInterval(() => {
          fetch("/api/sync/woocommerce", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
              if (data?.syncedCount) {
                fetchSupabaseOrders().then((remoteOrders) => {
                  if (remoteOrders !== null) {
                    persistOrders(remoteOrders);
                  }
                });
              }
            })
            .catch(() => {});
        }, 30000);
      }
    }
  } catch (err) {
    console.error("Error reading from localStorage:", err);
    globalOrders = isLive ? [] : generateMockOrders();
  }

  return globalOrders;
}

function persistOrders(orders: Order[]) {
  globalOrders = [...orders];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    } catch (err) {
      console.error("Error saving to localStorage:", err);
    }
  }
  notifyListeners();
}

function persistUser(user: UserSession) {
  globalUser = { ...user };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (err) {
      console.error("Error saving user to localStorage:", err);
    }
  }
  notifyListeners();
}

// Status workflow order indices for checking backward transitions
export const STATUS_FLOW_ORDER: OrderStatus[] = ["NEW", "CONFIRMED", "PACKING", "PACKED", "DISPATCHED", "COMPLETED", "RETURN"];

export function isBackwardTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
  const currentIndex = STATUS_FLOW_ORDER.indexOf(currentStatus);
  const targetIndex = STATUS_FLOW_ORDER.indexOf(targetStatus);
  return targetIndex < currentIndex;
}

// Store operations
export const orderflowStore = {
  getOrders(): Order[] {
    if (globalOrders.length === 0) {
      return initStore();
    }
    return globalOrders;
  },

  getOrderById(id: string): Order | undefined {
    return globalOrders.find((o) => o.id === id || o.orderNumber === id);
  },

  getCurrentUser(): UserSession {
    return globalUser;
  },

  switchRole(role: Role) {
    const matched = STAFF_USERS.find((u) => u.role === role) || {
      ...globalUser,
      role,
    };
    persistUser(matched);
  },

  resetData() {
    if (isSupabaseConfigured()) {
      localStorage.removeItem(STORAGE_KEY_ORDERS);
      localStorage.setItem("orderflow_live_mode", "connected");
      globalOrders = [];
      notifyListeners();
      this.refreshFromSupabase();
    } else {
      const fresh = generateMockOrders();
      persistOrders(fresh);
    }
  },

  async refreshFromSupabase() {
    if (isSupabaseConfigured()) {
      const remoteOrders = await fetchSupabaseOrders();
      if (remoteOrders !== null) {
        persistOrders(remoteOrders);
      }
    }
  },

  // 1. Update Order Status
  updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    reason?: string
  ): { success: boolean; requiresConfirm?: boolean } {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const oldStatus = order.orderStatus;
    const now = new Date().toISOString();

    const updatedTimeline: ActivityLog[] = [
      ...order.timeline,
      {
        id: `tl-${Date.now()}`,
        orderId: order.id,
        timestamp: now,
        user: globalUser.name,
        role: globalUser.role,
        action: `Order Status Changed: ${oldStatus} → ${newStatus}`,
        details: reason || `Updated by ${globalUser.name}`,
        oldValue: oldStatus,
        newValue: newStatus,
      },
    ];

    const isDispatched = newStatus === "DISPATCHED";
    const isShipped = newStatus === "COMPLETED";
    const newCourierStatus: CourierStatus = isShipped
      ? "SHIPPED"
      : "PENDING";

    const updatedOrder: Order = {
      ...order,
      orderStatus: newStatus,
      updatedAt: now,
      timeline: updatedTimeline,
      confirmedAt: newStatus === "CONFIRMED" && !order.confirmedAt ? now : order.confirmedAt,
      packingStartedAt: newStatus === "PACKING" && !order.packingStartedAt ? now : order.packingStartedAt,
      packedAt: newStatus === "PACKED" && !order.packedAt ? now : order.packedAt,
      dispatchedAt: isDispatched && !order.dispatchedAt ? now : order.dispatchedAt,
      packingStaff: newStatus === "PACKING" ? globalUser.name : order.packingStaff,
      dispatch: {
        ...order.dispatch,
        courierStatus: newCourierStatus,
        dispatchedAt: isDispatched && !order.dispatch.dispatchedAt ? now : order.dispatch.dispatchedAt,
        deliveredAt: isShipped && !order.dispatch.deliveredAt ? now : order.dispatch.deliveredAt,
        courierName: order.dispatch.courierName || "ST Courier",
      },
      sms: {
        ...order.sms,
        status: isShipped ? "SENT" : order.sms.status,
        lastCheckedAt: now,
        deliveredAt: isShipped ? now : order.sms.deliveredAt,
        sentAt: isShipped ? (order.sms.sentAt || now) : order.sms.sentAt,
        providerMessageId: isShipped ? (order.sms.providerMessageId || `P4S-DEL-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, "")}`) : order.sms.providerMessageId,
        responseSnippet: isShipped ? "DELIVRD: Handset acknowledged (Delivered to customer)" : order.sms.responseSnippet,
      },
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseOrderStatus(orderId, newStatus, updatedTimeline[updatedTimeline.length - 1]);
    }

    return { success: true };
  },

  // 2. Start Packing
  startPacking(orderId: string) {
    return this.updateOrderStatus(orderId, "PACKING", "Packing process initiated at packing station");
  },

  // 3. Mark as Packed
  markAsPacked(orderId: string) {
    return this.updateOrderStatus(orderId, "PACKED", "All items verified and sealed in delivery package");
  },

  // 4. Mark as Dispatched
  markAsDispatched(orderId: string, courierId?: string, llrNumber?: string) {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const now = new Date().toISOString();
    const selectedCourier = INITIAL_COURIERS.find((c) => c.id === courierId) || {
      id: order.dispatch.courierId,
      name: order.dispatch.courierName,
    };

    const finalLlr = llrNumber || order.dispatch.llrNumber;

    const updatedOrder: Order = {
      ...order,
      orderStatus: "DISPATCHED",
      dispatchedAt: now,
      updatedAt: now,
      dispatch: {
        ...order.dispatch,
        courierId: selectedCourier.id,
        courierName: selectedCourier.name,
        llrNumber: finalLlr,
        courierStatus: "PENDING",
        dispatchedAt: now,
      },
      timeline: [
        ...order.timeline,
        {
          id: `tl-${Date.now()}`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order Dispatched",
          details: `Dispatched via ${selectedCourier.name}${finalLlr ? ` (LLR: ${finalLlr})` : ""}`,
          oldValue: order.orderStatus,
          newValue: "DISPATCHED",
        },
      ],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    return { success: true };
  },

  // 5. Update Courier Details (LLR, Courier Name, Courier Status)
  updateCourierDetails(
    orderId: string,
    params: {
      courierId?: string;
      courierName?: string;
      llrNumber?: string;
      courierStatus?: CourierStatus;
    }
  ) {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const now = new Date().toISOString();
    const oldCourierStatus = order.dispatch.courierStatus;
    const isShipped = params.courierStatus === "SHIPPED" || params.courierStatus === "DELIVERED";
    const finalCourierStatus: CourierStatus = isShipped ? "SHIPPED" : "PENDING";

    const timelineEntries: ActivityLog[] = [];

    if (params.llrNumber !== undefined && params.llrNumber !== order.dispatch.llrNumber) {
      timelineEntries.push({
        id: `tl-${Date.now()}-llr`,
        orderId: order.id,
        timestamp: now,
        user: globalUser.name,
        role: globalUser.role,
        action: "LLR Number Updated",
        details: `LLR number set to ${params.llrNumber || "(empty)"}`,
        oldValue: order.dispatch.llrNumber,
        newValue: params.llrNumber,
      });
    }

    if (params.courierStatus !== undefined && finalCourierStatus !== oldCourierStatus) {
      if (isShipped) {
        const courierName = params.courierName || order.dispatch.courierName || "ST Courier";
        const currentLlr = params.llrNumber !== undefined ? params.llrNumber : order.dispatch.llrNumber;

        timelineEntries.push({
          id: `tl-${Date.now()}-ship`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order Shipped",
          details: `In transit via ${courierName}${currentLlr ? ` (LLR: ${currentLlr})` : ""}`,
          oldValue: oldCourierStatus,
          newValue: "SHIPPED",
        });

        timelineEntries.push({
          id: `tl-${Date.now() + 500}-sms`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 1000).toISOString(),
          user: "Ping4SMS Gateway",
          role: "SYSTEM" as Role,
          action: "SMS Sent",
          details: `Tracking SMS sent to customer ${order.customer.mobile} via Ping4SMS (MsgID: P4S-SHIP-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, "")})`,
          oldValue: order.sms.status,
          newValue: "SENT",
        });
      } else {
        timelineEntries.push({
          id: `tl-${Date.now()}-cstatus`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Courier Status Changed",
          details: `Courier status changed from ${oldCourierStatus} to PENDING`,
          oldValue: oldCourierStatus,
          newValue: "PENDING",
        });
      }
    }

    const updatedOrder: Order = {
      ...order,
      orderStatus: order.orderStatus, // Keep order status as DISPATCHED (do NOT change to COMPLETED)
      updatedAt: now,
      dispatch: {
        ...order.dispatch,
        llrNumber: params.llrNumber !== undefined ? params.llrNumber : order.dispatch.llrNumber,
        courierStatus: finalCourierStatus,
        courierId: params.courierId || order.dispatch.courierId,
        courierName: params.courierName || order.dispatch.courierName || "ST Courier",
        deliveredAt: isShipped ? now : order.dispatch.deliveredAt,
      },
      sms: {
        ...order.sms,
        status: isShipped ? "SENT" : order.sms.status,
        lastCheckedAt: now,
        deliveredAt: isShipped ? now : order.sms.deliveredAt,
        sentAt: isShipped ? (order.sms.sentAt || now) : order.sms.sentAt,
        providerMessageId: isShipped ? (order.sms.providerMessageId || `P4S-SHIP-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, "")}`) : order.sms.providerMessageId,
        responseSnippet: isShipped ? "DELIVRD: Handset acknowledged (Shipment in transit)" : order.sms.responseSnippet,
      },
      timeline: [...order.timeline, ...timelineEntries],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseCourierDetails(orderId, {
        llrNumber: params.llrNumber,
        courierStatus: finalCourierStatus,
      }, timelineEntries[0]);
    }

    if (typeof window !== "undefined" && isShipped) {
      fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerMobile: order.customer.mobile,
          customerName: order.customer.name,
          courierName: params.courierName || order.dispatch.courierName || "ST Courier",
          llrNumber: params.llrNumber || order.dispatch.llrNumber,
        }),
      }).catch((e) => console.log("SMS API background trigger:", e));
    }

    return { success: true };
  },

  // 6. Refresh / Sync Ping4SMS status (Read-only status sync)
  syncPing4SmsStatus(orderId?: string) {
    const now = new Date().toISOString();
    let updatedCount = 0;

    const newOrders = globalOrders.map((order) => {
      if (orderId && order.id !== orderId) return order;

      // Only refresh dispatched orders that have pending or failed status
      if (order.orderStatus === "DISPATCHED" && order.sms.status === "PENDING") {
        updatedCount++;
        // Simulate real telemetry sync: most resolve to SENT, small fraction remain or fail
        const newSmsStatus: SmsStatus = Math.random() > 0.3 ? "SENT" : "PENDING";
        return {
          ...order,
          updatedAt: now,
          sms: {
            ...order.sms,
            status: newSmsStatus,
            lastCheckedAt: now,
            deliveredAt: newSmsStatus === "SENT" ? now : undefined,
            responseSnippet: newSmsStatus === "SENT" ? "DELIVRD: Handset delivery confirmed via Ping4SMS" : "PENDING: In-transit via carrier route",
          },
          timeline: [
            ...order.timeline,
            {
              id: `tl-${Date.now()}-${order.id}`,
              orderId: order.id,
              timestamp: now,
              user: "Ping4SMS Sync",
              role: "ADMIN" as const,
              action: "Ping4SMS Telemetry Refreshed",
              details: `Synced delivery status: ${newSmsStatus}`,
              oldValue: "PENDING",
              newValue: newSmsStatus,
            },
          ],
        };
      }
      return order;
    });

    persistOrders(newOrders);
    return { success: true, updatedCount };
  },

  // Ingest order from Webhook (WooCommerce or WhatsApp)
  ingestWebhookOrder(payload: Partial<Order> & { source: "WEBSITE" | "WHATSAPP"; externalOrderId: string }): { success: boolean; order?: Order; duplicate?: boolean } {
    const existing = globalOrders.find((o) => o.source === payload.source && o.externalOrderId === payload.externalOrderId);
    if (existing) {
      return { success: false, duplicate: true, order: existing };
    }

    const count = globalOrders.length + 1;
    const now = new Date().toISOString();
    const orderNumber = `OF-${9000 + count}`;

    const newOrder: Order = {
      id: `ord-${count}`,
      orderNumber,
      externalOrderId: payload.externalOrderId,
      source: payload.source,
      customer: payload.customer || {
        id: `cust-new-${count}`,
        name: "New Webhook Customer",
        mobile: "+91 98400 00000",
        address: "Commercial Hub, Main Road",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        totalOrders: 1,
      },
      items: payload.items || [
        {
          id: `it-${count}`,
          productId: "p1",
          productName: "Chanderi Silk Anarkali Kurta Set",
          sku: "OF-CS-ANR-01",
          size: "M",
          quantity: 1,
          unitPrice: 2499,
          subtotal: 2499,
        },
      ],
      totalAmount: payload.totalAmount || 2499,
      paymentStatus: payload.paymentStatus || "PAID",
      orderStatus: "NEW",
      dispatch: {
        courierId: "cour-1",
        courierName: "ST Courier",
        courierStatus: "PENDING",
      },
      sms: {
        status: "PENDING",
        provider: "Ping4SMS",
      },
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          orderId: `ord-${count}`,
          timestamp: now,
          user: payload.source === "WEBSITE" ? "WooCommerce Webhook" : "WhatsApp Chat Box",
          role: "ORDER_STAFF",
          action: "Order Ingested",
          details: `Imported via webhook (Ext ID: ${payload.externalOrderId})`,
        },
      ],
    };

    persistOrders([newOrder, ...globalOrders]);
    return { success: true, order: newOrder };
  },

  // Calculate Dashboard Metrics & Action Required Items
  getMetrics(): DashboardMetrics {
    const orders = globalOrders.length > 0 ? globalOrders : initStore();

    let newOrders = 0;
    let confirmedOrders = 0;
    let packingOrders = 0;
    let packedOrders = 0;
    let dispatchedOrders = 0;
    let smsPending = 0;
    let smsFailed = 0;
    let stCourierMissingLlr = 0;
    let stCourierPendingDelivery = 0;

    orders.forEach((o) => {
      if (o.orderStatus === "NEW") newOrders++;
      if (o.orderStatus === "CONFIRMED" || o.orderStatus === "COMPLETED") confirmedOrders++;
      if (o.orderStatus === "PACKING") packingOrders++;
      if (o.orderStatus === "PACKED") packedOrders++;
      if (o.orderStatus === "DISPATCHED") dispatchedOrders++;

      // SMS counts only for orders that have actually been shipped by courier
      if (o.dispatch.courierStatus === "SHIPPED" || (o.dispatch.courierStatus as string) === "DELIVERED") {
        if (o.sms.status === "PENDING") smsPending++;
        if (o.sms.status === "FAILED") smsFailed++;
      }

      // Courier Missing LLR only for orders that have been marked as DISPATCHED in Packing Station
      if (o.orderStatus === "DISPATCHED" && o.dispatch.courierName === "ST Courier") {
        if (!o.dispatch.llrNumber || o.dispatch.llrNumber.trim() === "") {
          stCourierMissingLlr++;
        }
        if (o.dispatch.courierStatus === "PENDING") {
          stCourierPendingDelivery++;
        }
      }
    });

    const actionItems: ActionRequiredItem[] = [
      {
        id: "act-packing",
        title: `${confirmedOrders} orders waiting for packing`,
        description: "Confirmed orders ready for warehouse pick & pack assignment",
        count: confirmedOrders,
        type: "packing_waiting",
        color: "amber",
        href: "/fulfillment/packing",
      },
      {
        id: "act-dispatch",
        title: `${packedOrders} packed orders waiting for dispatch`,
        description: "Parcels packed and awaiting courier manifest handover",
        count: packedOrders,
        type: "dispatch_waiting",
        color: "purple",
        href: "/fulfillment/dispatch",
      },
      {
        id: "act-st-llr",
        title: `${stCourierMissingLlr} ST Courier orders missing LLR`,
        description: "ST Courier parcels requiring LLR number before dispatch handoff",
        count: stCourierMissingLlr,
        type: "st_courier_missing_llr",
        color: "orange",
        href: "/couriers/st-courier?tab=missing-llr",
      },
      {
        id: "act-sms-pending",
        title: `${smsPending} dispatched orders with SMS pending`,
        description: "Ping4SMS messages queued awaiting telecom network delivery report",
        count: smsPending,
        type: "sms_pending",
        color: "blue",
        href: "/sms?status=PENDING",
      },
      {
        id: "act-sms-failed",
        title: `${smsFailed} SMS delivery failures`,
        description: "Ping4SMS delivery failed due to DND or network unreachable",
        count: smsFailed,
        type: "sms_failed",
        color: "red",
        href: "/sms?status=FAILED",
      },
    ];

    return {
      todayOrders: orders.length,
      newOrders,
      confirmedOrders,
      packingOrders,
      packedOrders,
      dispatchedOrders,
      smsPending,
      smsFailed,
      stCourierMissingLlr,
      stCourierPendingDelivery,
      actionItems,
    };
  },

  getSearchQuery(): string {
    return globalSearchQuery;
  },

  setSearchQuery(query: string) {
    globalSearchQuery = query;
    notifyListeners();
  },

  getDateFilter(): string {
    return globalDateFilter;
  },

  setDateFilter(filter: string) {
    globalDateFilter = filter;
    notifyListeners();
  },

  getCustomDate(): string {
    return globalCustomDate;
  },

  setCustomDate(date: string) {
    globalCustomDate = date;
    notifyListeners();
  },

  subscribe(listener: () => void) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

