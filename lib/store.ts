import { 
  Order, 
  OrderItem, 
  OrderStatus, 
  OrderSource, 
  CourierStatus, 
  SmsStatus, 
  Role, 
  UserSession, 
  ActivityLog, 
  DashboardMetrics, 
  ActionRequiredItem, 
  Courier,
  ReturnCase,
  ReturnItem,
  ReturnStatus,
  ReturnType,
  ReturnReason,
  RefundStatus,
  RefundMethod,
  QcCondition,
  QcResult,
  InventoryDisposition,
  ReturnMetrics,
  ReturnReplacement,
  ReturnTimelineEvent,
  ReturnQc,
  ReturnRefund
} from "@/types/orderflow";
import { generateMockOrders, generateMockReturns, CURRENT_USER, INITIAL_COURIERS, STAFF_USERS } from "./mock-data";
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
const STORAGE_KEY_RETURNS = "orderflow_returns_v1";

// Global in-memory cache
let globalOrders: Order[] = [];
let globalReturns: ReturnCase[] = [];
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

export function generateReturnId(existingReturns: ReturnCase[] = globalReturns): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `RTN-${yy}${mm}${dd}-`;

  let maxSeq = 0;
  existingReturns.forEach((r) => {
    if (r.returnId && r.returnId.startsWith(prefix)) {
      const seqStr = r.returnId.slice(prefix.length);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export function generateReplacementId(existingReturns: ReturnCase[] = globalReturns): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `REP-${yy}${mm}${dd}-`;

  let maxSeq = 0;
  existingReturns.forEach((r) => {
    const repId = r.replacement?.replacementId;
    if (repId && repId.startsWith(prefix)) {
      const seqStr = repId.slice(prefix.length);
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

    // 2. Ensure actively dispatched orders have valid courierPartnerId, courierName, dispatchId, and courierStatus
    if (ord.orderStatus === "DISPATCHED") {
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
    // Initialize Returns Cache
    const cachedReturns = localStorage.getItem(STORAGE_KEY_RETURNS);
    if (cachedReturns) {
      try {
        globalReturns = JSON.parse(cachedReturns);
      } catch {
        globalReturns = generateMockReturns(globalOrders);
        localStorage.setItem(STORAGE_KEY_RETURNS, JSON.stringify(globalReturns));
      }
    } else {
      globalReturns = generateMockReturns(globalOrders);
      localStorage.setItem(STORAGE_KEY_RETURNS, JSON.stringify(globalReturns));
    }
  } catch (err) {
    console.error("Error reading from localStorage:", err);
    globalOrders = isLive ? [] : generateMockOrders();
    globalReturns = isLive ? [] : generateMockReturns(globalOrders);
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

function persistReturns(returns: ReturnCase[]) {
  globalReturns = [...returns];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_RETURNS, JSON.stringify(returns));
    } catch (err) {
      console.error("Error saving returns to localStorage:", err);
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
      localStorage.removeItem(STORAGE_KEY_RETURNS);
      localStorage.setItem("orderflow_live_mode", "connected");
      globalOrders = [];
      globalReturns = [];
      notifyListeners();
      this.refreshFromSupabase();
    } else {
      const fresh = generateMockOrders();
      persistOrders(fresh);
      const freshReturns = generateMockReturns(fresh);
      persistReturns(freshReturns);
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
        const courierName = order.dispatch.courierName || "Courier";
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
    } else if (newStatus === "RETURN") {
      newEntries.push({
        id: `tl-${Date.now()}-return`,
        orderId: order.id,
        timestamp: now,
        user: globalUser.name,
        role: globalUser.role,
        action: "Return Initiated",
        details: reason || "Return case created from Packing Station",
        oldValue: oldStatus,
        newValue: newStatus,
      });
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
        courierName: order.dispatch.courierName,
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

    const courierName = params.courierName !== undefined ? params.courierName : order.dispatch.courierName;
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
            user: globalUser.name || courierName || "Dispatch Staff",
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
            user: globalUser.name || courierName || "Dispatch Staff",
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
          details: courierName ? `Courier: ${courierName}` : "Courier pickup waiting",
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

    // Calculate Return Metrics for Dashboard & Attention items
    const rawReturns = globalReturns.length > 0 ? globalReturns : (initStore(), globalReturns);
    const filteredReturns = rawReturns.filter((r) => matchesDateFilter(r.createdAt, globalDateFilter, globalCustomDate));

    let returnRequested = 0;
    let awaitingReturn = 0;
    let receivedQcPending = 0;
    let refundPending = 0;
    let replacementPending = 0;

    filteredReturns.forEach((r) => {
      if (r.status === "Return Requested") returnRequested++;
      if (r.status === "Awaiting Return" || r.status === "Return Approved") awaitingReturn++;
      if (r.status === "Return Received" || r.status === "QC Pending") receivedQcPending++;
      if (r.status === "Refund Pending") refundPending++;
      if (r.status === "Replacement Pending") replacementPending++;
    });

    const activeReturnsCount = returnRequested + awaitingReturn + receivedQcPending + refundPending + replacementPending;

    const returnMetrics: ReturnMetrics = {
      totalReturns: filteredReturns.length,
      returnRequested,
      awaitingReturn,
      receivedQcPending,
      refundPending,
      replacementPending,
      activeReturnsCount,
    };

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

    // Dynamic Return Attention Alerts (Requirement 23)
    if (awaitingReturn > 0) {
      actionItems.push({
        id: "act-rtn-awaiting",
        title: `${awaitingReturn} ${awaitingReturn === 1 ? "return" : "returns"} awaiting physical receipt`,
        description: "Return parcels expected at warehouse loading dock",
        count: awaitingReturn,
        type: "return_awaiting_receipt",
        color: "amber",
        href: "/returns?status=Awaiting+Return",
      });
    }

    if (receivedQcPending > 0) {
      actionItems.push({
        id: "act-rtn-qc",
        title: `${receivedQcPending} ${receivedQcPending === 1 ? "return" : "returns"} pending QC`,
        description: "Received return parcels waiting for condition and tag inspection",
        count: receivedQcPending,
        type: "return_qc_pending",
        color: "orange",
        href: "/returns?status=QC+Pending",
      });
    }

    if (refundPending > 0) {
      actionItems.push({
        id: "act-rtn-refund",
        title: `${refundPending} ${refundPending === 1 ? "refund" : "refunds"} pending`,
        description: "Approved return claims awaiting payment disbursement",
        count: refundPending,
        type: "return_refund_pending",
        color: "rose",
        href: "/returns?status=Refund+Pending",
      });
    }

    if (replacementPending > 0) {
      actionItems.push({
        id: "act-rtn-replacement",
        title: `${replacementPending} ${replacementPending === 1 ? "replacement" : "replacements"} waiting for packing`,
        description: "Approved replacement exchanges queued for warehouse packing",
        count: replacementPending,
        type: "return_replacement_pending",
        color: "purple",
        href: "/returns?status=Replacement+Pending",
      });
    }

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
      returnMetrics,
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

  // ============================================================================
  // RETURN MANAGEMENT STORE OPERATIONS
  // ============================================================================

  getReturns(): ReturnCase[] {
    if (globalReturns.length === 0) {
      initStore();
    }
    return globalReturns;
  },

  getReturnById(id: string): ReturnCase | undefined {
    return globalReturns.find((r) => r.id === id || r.returnId === id);
  },

  getReturnsByOrderId(orderId: string): ReturnCase[] {
    if (globalReturns.length === 0) {
      initStore();
    }
    return globalReturns.filter((r) => r.orderId === orderId || r.orderNumber === orderId);
  },

  getActiveReturnsCount(): number {
    const activeStatuses: ReturnStatus[] = [
      "Return Requested",
      "Return Approved",
      "Awaiting Return",
      "Return Received",
      "QC Pending",
      "Refund Pending",
      "Replacement Pending",
    ];
    return globalReturns.filter((r) => activeStatuses.includes(r.status)).length;
  },

  getReturnMetrics(dateFilter = globalDateFilter, customDate = globalCustomDate): ReturnMetrics {
    const returns = this.getReturns().filter((r) => matchesDateFilter(r.createdAt, dateFilter, customDate));

    let returnRequested = 0;
    let awaitingReturn = 0;
    let receivedQcPending = 0;
    let refundPending = 0;
    let replacementPending = 0;

    returns.forEach((r) => {
      if (r.status === "Return Requested") returnRequested++;
      if (r.status === "Awaiting Return" || r.status === "Return Approved") awaitingReturn++;
      if (r.status === "Return Received" || r.status === "QC Pending") receivedQcPending++;
      if (r.status === "Refund Pending") refundPending++;
      if (r.status === "Replacement Pending") replacementPending++;
    });

    const activeReturnsCount = returnRequested + awaitingReturn + receivedQcPending + refundPending + replacementPending;

    return {
      totalReturns: returns.length,
      returnRequested,
      awaitingReturn,
      receivedQcPending,
      refundPending,
      replacementPending,
      activeReturnsCount,
    };
  },

  createReturnCase(params: {
    orderId: string;
    returnType: ReturnType;
    reason: ReturnReason;
    customerNote?: string;
    items: Array<{
      orderItemId?: string;
      productName: string;
      sku?: string;
      color?: string;
      size: string;
      purchasedQuantity: number;
      returnQuantity: number;
      unitPrice: number;
    }>;
    discountAdjustment?: number;
    shippingAdjustment?: number;
    customAmountOverride?: number;
  }): { success: boolean; returnCase?: ReturnCase; error?: string } {
    const order = this.getOrderById(params.orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Existing returns for this order
    const existingReturns = this.getReturnsByOrderId(order.id);

    // Business Rule 1 & 2: Validate each item quantity against remaining unreturned quantity
    const returnItems: ReturnItem[] = [];
    let totalRequestedQty = 0;
    let itemsAmount = 0;

    for (const item of params.items) {
      if (item.returnQuantity <= 0) continue;

      // Calculate previously returned quantity for this specific item/SKU/name
      let previouslyReturnedQty = 0;
      existingReturns.forEach((ret) => {
        if (ret.status !== "Rejected" && ret.status !== "Cancelled") {
          ret.items.forEach((ri) => {
            const matches = (item.orderItemId && ri.orderItemId === item.orderItemId) ||
              (ri.productName.toLowerCase() === item.productName.toLowerCase() && ri.size === item.size);
            if (matches) {
              previouslyReturnedQty += ri.requestedQuantity;
            }
          });
        }
      });

      const availableQty = Math.max(0, item.purchasedQuantity - previouslyReturnedQty);
      if (item.returnQuantity > availableQty) {
        return {
          success: false,
          error: `Cannot return ${item.returnQuantity} of "${item.productName}". Only ${availableQty} remaining returnable.`,
        };
      }

      const itemReturnAmount = item.returnQuantity * item.unitPrice;
      totalRequestedQty += item.returnQuantity;
      itemsAmount += itemReturnAmount;

      returnItems.push({
        id: `rtn-it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderItemId: item.orderItemId,
        productName: item.productName,
        sku: item.sku,
        color: item.color || "Standard",
        size: item.size,
        purchasedQuantity: item.purchasedQuantity,
        requestedQuantity: item.returnQuantity,
        receivedQuantity: 0,
        approvedQuantity: 0,
        unitPrice: item.unitPrice,
        returnAmount: itemReturnAmount,
      });
    }

    if (returnItems.length === 0) {
      return { success: false, error: "Please select at least 1 item with quantity > 0 to return." };
    }

    const discountAdjustment = params.discountAdjustment || 0;
    const shippingAdjustment = params.shippingAdjustment || 0;
    const calculatedExpectedAmount = Math.max(0, itemsAmount - discountAdjustment + shippingAdjustment);
    const expectedAmount = params.customAmountOverride !== undefined ? params.customAmountOverride : calculatedExpectedAmount;

    const returnId = generateReturnId();
    const now = new Date().toISOString();

    const newReturnCase: ReturnCase = {
      id: `rtn-case-${Date.now()}`,
      returnId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customer.id,
      customerName: order.customer.name,
      customerPhone: order.customer.mobile,
      returnType: params.returnType,
      reason: params.reason,
      customerNote: params.customerNote,
      status: "Return Requested",
      requestedQuantity: totalRequestedQty,
      receivedQuantity: 0,
      approvedQuantity: 0,
      expectedAmount,
      refundAmount: params.returnType === "Refund" ? expectedAmount : 0,
      discountAdjustment,
      shippingAdjustment,
      items: returnItems,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          returnId,
          action: "Return Requested",
          user: globalUser.name,
          role: globalUser.role,
          notes: `Return case created for ${totalRequestedQty} item(s). Reason: ${params.reason}. Type: ${params.returnType}`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: globalUser.name,
    };

    const updated = [newReturnCase, ...globalReturns];
    persistReturns(updated);

    return { success: true, returnCase: newReturnCase };
  },

  updateReturnStatus(
    returnId: string,
    newStatus: ReturnStatus,
    notes?: string,
    userName?: string,
    userRole?: Role
  ): { success: boolean; error?: string } {
    const index = globalReturns.findIndex((r) => r.id === returnId || r.returnId === returnId);
    if (index === -1) return { success: false, error: "Return case not found" };

    const target = globalReturns[index];
    const now = new Date().toISOString();
    const actionUser = userName || globalUser.name;
    const actionRole = userRole || globalUser.role;

    const updatedTimeline: ReturnTimelineEvent[] = [
      ...target.timeline,
      {
        id: `tl-${Date.now()}`,
        returnId: target.returnId,
        action: newStatus,
        user: actionUser,
        role: actionRole,
        notes: notes || `Return status updated to ${newStatus}`,
        timestamp: now,
      },
    ];

    const updatedCase: ReturnCase = {
      ...target,
      status: newStatus,
      updatedAt: now,
      timeline: updatedTimeline,
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    return { success: true };
  },

  recordReturnReceived(
    returnId: string,
    params: {
      receivedQuantity: number;
      receivedBy?: string;
      receivingNote?: string;
      itemReceipts?: Record<string, number>;
    }
  ): { success: boolean; error?: string } {
    const index = globalReturns.findIndex((r) => r.id === returnId || r.returnId === returnId);
    if (index === -1) return { success: false, error: "Return case not found" };

    const target = globalReturns[index];
    const now = new Date().toISOString();
    const receiver = params.receivedBy || globalUser.name;

    // Update item-level received quantities
    const updatedItems = target.items.map((it) => {
      const recQty = params.itemReceipts?.[it.id] !== undefined 
        ? params.itemReceipts[it.id] 
        : params.receivedQuantity >= it.requestedQuantity ? it.requestedQuantity : params.receivedQuantity;
      return {
        ...it,
        receivedQuantity: recQty,
      };
    });

    const totalReceived = params.receivedQuantity;
    const shortQty = Math.max(0, target.requestedQuantity - totalReceived);
    const shortNote = shortQty > 0 ? ` (Short Quantity: ${shortQty})` : "";

    const timelineEntry: ReturnTimelineEvent = {
      id: `tl-${Date.now()}`,
      returnId: target.returnId,
      action: "Return Received",
      user: receiver,
      role: globalUser.role,
      notes: `Physical return parcel checked in by ${receiver}. Expected: ${target.requestedQuantity}, Received: ${totalReceived}${shortNote}. Note: ${params.receivingNote || "Parcel in warehouse"}`,
      timestamp: now,
    };

    const updatedCase: ReturnCase = {
      ...target,
      status: "QC Pending",
      receivedQuantity: totalReceived,
      receivedAt: now,
      receivedBy: receiver,
      receivingNote: params.receivingNote,
      items: updatedItems,
      updatedAt: now,
      timeline: [...target.timeline, timelineEntry],
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    return { success: true };
  },

  performQcCheck(
    returnId: string,
    params: {
      condition: QcCondition;
      qcResult: QcResult;
      inventoryDisposition?: InventoryDisposition;
      qcNotes?: string;
      approvedQuantities?: Record<string, number>;
      checkedBy?: string;
    }
  ): { success: boolean; error?: string } {
    const index = globalReturns.findIndex((r) => r.id === returnId || r.returnId === returnId);
    if (index === -1) return { success: false, error: "Return case not found" };

    const target = globalReturns[index];
    const now = new Date().toISOString();
    const inspector = params.checkedBy || globalUser.name;

    // Calculate approved items
    let totalApprovedQty = 0;
    let approvedRefundAmount = 0;

    const updatedItems = target.items.map((it) => {
      let appQty = 0;
      if (params.qcResult === "Approved") {
        appQty = it.receivedQuantity || it.requestedQuantity;
      } else if (params.qcResult === "Partially Approved") {
        appQty = params.approvedQuantities?.[it.id] ?? Math.min(1, it.receivedQuantity || 1);
      } else {
        appQty = 0;
      }
      totalApprovedQty += appQty;
      approvedRefundAmount += appQty * it.unitPrice;
      return {
        ...it,
        approvedQuantity: appQty,
      };
    });

    const qcRecord: ReturnQc = {
      id: `qc-${Date.now()}`,
      condition: params.condition,
      qcResult: params.qcResult,
      inventoryDisposition: params.inventoryDisposition || (params.condition === "Good" ? "Restock" : "Damaged Stock"),
      qcNotes: params.qcNotes,
      checkedBy: inspector,
      checkedAt: now,
    };

    let nextStatus: ReturnStatus = "QC Approved";
    if (params.qcResult === "Rejected") {
      nextStatus = "Rejected";
    } else {
      if (target.returnType === "Refund") {
        nextStatus = "Refund Pending";
      } else {
        nextStatus = "Replacement Pending";
      }
    }

    const timelineNotes = `QC check completed by ${inspector}. Result: ${params.qcResult}, Condition: ${params.condition}, Disposition: ${qcRecord.inventoryDisposition}. Approved Qty: ${totalApprovedQty}. Note: ${params.qcNotes || "None"}`;

    const timelineEntry: ReturnTimelineEvent = {
      id: `tl-${Date.now()}`,
      returnId: target.returnId,
      action: params.qcResult === "Rejected" ? "QC Rejected" : "QC Approved",
      user: inspector,
      role: globalUser.role,
      notes: timelineNotes,
      timestamp: now,
    };

    // Auto-create replacement task if Replacement or Exchange
    let replacement = target.replacement;
    if ((target.returnType === "Replacement" || target.returnType === "Exchange") && params.qcResult !== "Rejected" && !replacement) {
      const repItem = target.items[0];
      replacement = {
        id: `rep-${Date.now()}`,
        replacementId: generateReplacementId(),
        originalOrderId: target.orderId,
        originalOrderNumber: target.orderNumber,
        originalItemName: repItem?.productName || "Item",
        returnedItem: `${repItem?.productName || "Item"} - ${repItem?.size || "M"}`,
        replacementItem: `${repItem?.productName || "Item"} - ${repItem?.size || "M"}`,
        color: repItem?.color || "Standard",
        size: repItem?.size || "M",
        quantity: totalApprovedQty || 1,
        status: "Waiting for Packing",
      };
    }

    const updatedCase: ReturnCase = {
      ...target,
      status: nextStatus,
      approvedQuantity: totalApprovedQty,
      refundAmount: target.returnType === "Refund" ? approvedRefundAmount : 0,
      qc: qcRecord,
      replacement,
      items: updatedItems,
      updatedAt: now,
      timeline: [...target.timeline, timelineEntry],
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    return { success: true };
  },

  processRefund(
    returnId: string,
    params: {
      refundStatus: RefundStatus;
      refundAmount?: number;
      refundMethod?: RefundMethod;
      utrReference?: string;
      refundNotes?: string;
      processedBy?: string;
    }
  ): { success: boolean; error?: string } {
    const index = globalReturns.findIndex((r) => r.id === returnId || r.returnId === returnId);
    if (index === -1) return { success: false, error: "Return case not found" };

    const target = globalReturns[index];
    const now = new Date().toISOString();
    const processor = params.processedBy || globalUser.name;

    if (params.refundStatus === "Refunded" && !params.utrReference && !params.refundMethod) {
      return { success: false, error: "Please provide refund method and UTR / Reference number to mark completed." };
    }

    const refundAmount = params.refundAmount !== undefined ? params.refundAmount : target.refundAmount;

    const refundRecord: ReturnRefund = {
      id: target.refund?.id || `ref-${Date.now()}`,
      refundStatus: params.refundStatus,
      refundAmount,
      refundMethod: params.refundMethod || target.refund?.refundMethod || "UPI",
      utrReference: params.utrReference || target.refund?.utrReference,
      refundNotes: params.refundNotes || target.refund?.refundNotes,
      processedBy: processor,
      refundDate: params.refundStatus === "Refunded" ? now : target.refund?.refundDate,
    };

    const isRefundCompleted = params.refundStatus === "Refunded";
    const nextStatus: ReturnStatus = isRefundCompleted ? "Completed" : "Refund Pending";

    const timelineEntry: ReturnTimelineEvent = {
      id: `tl-${Date.now()}`,
      returnId: target.returnId,
      action: isRefundCompleted ? "Refund Completed" : `Refund ${params.refundStatus}`,
      user: processor,
      role: globalUser.role,
      notes: `Refund ${params.refundStatus}: ₹${refundAmount} via ${refundRecord.refundMethod}${refundRecord.utrReference ? ` (UTR: ${refundRecord.utrReference})` : ""}. Note: ${params.refundNotes || "Processed"}`,
      timestamp: now,
    };

    const updatedCase: ReturnCase = {
      ...target,
      status: nextStatus,
      refundAmount,
      refund: refundRecord,
      updatedAt: now,
      timeline: [...target.timeline, timelineEntry],
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    return { success: true };
  },

  createReplacementTask(
    returnId: string,
    params: {
      replacementItem?: string;
      color?: string;
      size?: string;
      quantity?: number;
    }
  ): { success: boolean; replacementId?: string; error?: string } {
    const index = globalReturns.findIndex((r) => r.id === returnId || r.returnId === returnId);
    if (index === -1) return { success: false, error: "Return case not found" };

    const target = globalReturns[index];
    const now = new Date().toISOString();
    const repId = generateReplacementId();
    const firstItem = target.items[0];

    const replacementRecord: ReturnReplacement = {
      id: `rep-${Date.now()}`,
      replacementId: repId,
      originalOrderId: target.orderId,
      originalOrderNumber: target.orderNumber,
      originalItemName: firstItem?.productName || "Item",
      returnedItem: `${firstItem?.productName || "Item"} - ${firstItem?.size || "M"}`,
      replacementItem: params.replacementItem || `${firstItem?.productName || "Item"} - ${params.size || firstItem?.size || "M"}`,
      color: params.color || firstItem?.color || "Standard",
      size: params.size || firstItem?.size || "M",
      quantity: params.quantity || target.approvedQuantity || 1,
      status: "Waiting for Packing",
    };

    const timelineEntry: ReturnTimelineEvent = {
      id: `tl-${Date.now()}`,
      returnId: target.returnId,
      action: "Replacement Created",
      user: globalUser.name,
      role: globalUser.role,
      notes: `Replacement task ${repId} created and sent to Packing Station (${replacementRecord.replacementItem}, Qty: ${replacementRecord.quantity})`,
      timestamp: now,
    };

    const updatedCase: ReturnCase = {
      ...target,
      status: "Replacement Pending",
      replacement: replacementRecord,
      updatedAt: now,
      timeline: [...target.timeline, timelineEntry],
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    return { success: true, replacementId: repId };
  },

  updateReplacementDispatch(
    returnIdOrReplacementId: string,
    params: {
      dispatchId?: string;
      courier?: string;
      llr?: string;
      tracking?: string;
      status?: "Waiting for Packing" | "Packing" | "Packed" | "Dispatched" | "Delivered";
    }
  ): { success: boolean; error?: string } {
    const index = globalReturns.findIndex(
      (r) => r.id === returnIdOrReplacementId ||
        r.returnId === returnIdOrReplacementId ||
        r.replacement?.replacementId === returnIdOrReplacementId
    );
    if (index === -1) return { success: false, error: "Replacement or Return not found" };

    const target = globalReturns[index];
    if (!target.replacement) return { success: false, error: "No replacement task linked to this return case" };

    const now = new Date().toISOString();
    const newStatus = params.status || "Dispatched";
    const dispatchId = params.dispatchId || target.replacement.dispatchId || generateDispatchId();

    const updatedReplacement: ReturnReplacement = {
      ...target.replacement,
      status: newStatus,
      dispatchId,
      courier: params.courier || target.replacement.courier || "ST Courier",
      llr: params.llr !== undefined ? params.llr : target.replacement.llr,
      tracking: params.tracking || target.replacement.tracking,
      dispatchedAt: newStatus === "Dispatched" ? (target.replacement.dispatchedAt || now) : target.replacement.dispatchedAt,
    };

    let nextReturnStatus = target.status;
    if (newStatus === "Dispatched") {
      nextReturnStatus = "Replacement Dispatched";
    } else if (newStatus === "Delivered") {
      nextReturnStatus = "Completed";
    }

    const actionTitle = newStatus === "Packing" ? "Replacement Packing Started" : newStatus === "Packed" ? "Replacement Packed" : newStatus === "Dispatched" ? "Replacement Dispatched" : "Replacement Delivered";
    const actionDetails = `${actionTitle}: Dispatch ID ${dispatchId}, Courier: ${updatedReplacement.courier}${updatedReplacement.llr ? `, LLR: ${updatedReplacement.llr}` : ""}`;

    const timelineEntry: ReturnTimelineEvent = {
      id: `tl-${Date.now()}`,
      returnId: target.returnId,
      action: actionTitle,
      user: globalUser.name,
      role: globalUser.role,
      notes: actionDetails,
      timestamp: now,
    };

    const updatedCase: ReturnCase = {
      ...target,
      status: nextReturnStatus,
      replacement: updatedReplacement,
      updatedAt: now,
      timeline: [...target.timeline, timelineEntry],
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    return { success: true };
  },
};


