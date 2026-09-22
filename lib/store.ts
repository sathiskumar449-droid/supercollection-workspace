import { Order, OrderItem, OrderStatus, OrderSource, CourierStatus, SmsStatus, Role, UserSession, ActivityLog, DashboardMetrics, ActionRequiredItem, Courier } from "@/types/orderflow";
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
const STORAGE_KEY_COURIERS = "orderflow_courier_partners_v1";

// Global in-memory cache
let globalOrders: Order[] = [];
let globalUser: UserSession = CURRENT_USER;
let globalCouriers: Courier[] = [...INITIAL_COURIERS];
let globalSearchQuery: string = "";
let globalDateFilter: string = "All";
let globalCustomDate: string = "";
let listeners: Array<() => void> = [];
let supabaseInitialized = false;

export function generateDispatchId(existingOrders: Order[] = globalOrders): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `DSP-${yy}${mm}${dd}-`;

  let maxSeq = 0;
  existingOrders.forEach((o) => {
    const dispId = o.dispatch?.dispatchId;
    if (dispId && dispId.startsWith(prefix)) {
      const seqStr = dispId.slice(prefix.length);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export function sanitizeOrders(orders: Order[]): Order[] {
  let dispCounter = 1;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayPrefix = `DSP-${yy}${mm}${dd}-`;

  return orders.map((ord) => {
    if (!ord) return ord;

    // 1. Deduplicate items
    if (Array.isArray(ord?.items) && ord.items.length > 1) {
      const map = new Map<string, OrderItem>();
      ord.items.forEach((it) => {
        const k = `${(it.sku || "").trim().toLowerCase()}__${(it.size || "").trim().toLowerCase()}__${(it.productName || "").trim().toLowerCase()}`;
        if (!map.has(k)) map.set(k, it);
      });
      ord.items = Array.from(map.values());
    }

    // 2. Ensure dispatched orders have valid courierPartnerId, courierName, dispatchId, and courierStatus
    if (ord.orderStatus === "DISPATCHED" || ord.dispatchedAt || ord.dispatch?.dispatchedAt) {
      const cName = (ord.dispatch?.courierName || "").toLowerCase();
      let partnerCode = ord.dispatch?.courierPartnerId;

      if (!partnerCode || partnerCode === "UNASSIGNED") {
        if (cName.includes("professional")) {
          partnerCode = "PROFESSIONAL";
        } else if (cName.includes("dtdc")) {
          partnerCode = "DTDC";
        } else {
          partnerCode = "ST_COURIER";
        }
      }

      let resolvedCourierName = ord.dispatch?.courierName;
      if (!resolvedCourierName || resolvedCourierName.toLowerCase().includes("st")) {
        resolvedCourierName = "ST Courier";
      } else if (resolvedCourierName.toLowerCase().includes("prof")) {
        resolvedCourierName = "Professional Courier";
      } else if (resolvedCourierName.toLowerCase().includes("dtdc")) {
        resolvedCourierName = "DTDC";
      }

      let dispatchId = ord.dispatch?.dispatchId;
      if (!dispatchId || dispatchId === "Pending ID" || dispatchId === "pending" || !dispatchId.startsWith("DSP-")) {
        dispatchId = `${todayPrefix}${String(dispCounter++).padStart(3, "0")}`;
      }

      let courierStatus = ord.dispatch?.courierStatus;
      if (!courierStatus || courierStatus === "PENDING" || (courierStatus as string) === "DISPATCHED") {
        courierStatus = "WAITING_FOR_PICKUP";
      }

      ord.orderStatus = "DISPATCHED";
      ord.dispatch = {
        ...ord.dispatch,
        courierPartnerId: partnerCode,
        courierName: resolvedCourierName,
        dispatchId,
        courierStatus,
      };
    }

    return ord;
  });
}

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
      globalOrders = sanitizeOrders(generateMockOrders());
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
            globalOrders = sanitizeOrders(Array.isArray(parsed) ? parsed : []);
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
          globalOrders = sanitizeOrders(JSON.parse(cachedOrders));
        } catch {
          globalOrders = sanitizeOrders(generateMockOrders());
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(globalOrders));
        }
      } else {
        globalOrders = sanitizeOrders(generateMockOrders());
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
  const cleanOrders = sanitizeOrders(orders);
  globalOrders = [...cleanOrders];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(cleanOrders));
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

  switchRole(role: Role, courierPartnerId?: string) {
    const matched = STAFF_USERS.find((u) => {
      if (role === "COURIER") {
        return u.role === "COURIER" && (!courierPartnerId || u.courierPartnerId === courierPartnerId);
      }
      return u.role === role;
    }) || {
      ...globalUser,
      role,
      courierPartnerId: role === "COURIER" ? (courierPartnerId || "ST_COURIER") : undefined,
    };
    persistUser(matched);
  },

  getCourierPartners(): Courier[] {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(STORAGE_KEY_COURIERS);
        if (cached) {
          globalCouriers = JSON.parse(cached);
          return globalCouriers;
        }
      } catch {}
    }
    return globalCouriers;
  },

  addCourierPartner(partner: Omit<Courier, "id">): Courier {
    const id = `cour-${Date.now()}`;
    const newPartner: Courier = {
      id,
      name: partner.name.trim(),
      code: partner.code.trim().toUpperCase().replace(/\s+/g, "_"),
      isStCourier: Boolean(partner.isStCourier),
      trackingUrlPattern: partner.trackingUrlPattern || `https://track.${partner.name.toLowerCase().replace(/\s+/g, "")}.com?llr={llr}`,
      active: true,
    };
    globalCouriers = [...globalCouriers, newPartner];
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_COURIERS, JSON.stringify(globalCouriers));
      } catch {}
    }
    notifyListeners();
    return newPartner;
  },

  updateCourierPartner(id: string, updates: Partial<Courier>): boolean {
    const index = globalCouriers.findIndex((c) => c.id === id);
    if (index === -1) return false;
    globalCouriers[index] = { ...globalCouriers[index], ...updates };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_COURIERS, JSON.stringify(globalCouriers));
      } catch {}
    }
    notifyListeners();
    return true;
  },

  toggleCourierPartner(id: string): boolean {
    const partner = globalCouriers.find((c) => c.id === id);
    if (!partner) return false;
    return this.updateCourierPartner(id, { active: !partner.active });
  },

  getOrdersForUser(user?: UserSession): Order[] {
    const all = this.getOrders();
    const currentUser = user || globalUser;
    if (currentUser.role === "COURIER") {
      const partnerId = currentUser.courierPartnerId || "ST_COURIER";
      return all.filter((o) => o.dispatch?.courierPartnerId === partnerId);
    }
    return all;
  },

  canUserAccessOrder(user: UserSession, order: Order): boolean {
    if (user.role === "COURIER") {
      return order.dispatch?.courierPartnerId === user.courierPartnerId;
    }
    return true;
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
  markAsDispatched(orderId: string, courierPartnerCodeOrId?: string, llrNumber?: string) {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const now = new Date().toISOString();

    // Auto-generate Dispatch ID if not already present
    const dispatchId = order.dispatch.dispatchId || generateDispatchId(globalOrders);

    // Look up courier partner
    const couriersList = this.getCourierPartners();
    let selectedCourier = couriersList.find(
      (c) => c.code === courierPartnerCodeOrId || c.id === courierPartnerCodeOrId || c.name === courierPartnerCodeOrId
    );
    if (!selectedCourier) {
      if (courierPartnerCodeOrId === "unassigned") {
        selectedCourier = {
          id: "unassigned",
          name: "Unassigned",
          code: "UNASSIGNED",
          isStCourier: false,
          active: true,
        };
      } else {
        selectedCourier = couriersList.find((c) => c.isStCourier) || couriersList[0] || {
          id: "cour-1",
          name: "ST Courier",
          code: "ST_COURIER",
          isStCourier: true,
          active: true,
        };
      }
    }

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
        details: "Sent to courier pickup",
        oldValue: order.orderStatus,
        newValue: "DISPATCHED",
      });
    }

    if (!order.timeline.some((t) => t.action === "Courier pickup waiting")) {
      newEntries.push({
        id: `tl-${Date.now() + 100}-waitship`,
        orderId: order.id,
        timestamp: new Date(Date.now() + 100).toISOString(),
        user: "Courier Hub",
        role: "DISPATCH_STAFF",
        action: "Courier pickup waiting",
        details: `Courier: ${selectedCourier.name}`,
      });
    }

    const updatedOrder: Order = {
      ...order,
      orderStatus: "DISPATCHED",
      dispatchedAt: now,
      updatedAt: now,
      dispatch: {
        ...order.dispatch,
        dispatchId,
        courierId: selectedCourier.id,
        courierName: selectedCourier.name,
        courierPartnerId: selectedCourier.code === "UNASSIGNED" ? undefined : selectedCourier.code,
        llrNumber: finalLlr,
        courierStatus: "WAITING_FOR_PICKUP",
        dispatchedAt: now,
      },
      timeline: [...order.timeline, ...newEntries],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      newEntries.forEach((entry) => {
        updateSupabaseOrderStatus(orderId, "DISPATCHED", entry);
      });
      updateSupabaseCourierDetails(orderId, {
        dispatchId,
        courierId: selectedCourier.id,
        courierPartnerId: selectedCourier.code === "UNASSIGNED" ? undefined : selectedCourier.code,
        llrNumber: finalLlr,
        courierStatus: "WAITING_FOR_PICKUP",
      });
    }

    return { success: true, dispatchId };
  },

  // 5. Update Courier Details (Pickup Phone, LLR, Courier Name, Courier Status)
  updateCourierDetails(
    orderId: string,
    params: {
      courierId?: string;
      courierName?: string;
      courierPartnerId?: string;
      dispatchId?: string;
      llrNumber?: string;
      pickupPhone?: string;
      courierStatus?: CourierStatus;
    }
  ) {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const now = new Date().toISOString();
    const oldCourierStatus = order.dispatch.courierStatus;

    // Normalize courier status (support legacy SHIPPED as PICKED_UP)
    let finalCourierStatus: CourierStatus = order.dispatch.courierStatus;
    if (params.courierStatus) {
      if (params.courierStatus === "SHIPPED") {
        finalCourierStatus = "PICKED_UP";
      } else if (params.courierStatus === "PENDING") {
        finalCourierStatus = "WAITING_FOR_PICKUP";
      } else {
        finalCourierStatus = params.courierStatus;
      }
    }

    const courierName = params.courierName || order.dispatch.courierName || "ST Courier";
    const timelineEntries: ActivityLog[] = [];

    // Pickup Phone entry (read-only customer phone is preserved; pickup phone is strictly separate)
    if (params.pickupPhone !== undefined && params.pickupPhone !== order.dispatch.pickupPhone) {
      const isNew = !order.dispatch.pickupPhone;
      timelineEntries.push({
        id: `tl-${Date.now()}-phone`,
        orderId: order.id,
        timestamp: now,
        user: globalUser.name,
        role: globalUser.role,
        action: isNew ? "Pickup phone recorded" : "Pickup phone updated",
        details: `Courier pickup person: ${params.pickupPhone}`,
        oldValue: order.dispatch.pickupPhone,
        newValue: params.pickupPhone,
      });
    }

    // LLR number entry
    if (params.llrNumber !== undefined && params.llrNumber !== order.dispatch.llrNumber) {
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

    // Courier status transitions: WAITING_FOR_PICKUP -> PICKED_UP -> DELIVERED
    if (params.courierStatus !== undefined && finalCourierStatus !== oldCourierStatus) {
      if (finalCourierStatus === "PICKED_UP") {
        if (!order.timeline.some((t) => t.action === "Courier picked up")) {
          timelineEntries.push({
            id: `tl-${Date.now()}-pickedup`,
            orderId: order.id,
            timestamp: now,
            user: globalUser.name || courierName,
            role: "DISPATCH_STAFF",
            action: "Courier picked up",
            details: `LLR: ${params.llrNumber || order.dispatch.llrNumber || "N/A"}${courierName ? ` · ${courierName}` : ""}`,
            oldValue: oldCourierStatus,
            newValue: "PICKED_UP",
          });
        }

        // SMS notification triggered automatically after pickup
        if (!order.timeline.some((t) => t.action === "SMS sent")) {
          timelineEntries.push({
            id: `tl-${Date.now() + 500}-sms`,
            orderId: order.id,
            timestamp: new Date(Date.now() + 500).toISOString(),
            user: "Ping4SMS",
            role: "SYSTEM",
            action: "SMS sent",
            details: "Customer notification sent",
            oldValue: order.sms.status,
            newValue: "SENT",
          });
        }
      } else if (finalCourierStatus === "DELIVERED") {
        if (!order.timeline.some((t) => t.action === "Delivered")) {
          timelineEntries.push({
            id: `tl-${Date.now()}-deliv`,
            orderId: order.id,
            timestamp: now,
            user: globalUser.name || courierName,
            role: "DISPATCH_STAFF",
            action: "Delivered",
            details: "Parcel delivered to customer",
            oldValue: oldCourierStatus,
            newValue: "DELIVERED",
          });
        }
      } else if (finalCourierStatus === "WAITING_FOR_PICKUP") {
        timelineEntries.push({
          id: `tl-${Date.now()}-wait`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Courier pickup waiting",
          details: `Courier: ${courierName}`,
          oldValue: oldCourierStatus,
          newValue: "WAITING_FOR_PICKUP",
        });
      }
    }

    const isPickedUpOrDelivered = finalCourierStatus === "PICKED_UP" || finalCourierStatus === "DELIVERED";

    const updatedOrder: Order = {
      ...order,
      orderStatus: order.orderStatus,
      updatedAt: now,
      dispatch: {
        ...order.dispatch,
        dispatchId: params.dispatchId !== undefined ? params.dispatchId : order.dispatch.dispatchId,
        pickupPhone: params.pickupPhone !== undefined ? params.pickupPhone : order.dispatch.pickupPhone,
        llrNumber: params.llrNumber !== undefined ? params.llrNumber : order.dispatch.llrNumber,
        courierStatus: finalCourierStatus,
        courierId: params.courierId || order.dispatch.courierId,
        courierName: params.courierName || order.dispatch.courierName,
        courierPartnerId: params.courierPartnerId !== undefined ? params.courierPartnerId : order.dispatch.courierPartnerId,
        pickedUpAt: finalCourierStatus === "PICKED_UP" ? (order.dispatch.pickedUpAt || now) : order.dispatch.pickedUpAt,
        deliveredAt: finalCourierStatus === "DELIVERED" ? (order.dispatch.deliveredAt || now) : order.dispatch.deliveredAt,
      },
      sms: {
        ...order.sms,
        status: isPickedUpOrDelivered ? "SENT" : order.sms.status,
        lastCheckedAt: now,
        deliveredAt: isPickedUpOrDelivered ? now : order.sms.deliveredAt,
        sentAt: isPickedUpOrDelivered ? (order.sms.sentAt || now) : order.sms.sentAt,
        providerMessageId: isPickedUpOrDelivered ? (order.sms.providerMessageId || `P4S-SHIP-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, "")}`) : order.sms.providerMessageId,
        responseSnippet: isPickedUpOrDelivered ? "DELIVRD: Handset acknowledged (Shipment in transit)" : order.sms.responseSnippet,
      },
      timeline: [...order.timeline, ...timelineEntries],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseCourierDetails(orderId, {
        dispatchId: updatedOrder.dispatch.dispatchId,
        pickupPhone: updatedOrder.dispatch.pickupPhone,
        courierPartnerId: updatedOrder.dispatch.courierPartnerId,
        llrNumber: params.llrNumber,
        courierStatus: finalCourierStatus,
      }, timelineEntries[0]);
    }

    if (typeof window !== "undefined" && isPickedUpOrDelivered) {
      fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerMobile: order.customer.mobile,
          customerName: order.customer.name,
          courierName,
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

