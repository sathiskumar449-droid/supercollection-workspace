import { Order, OrderStatus, OrderSource, CourierStatus, SmsStatus, Role, UserSession, ActivityLog, DashboardMetrics, ActionRequiredItem } from "@/types/orderflow";
import { generateMockOrders, CURRENT_USER, INITIAL_COURIERS, STAFF_USERS } from "./mock-data";
import { matchesDateFilter } from "./utils";
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
      try {
        const parsed = JSON.parse(cachedUser);
        if (parsed?.name && parsed.name.includes("Priya")) {
          parsed.name = "Admin";
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(parsed));
        }
        globalUser = parsed;
      } catch {
        globalUser = CURRENT_USER;
      }
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
    if (oldStatus === newStatus && !reason) return { success: true };
    const now = new Date().toISOString();

    const newEntries: ActivityLog[] = [];

    if (newStatus === "CONFIRMED") {
      if (!order.timeline.some((t) => t.action === "Order processing")) {
        newEntries.push({
          id: `tl-${Date.now()}-proc`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order processing",
          details: "Order is being processed",
          oldValue: oldStatus,
          newValue: newStatus,
        });
      }
    } else if (newStatus === "PACKING") {
      if (!order.timeline.some((t) => t.action === "Packing started")) {
        newEntries.push({
          id: `tl-${Date.now()}-packstart`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Packing started",
          details: "Packing started",
          oldValue: oldStatus,
          newValue: newStatus,
        });
      }
    } else if (newStatus === "PACKED") {
      if (!order.timeline.some((t) => t.action === "Order packed")) {
        newEntries.push({
          id: `tl-${Date.now()}-packed`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order packed",
          details: "Order packed successfully",
          oldValue: oldStatus,
          newValue: newStatus,
        });
      }
    } else if (newStatus === "DISPATCHED") {
      if (!order.timeline.some((t) => t.action === "Order dispatched")) {
        newEntries.push({
          id: `tl-${Date.now()}-disp`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order dispatched",
          details: "Order dispatched",
          oldValue: oldStatus,
          newValue: newStatus,
        });
      }
      if (!order.timeline.some((t) => t.action === "Waiting for shipment")) {
        const courierName = order.dispatch.courierName || "ST Courier";
        newEntries.push({
          id: `tl-${Date.now() + 100}-waitship`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 100).toISOString(),
          user: "Courier Hub",
          role: "DISPATCH_STAFF",
          action: "Waiting for shipment",
          details: `Order moved to ${courierName}`,
        });
      }
    } else if (newStatus === "COMPLETED") {
      if (!order.timeline.some((t) => t.action === "Order completed")) {
        newEntries.push({
          id: `tl-${Date.now()}-compl`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order completed",
          details: "Order completed in WooCommerce",
          oldValue: oldStatus,
          newValue: newStatus,
        });
      }
      if (!order.timeline.some((t) => t.action === "Waiting for packing")) {
        newEntries.push({
          id: `tl-${Date.now() + 100}-waitpack`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 100).toISOString(),
          user: "Packing Station",
          role: "PACKING_STAFF",
          action: "Waiting for packing",
          details: "Order is ready for packing",
        });
      }
    }

    const updatedTimeline: ActivityLog[] = [...order.timeline, ...newEntries];

    const isDispatched = newStatus === "DISPATCHED";

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
        dispatchedAt: isDispatched && !order.dispatch.dispatchedAt ? now : order.dispatch.dispatchedAt,
        courierName: order.dispatch.courierName || "ST Courier",
      },
      sms: {
        ...order.sms,
      },
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured() && newEntries.length > 0) {
      newEntries.forEach((entry) => {
        updateSupabaseOrderStatus(orderId, newStatus, entry);
      });
    }

    return { success: true };
  },

  // 2. Start Packing
  startPacking(orderId: string) {
    return this.updateOrderStatus(orderId, "PACKING", "Packing started");
  },

  // 3. Mark as Packed
  markAsPacked(orderId: string) {
    return this.updateOrderStatus(orderId, "PACKED", "Order packed successfully");
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
    const newEntries: ActivityLog[] = [];

    if (!order.timeline.some((t) => t.action === "Order dispatched")) {
      newEntries.push({
        id: `tl-${Date.now()}-disp`,
        orderId: order.id,
        timestamp: now,
        user: globalUser.name,
        role: globalUser.role,
        action: "Order dispatched",
        details: "Order dispatched",
        oldValue: order.orderStatus,
        newValue: "DISPATCHED",
      });
    }

    if (!order.timeline.some((t) => t.action === "Waiting for shipment")) {
      newEntries.push({
        id: `tl-${Date.now() + 100}-waitship`,
        orderId: order.id,
        timestamp: new Date(Date.now() + 100).toISOString(),
        user: "Courier Hub",
        role: "DISPATCH_STAFF",
        action: "Waiting for shipment",
        details: `Order moved to ${selectedCourier.name}`,
      });
    }

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
      timeline: [...order.timeline, ...newEntries],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured() && newEntries.length > 0) {
      newEntries.forEach((entry) => {
        updateSupabaseOrderStatus(orderId, "DISPATCHED", entry);
      });
    }

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
      const courierName = params.courierName || order.dispatch.courierName || "ST Courier";
      const isNew = !order.dispatch.llrNumber;
      timelineEntries.push({
        id: `tl-${Date.now()}-llr`,
        orderId: order.id,
        timestamp: now,
        user: globalUser.name,
        role: globalUser.role,
        action: isNew ? "LLR added" : "LLR updated",
        details: `${courierName} · LLR: ${params.llrNumber || ""}`,
        oldValue: order.dispatch.llrNumber,
        newValue: params.llrNumber,
      });
    }

    if (params.courierStatus !== undefined && finalCourierStatus !== oldCourierStatus) {
      const courierName = params.courierName || order.dispatch.courierName || "ST Courier";

      if (isShipped) {
        if (!order.timeline.some((t) => t.action === "Shipped")) {
          timelineEntries.push({
            id: `tl-${Date.now()}-ship`,
            orderId: order.id,
            timestamp: now,
            user: courierName,
            role: "DISPATCH_STAFF",
            action: "Shipped",
            details: `${courierName} marked the order as shipped`,
            oldValue: oldCourierStatus,
            newValue: "SHIPPED",
          });
        }

        if (!order.timeline.some((t) => t.action === "Waiting for SMS")) {
          timelineEntries.push({
            id: `tl-${Date.now() + 100}-waitsms`,
            orderId: order.id,
            timestamp: new Date(Date.now() + 100).toISOString(),
            user: "Ping4SMS",
            role: "SYSTEM",
            action: "Waiting for SMS",
            details: "Customer notification pending",
          });
        }

        if (!order.timeline.some((t) => t.action === "SMS sent")) {
          timelineEntries.push({
            id: `tl-${Date.now() + 500}-sms`,
            orderId: order.id,
            timestamp: new Date(Date.now() + 1000).toISOString(),
            user: "Ping4SMS",
            role: "SYSTEM" as Role,
            action: "SMS sent",
            details: "Customer notification sent",
            oldValue: order.sms.status,
            newValue: "SENT",
          });
        }
      } else {
        timelineEntries.push({
          id: `tl-${Date.now()}-cstatus`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Courier status updated",
          details: "Status: Pending",
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
  syncPing4SmsStatus(orderIds?: string | string[]) {
    const now = new Date().toISOString();
    let updatedCount = 0;
    const targetIds = Array.isArray(orderIds) ? orderIds : orderIds ? [orderIds] : null;

    const newOrders = globalOrders.map((order) => {
      if (targetIds && !targetIds.includes(order.id)) return order;

      // Only refresh dispatched orders that have pending or failed status
      if (order.orderStatus === "DISPATCHED" && (order.sms.status === "PENDING" || order.sms.status === "FAILED")) {
        updatedCount++;
        // Simulate real telemetry sync: most resolve to SENT, small fraction remain or fail
        const newSmsStatus: SmsStatus = Math.random() > 0.15 ? "SENT" : "PENDING";
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
              oldValue: order.sms.status,
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

  // 7. Bulk Update Order Status
  bulkUpdateOrderStatus(orderIds: string[], newStatus: OrderStatus, reason?: string): { successCount: number; failCount: number } {
    let successCount = 0;
    let failCount = 0;
    for (const id of orderIds) {
      const res = this.updateOrderStatus(id, newStatus, reason || `Bulk status update to ${newStatus}`);
      if (res.success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    return { successCount, failCount };
  },

  // 8. Bulk Update Courier Status
  bulkUpdateCourierStatus(orderIds: string[], targetStatus: CourierStatus): { successCount: number } {
    let successCount = 0;
    for (const id of orderIds) {
      const res = this.updateCourierDetails(id, { courierStatus: targetStatus });
      if (res.success) {
        successCount++;
      }
    }
    return { successCount };
  },

  // Ingest order from Webhook (WooCommerce or WhatsApp)
  ingestWebhookOrder(payload: Partial<Order> & { source: OrderSource; externalOrderId: string }): { success: boolean; order?: Order; duplicate?: boolean } {
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
    const rawOrders = globalOrders.length > 0 ? globalOrders : initStore();
    const orders = rawOrders.filter((o) => matchesDateFilter(o.createdAt, globalDateFilter, globalCustomDate));

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

