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
import { matchesDateFilter, normalizePhoneDigits } from "./utils";
import { 
  isSupabaseConfigured, 
  fetchSupabaseOrders, 
  updateSupabaseOrderStatus, 
  updateSupabaseCourierDetails, 
  updateSupabaseSmsStatus,
  subscribeToSupabaseRealtime 
} from "./supabase";

const STORAGE_KEY_ORDERS = "orderflow_orders_v2";
const STORAGE_KEY_USER = "orderflow_current_user_v1";
const STORAGE_KEY_COURIERS = "orderflow_courier_partners_v1";
const STORAGE_KEY_RETURNS = "orderflow_returns_v2";

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

export function hasValidLlrNumber(llr?: string, dispatchId?: string): boolean {
  if (!llr) return false;
  const clean = String(llr).trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  if (
    lower === "pending" ||
    lower === "available" ||
    lower === "/available" ||
    lower === "na" ||
    lower === "n/a" ||
    lower === "null" ||
    lower === "undefined"
  ) {
    return false;
  }
  if (lower.startsWith("dsp-") || lower.startsWith("dsp_") || lower.startsWith("dsp")) {
    return false;
  }
  if (dispatchId && clean === String(dispatchId).trim()) {
    return false;
  }
  return true;
}

export function normalizeOrderTimeline(ord: Order): ActivityLog[] {
  const existingTimeline: ActivityLog[] = Array.isArray(ord.timeline) ? [...ord.timeline] : [];
  const eventsMap = new Map<string, ActivityLog>();

  for (const ev of existingTimeline) {
    const act = (ev.action || "").trim().toLowerCase();
    if (!eventsMap.has(act)) {
      eventsMap.set(act, ev);
    }
  }

  const orderCreatedTime = ord.createdAt || new Date().toISOString();
  const confirmedTime = ord.confirmedAt || new Date(new Date(orderCreatedTime).getTime() + 5 * 60 * 1000).toISOString();
  const dispatchedTime = ord.dispatchedAt || ord.dispatch?.dispatchedAt || (ord.orderStatus === "DISPATCHED" ? new Date(new Date(confirmedTime).getTime() + 15 * 60 * 1000).toISOString() : undefined);
  const pickedUpTime = ord.pickedUpAt || ord.dispatch?.pickedUpAt || (ord.dispatch?.courierStatus === "PICKED_UP" || ord.dispatch?.courierStatus === "SHIPPED" ? new Date(new Date(dispatchedTime || confirmedTime).getTime() + 10 * 60 * 1000).toISOString() : undefined);

  // CRITICAL: An order ONLY has LLR/Shipped if there is an actual valid LLR number entered!
  const hasLlr = hasValidLlrNumber(ord.dispatch?.llrNumber, ord.dispatch?.dispatchId);
  const shippedTime = hasLlr ? (ord.shippedAt || ord.dispatch?.shippedAt || new Date(new Date(pickedUpTime || dispatchedTime || confirmedTime).getTime() + 10 * 60 * 1000).toISOString()) : undefined;
  const smsTime = (hasLlr && (ord.sms?.status === "SENT" || eventsMap.has("sms sent"))) ? (ord.sms?.sentAt || new Date(new Date(shippedTime || pickedUpTime || dispatchedTime || confirmedTime).getTime() + 5 * 60 * 1000).toISOString()) : undefined;

  let entries: ActivityLog[] = [];

  // Stage 1: Order Created
  if (eventsMap.has("order created") || eventsMap.has("order placed")) {
    entries.push(eventsMap.get("order created") || eventsMap.get("order placed")!);
  } else {
    entries.push({
      id: `tl-gen-${ord.id}-created`,
      orderId: ord.id,
      timestamp: orderCreatedTime,
      user: "WooCommerce",
      role: "SYSTEM",
      action: "Order Created",
      details: "Order received and created from website",
      newValue: "NEW",
    });
  }

  // Stage 1b: Processing Started
  if (eventsMap.has("processing started") || eventsMap.has("order processing")) {
    entries.push(eventsMap.get("processing started") || eventsMap.get("order processing")!);
  } else {
    entries.push({
      id: `tl-gen-${ord.id}-proc`,
      orderId: ord.id,
      timestamp: new Date(new Date(orderCreatedTime).getTime() + 1000).toISOString(),
      user: "Orders System",
      role: "ORDER_STAFF",
      action: "Processing Started",
      details: "Order processing started",
      newValue: "PROCESSING",
    });
  }

  // Stage 2: Order Completed & Waiting for Packing
  const isCompletedOrBeyond =
    ord.orderStatus === "COMPLETED" ||
    ord.orderStatus === "PACKED" ||
    ord.orderStatus === "DISPATCHED" ||
    Boolean(dispatchedTime) ||
    Boolean(ord.dispatch?.dispatchId) ||
    Boolean(pickedUpTime) ||
    Boolean(shippedTime);

  if (isCompletedOrBeyond) {
    if (eventsMap.has("order completed")) {
      entries.push(eventsMap.get("order completed")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-compl`,
        orderId: ord.id,
        timestamp: confirmedTime,
        user: "WooCommerce",
        role: "SYSTEM",
        action: "Order Completed",
        details: "Order completed in WooCommerce",
        newValue: "COMPLETED",
      });
    }

    if (eventsMap.has("waiting for packing") || eventsMap.has("ready for packing")) {
      entries.push(eventsMap.get("waiting for packing") || eventsMap.get("ready for packing")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-waitpack`,
        orderId: ord.id,
        timestamp: new Date(new Date(confirmedTime).getTime() + 1000).toISOString(),
        user: "Packing Station",
        role: "PACKING_STAFF",
        action: "Waiting for Packing",
        details: "Order completed, waiting for packing in fulfillment station",
      });
    }
  }

  // Stage 3: Order Packed, Order Dispatched, and Waiting for Courier Pickup
  const isPackedOrBeyond =
    ord.orderStatus === "PACKED" ||
    ord.orderStatus === "DISPATCHED" ||
    Boolean(dispatchedTime) ||
    Boolean(ord.dispatch?.dispatchId) ||
    Boolean(pickedUpTime) ||
    Boolean(shippedTime);

  if (isPackedOrBeyond) {
    const packTimestamp = dispatchedTime ? new Date(new Date(dispatchedTime).getTime() - 60 * 1000).toISOString() : new Date(new Date(confirmedTime).getTime() + 5 * 60 * 1000).toISOString();

    if (eventsMap.has("order packed")) {
      entries.push(eventsMap.get("order packed")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-packed`,
        orderId: ord.id,
        timestamp: packTimestamp,
        user: "Packing Staff",
        role: "PACKING_STAFF",
        action: "Order Packed",
        details: "Items verified, folded and securely packed",
        newValue: "PACKED",
      });
    }

    if (eventsMap.has("order dispatched")) {
      entries.push(eventsMap.get("order dispatched")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-disp`,
        orderId: ord.id,
        timestamp: dispatchedTime || new Date(new Date(packTimestamp).getTime() + 60 * 1000).toISOString(),
        user: "Admin",
        role: "DISPATCH_STAFF",
        action: "Order Dispatched",
        details: ord.dispatch?.dispatchId ? `Dispatch No: ${ord.dispatch.dispatchId}` : "Order dispatched from packing station",
        newValue: "DISPATCHED",
      });
    }

    if (eventsMap.has("waiting for courier pickup") || eventsMap.has("waiting for pickup")) {
      entries.push(eventsMap.get("waiting for courier pickup") || eventsMap.get("waiting for pickup")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-waitpickup`,
        orderId: ord.id,
        timestamp: new Date(new Date(dispatchedTime || packTimestamp).getTime() + 1000).toISOString(),
        user: "Packing Station",
        role: "PACKING_STAFF",
        action: "Waiting for Courier Pickup",
        details: "Order ready in dispatch bay, waiting for courier pickup",
      });
    }
  }

  // Stage 4: Courier Picked Up & Waiting for Shipment
  const isPickedUpOrBeyond =
    ord.dispatch?.courierStatus === "PICKED_UP" ||
    ord.dispatch?.courierStatus === "SHIPPED" ||
    Boolean(pickedUpTime) ||
    Boolean(shippedTime) ||
    eventsMap.has("courier picked up");

  if (isPickedUpOrBeyond) {
    const courierName = ord.dispatch?.courierName || "Courier Partner";
    const actualPickedUpTime = pickedUpTime || (dispatchedTime ? new Date(new Date(dispatchedTime).getTime() + 10 * 60 * 1000).toISOString() : new Date().toISOString());

    if (eventsMap.has("courier picked up")) {
      entries.push(eventsMap.get("courier picked up")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-pickup`,
        orderId: ord.id,
        timestamp: actualPickedUpTime,
        user: "Courier Staff",
        role: "DISPATCH_STAFF",
        action: "Courier Picked Up",
        details: `Courier: ${courierName} · Customer Mobile Verified: ${ord.customer?.mobile}${ord.dispatch?.dispatchId ? ` · Dispatch ID: ${ord.dispatch.dispatchId}` : ""}`,
        newValue: "PICKED_UP",
      });
    }

    if (eventsMap.has("waiting for shipment") || eventsMap.has("waiting for llr / tracking")) {
      entries.push(eventsMap.get("waiting for shipment") || eventsMap.get("waiting for llr / tracking")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-waitship`,
        orderId: ord.id,
        timestamp: new Date(new Date(actualPickedUpTime).getTime() + 1000).toISOString(),
        user: courierName,
        role: "DISPATCH_STAFF",
        action: "Waiting for Shipment",
        details: "Handed over to courier, awaiting LLR / Tracking number entry",
      });
    }
  }

  // Stage 5: ONLY IF REAL VALID LLR NUMBER HAS BEEN ENTERED!
  // If LLR is NOT entered, NEVER generate or include LLR, Shipped, or Waiting for SMS!
  if (hasLlr) {
    const courierName = ord.dispatch?.courierName || "Courier";
    const llr = ord.dispatch!.llrNumber!.trim();
    const actualShippedTime = shippedTime || new Date(new Date(pickedUpTime || dispatchedTime || confirmedTime).getTime() + 5000).toISOString();

    if (eventsMap.has("llr / tracking added")) {
      entries.push(eventsMap.get("llr / tracking added")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-llr`,
        orderId: ord.id,
        timestamp: actualShippedTime,
        user: "Courier Staff",
        role: "DISPATCH_STAFF",
        action: "LLR / Tracking Added",
        details: `${courierName} · LLR: ${llr}`,
        newValue: llr,
      });
    }

    if (eventsMap.has("shipped")) {
      entries.push(eventsMap.get("shipped")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-shipped`,
        orderId: ord.id,
        timestamp: new Date(new Date(actualShippedTime).getTime() + 1000).toISOString(),
        user: "Dispatch Staff",
        role: "DISPATCH_STAFF",
        action: "Shipped",
        details: `Shipment in transit via ${courierName} (LLR: ${llr})`,
        newValue: "SHIPPED",
      });
    }

    if (eventsMap.has("waiting for sms")) {
      entries.push(eventsMap.get("waiting for sms")!);
    } else {
      entries.push({
        id: `tl-gen-${ord.id}-waitsms`,
        orderId: ord.id,
        timestamp: new Date(new Date(actualShippedTime).getTime() + 2000).toISOString(),
        user: "SMS System",
        role: "SYSTEM",
        action: "Waiting for SMS",
        details: "Shipment marked as Shipped, queued and waiting for SMS notification",
      });
    }

    // Stage 6: SMS Sent or Failed
    if (ord.sms?.status === "SENT" || eventsMap.has("sms sent")) {
      if (eventsMap.has("sms sent")) {
        entries.push(eventsMap.get("sms sent")!);
      } else {
        entries.push({
          id: `tl-gen-${ord.id}-smssent`,
          orderId: ord.id,
          timestamp: smsTime || new Date(new Date(actualShippedTime).getTime() + 5 * 60 * 1000).toISOString(),
          user: "Ping4SMS",
          role: "SYSTEM",
          action: "SMS Sent",
          details: "Customer delivery notification sent successfully via Ping4SMS gateway",
          newValue: "SENT",
        });
      }
    } else if (ord.sms?.status === "FAILED" || eventsMap.has("sms failed")) {
      if (eventsMap.has("sms failed")) {
        entries.push(eventsMap.get("sms failed")!);
      }
    }
  } else {
    // If NO valid LLR has been entered, PURGE any premature LLR or Shipped or Waiting for SMS events
    entries = entries.filter((e) => {
      const act = (e.action || "").trim().toLowerCase();
      return (
        act !== "llr / tracking added" &&
        act !== "shipped" &&
        act !== "waiting for sms" &&
        act !== "sms sent"
      );
    });
  }

  // Preserve any other custom/return/dispatch-update timeline entries
  const standardActions = new Set([
    "order created", "order placed",
    "processing started", "order processing",
    "order completed",
    "waiting for packing", "ready for packing",
    "order packed",
    "order dispatched",
    "waiting for courier pickup", "waiting for pickup",
    "courier picked up",
    "waiting for shipment", "waiting for llr / tracking",
    "llr / tracking added",
    "shipped",
    "waiting for sms",
    "sms sent", "sms failed",
  ]);

  for (const ev of existingTimeline) {
    const act = (ev.action || "").trim().toLowerCase();
    if (!standardActions.has(act)) {
      entries.push(ev);
    }
  }

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return entries;
}

export function sanitizeOrders(orders: Order[]): Order[] {
  let dispCounter = 1;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayPrefix = `DSP-${yy}${mm}${dd}-`;

  // Filter out any pending or cancelled WooCommerce/WEBSITE orders
  const validOrders = orders.filter((ord) => {
    if (!ord) return false;
    const isWc = ord.source === "WEBSITE" || ord.orderNumber?.startsWith("SC-WC-") || String(ord.id || "").startsWith("SC-WC-");
    if (isWc && (ord.orderStatus === "NEW" || ord.orderStatus === "RETURN")) {
      return false;
    }
    return true;
  });

  return validOrders.map((ord) => {
    if (!ord) return ord;

    // Ensure all WooCommerce orders (SC-WC-) are strictly WEBSITE source
    if (ord.orderNumber?.startsWith("SC-WC-") || String(ord.id || "").startsWith("SC-WC-")) {
      ord.source = "WEBSITE";
    }

    // 1. Deduplicate items
    if (Array.isArray(ord?.items) && ord.items.length > 1) {
      const map = new Map<string, OrderItem>();
      ord.items.forEach((it) => {
        const k = `${(it.sku || "").trim().toLowerCase()}__${(it.size || "").trim().toLowerCase()}__${(it.productName || "").trim().toLowerCase()}`;
        if (!map.has(k)) map.set(k, it);
      });
      ord.items = Array.from(map.values());
    }

    // 2. Dispatched orders:
    // "Dispatched" in Packing means READY FOR COURIER PICKUP.
    // An order only belongs to a courier partner and moves into Courier Hub once verified by Customer Mobile (Picked Up).
    if (ord.orderStatus === "DISPATCHED") {
      let dispatchId = ord.dispatch?.dispatchId;
      if (dispatchId === "Pending ID" || dispatchId === "pending") {
        dispatchId = undefined;
      }

      let llrNumber = ord.dispatch?.llrNumber;
      if (!hasValidLlrNumber(llrNumber, dispatchId)) {
        llrNumber = undefined;
      }

      const hasCourierPickedUpTimeline = ord.timeline?.some(
        (t) => t.action === "Courier Picked Up" || t.action === "Courier picked up"
      );
      const isActuallyPickedUp =
        hasCourierPickedUpTimeline ||
        Boolean(ord.dispatch?.pickedUpAt) ||
        ord.dispatch?.courierStatus === "PICKED_UP" ||
        ord.dispatch?.courierStatus === "SHIPPED" ||
        Boolean(ord.dispatch?.courierPartnerId);

      // CRITICAL: An order is ONLY Shipped if it has a real valid LLR number entered!
      const isShipped = Boolean(llrNumber && hasValidLlrNumber(llrNumber, dispatchId));

      let partnerCode: string | undefined = undefined;
      let resolvedCourierName: string | undefined = undefined;
      let courierStatus: CourierStatus | undefined = undefined;
      let pickedUpAt: string | undefined = undefined;
      let shippedAt: string | undefined = undefined;

      if (isActuallyPickedUp) {
        partnerCode = ord.dispatch?.courierPartnerId || undefined;
        resolvedCourierName = ord.dispatch?.courierName || undefined;
        pickedUpAt = ord.dispatch?.pickedUpAt || ord.pickedUpAt || ord.dispatchedAt || new Date().toISOString();
        if (isShipped) {
          courierStatus = "SHIPPED";
          shippedAt = ord.dispatch?.shippedAt || ord.shippedAt || new Date().toISOString();
        } else {
          // If NO valid LLR number is entered, courier status is strictly PICKED_UP!
          courierStatus = "PICKED_UP";
          shippedAt = undefined;
        }
      } else {
        partnerCode = undefined;
        resolvedCourierName = undefined;
        courierStatus = undefined;
        pickedUpAt = undefined;
        shippedAt = undefined;
      }

      if (ord.sms) {
        const currentSmsStatus = ord.sms.status || "PENDING";
        ord.sms = {
          ...ord.sms,
          status: currentSmsStatus,
          responseSnippet: currentSmsStatus === "SENT"
            ? "DELIVRD: Marked as Sent"
            : currentSmsStatus === "FAILED"
            ? (ord.sms.responseSnippet || "FAILED: Delivery failed")
            : "PENDING: Waiting for SMS",
        };
      }

      ord.pickedUpAt = pickedUpAt;
      ord.shippedAt = shippedAt;

      ord.dispatch = {
        ...ord.dispatch,
        courierPartnerId: partnerCode,
        courierName: resolvedCourierName,
        dispatchId,
        llrNumber,
        courierStatus: courierStatus as any,
        pickedUpAt,
        shippedAt,
      };
    }

    // 3. Ensure master order timeline has full normalized workflow history
    ord.timeline = normalizeOrderTimeline(ord);

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
          const merged = mergeRemoteWithLocalOrders(remoteOrders, globalOrders);
          persistOrders(merged);
        }
      });

      subscribeToSupabaseRealtime(() => {
        fetchSupabaseOrders().then((remoteOrders) => {
          if (remoteOrders !== null) {
            const merged = mergeRemoteWithLocalOrders(remoteOrders, globalOrders);
            persistOrders(merged);
          }
        });
      });

      // Background live sync from WooCommerce website every 20 seconds
      if (typeof window !== "undefined") {
        setInterval(() => {
          fetch("/api/sync/woocommerce", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
              if (data?.success) {
                fetchSupabaseOrders().then((remoteOrders) => {
                  if (remoteOrders !== null) {
                    const merged = mergeRemoteWithLocalOrders(remoteOrders, globalOrders);
                    persistOrders(merged);
                  }
                });
              }
            })
            .catch(() => {});
        }, 20000);
      }
    }
    // Purge legacy v1 return caches
    localStorage.removeItem("orderflow_returns_v1");
    // Initialize Returns Cache (Starts clean with 0 return cases)
    const cachedReturns = localStorage.getItem(STORAGE_KEY_RETURNS);
    if (cachedReturns) {
      try {
        globalReturns = JSON.parse(cachedReturns);
      } catch {
        globalReturns = [];
        localStorage.setItem(STORAGE_KEY_RETURNS, JSON.stringify(globalReturns));
      }
    } else {
      globalReturns = [];
      localStorage.setItem(STORAGE_KEY_RETURNS, JSON.stringify(globalReturns));
    }
  } catch (err) {
    console.error("Error reading from localStorage:", err);
    globalOrders = isLive ? [] : generateMockOrders();
    globalReturns = [];
  }

  return globalOrders;
}

function mergeRemoteWithLocalOrders(remoteOrders: Order[], localOrders: Order[]): Order[] {
  const localMap = new Map(localOrders.map((o) => [o.id, o]));
  const merged: Order[] = remoteOrders.map((remote): Order => {
    const local = localMap.get(remote.id);
    if (!local) return remote;

    const localDisp = local.dispatch || {};
    const remoteDisp = remote.dispatch || {};

    // Preserve local manual dispatchId and llrNumber if remote hasn't updated yet
    const finalDispatchId = remoteDisp.dispatchId || localDisp.dispatchId;
    let finalLlr = remoteDisp.llrNumber || localDisp.llrNumber;
    if (finalLlr && (finalLlr === finalDispatchId || finalLlr.toLowerCase().startsWith("dsp"))) {
      finalLlr = undefined;
    }
    const finalCourierStatus: CourierStatus | undefined = (localDisp.courierStatus === "SHIPPED" || remoteDisp.courierStatus === "SHIPPED" || Boolean(finalLlr))
      ? "SHIPPED"
      : (localDisp.courierStatus === "PICKED_UP" || remoteDisp.courierStatus === "PICKED_UP"
        ? "PICKED_UP"
        : (remoteDisp.courierStatus || localDisp.courierStatus));

    const isDispatched = local.orderStatus === "DISPATCHED" || remote.orderStatus === "DISPATCHED";

    const localSms = local.sms || {};
    const remoteSms = remote.sms || {};
    let finalSmsStatus: SmsStatus = "PENDING";
    if (local.updatedAt && remote.updatedAt && new Date(local.updatedAt).getTime() >= new Date(remote.updatedAt).getTime()) {
      finalSmsStatus = localSms.status || remoteSms.status || "PENDING";
    } else {
      finalSmsStatus = remoteSms.status || localSms.status || "PENDING";
    }

    return {
      ...remote,
      orderStatus: isDispatched && remote.orderStatus !== "COMPLETED" ? "DISPATCHED" : remote.orderStatus,
      dispatchedAt: remote.dispatchedAt || local.dispatchedAt,
      dispatch: {
        ...remoteDisp,
        ...localDisp,
        dispatchId: finalDispatchId,
        llrNumber: finalLlr,
        courierStatus: finalCourierStatus,
        pickedUpAt: localDisp.pickedUpAt || remoteDisp.pickedUpAt,
      },
      sms: {
        ...remoteSms,
        ...localSms,
        status: finalSmsStatus,
        sentAt: finalSmsStatus === "SENT" ? (localSms.sentAt || remoteSms.sentAt || new Date().toISOString()) : undefined,
        responseSnippet: finalSmsStatus === "SENT"
          ? "DELIVRD: Handset delivery confirmed"
          : finalSmsStatus === "FAILED"
          ? "FAILED: Delivery failed"
          : "PENDING: Waiting for SMS",
      },
      timeline: local.timeline.length > remote.timeline.length ? local.timeline : remote.timeline,
    };
  });

  const remoteIds = new Set(remoteOrders.map((o) => o.id));
  localOrders.forEach((loc) => {
    if (!remoteIds.has(loc.id)) {
      merged.push(loc);
    }
  });

  return merged;
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
    reason?: string,
    dispatchDetails?: { dispatchId?: string; llrNumber?: string }
  ): { success: boolean; requiresConfirm?: boolean } {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const oldStatus = order.orderStatus;
    if (oldStatus === newStatus && !reason) return { success: true };
    const now = new Date().toISOString();

    const newEntries: ActivityLog[] = [];

    if (newStatus === "CONFIRMED") {
      if (!order.timeline.some((t) => t.action === "Order Created" || t.action === "Order placed")) {
        newEntries.push({
          id: `tl-${Date.now()}-created`,
          orderId: order.id,
          timestamp: order.createdAt || now,
          user: "WooCommerce",
          role: "SYSTEM",
          action: "Order Created",
          details: "Order created in WooCommerce",
          oldValue: oldStatus,
          newValue: "NEW",
        });
      }
      if (!order.timeline.some((t) => t.action === "Processing Started" || t.action === "Order processing")) {
        newEntries.push({
          id: `tl-${Date.now() + 50}-proc`,
          orderId: order.id,
          timestamp: now,
          user: "WooCommerce",
          role: "SYSTEM",
          action: "Processing Started",
          details: "Order processing started",
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
      if (!order.timeline.some((t) => t.action === "Order Packed" || t.action === "Order packed")) {
        newEntries.push({
          id: `tl-${Date.now()}-packed`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order Packed",
          details: "Order packed successfully",
          oldValue: oldStatus,
          newValue: newStatus,
        });
      }
    } else if (newStatus === "DISPATCHED") {
      // 20. No silent history overwrite: if Dispatch Number is changed, record the change
      const previousDispatchId = order.dispatch?.dispatchId;
      const nextDispatchId = dispatchDetails?.dispatchId !== undefined ? dispatchDetails.dispatchId : previousDispatchId;

      if (previousDispatchId && nextDispatchId && previousDispatchId !== nextDispatchId) {
        newEntries.push({
          id: `tl-${Date.now()}-disp-update`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Dispatch Number Updated",
          details: `Dispatch Number changed from ${previousDispatchId} to ${nextDispatchId}${reason ? `. Reason: ${reason}` : ""}`,
          oldDispatchNo: previousDispatchId,
          newDispatchNo: nextDispatchId,
          reason: reason || "Dispatch Number Changed",
        });
      }

      // 6. When a valid Dispatch Number is entered: Order Packed -> Order Dispatched
      if (!order.timeline.some((t) => t.action === "Order Packed" || t.action === "Order packed")) {
        newEntries.push({
          id: `tl-${Date.now()}-packed`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Order Packed",
          details: "Order packed in Packing Station",
          oldValue: oldStatus,
          newValue: "PACKED",
        });
      }

      if (!order.timeline.some((t) => t.action === "Order Dispatched" || t.action === "Order dispatched")) {
        newEntries.push({
          id: `tl-${Date.now() + 100}-disp`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 100).toISOString(),
          user: globalUser.name,
          role: globalUser.role,
          action: "Order Dispatched",
          details: nextDispatchId ? `Dispatch No: ${nextDispatchId}` : "Order ready for courier pickup",
          oldValue: "PACKED",
          newValue: "DISPATCHED",
        });
      }

      if (!order.timeline.some((t) => t.action === "Waiting for Courier Pickup" || t.action === "Waiting for pickup")) {
        newEntries.push({
          id: `tl-${Date.now() + 150}-waitpickup`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 150).toISOString(),
          user: "Packing Station",
          role: "PACKING_STAFF",
          action: "Waiting for Courier Pickup",
          details: "Order ready in packing station, waiting for courier pickup",
        });
      }
    } else if (newStatus === "COMPLETED") {
      if (!order.timeline.some((t) => t.action === "Order Completed" || t.action === "Order completed")) {
        newEntries.push({
          id: `tl-${Date.now()}-compl`,
          orderId: order.id,
          timestamp: now,
          user: "WooCommerce",
          role: "SYSTEM",
          action: "Order Completed",
          details: "Order completed in WooCommerce",
          oldValue: oldStatus,
          newValue: newStatus,
        });
      }
      if (!order.timeline.some((t) => t.action === "Waiting for Packing" || t.action === "Ready for Packing" || t.action === "Waiting for packing")) {
        newEntries.push({
          id: `tl-${Date.now() + 100}-waitpack`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 100).toISOString(),
          user: "Packing Station",
          role: "PACKING_STAFF",
          action: "Waiting for Packing",
          details: "Order completed, waiting for packing in fulfillment station",
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
      packedAt: (newStatus === "PACKED" || isDispatched) && !order.packedAt ? now : order.packedAt,
      dispatchedAt: isDispatched && !order.dispatchedAt ? now : order.dispatchedAt,
      completedAt: newStatus === "COMPLETED" && !order.completedAt ? now : order.completedAt,
      packingStaff: newStatus === "PACKING" ? globalUser.name : order.packingStaff,
      dispatch: {
        ...order.dispatch,
        dispatchId: dispatchDetails?.dispatchId !== undefined ? dispatchDetails.dispatchId : (order.dispatch.dispatchId || undefined),
        llrNumber: dispatchDetails?.llrNumber !== undefined
          ? dispatchDetails.llrNumber
          : (order.dispatch.llrNumber && order.dispatch.llrNumber !== (dispatchDetails?.dispatchId || order.dispatch.dispatchId) && !order.dispatch.llrNumber.toLowerCase().startsWith("dsp")
              ? order.dispatch.llrNumber
              : undefined),
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

    if (isSupabaseConfigured()) {
      if (newEntries.length > 0) {
        newEntries.forEach((entry) => {
          updateSupabaseOrderStatus(orderId, newStatus, entry, updatedOrder.dispatch.dispatchId);
        });
      }
      // DO NOT create or update dispatches (Courier Hub) records on Packing dispatch
    }

    return { success: true };
  },

  // Mark Order as Pending with Reason and Note
  setOrderPending(orderId: string, reason: string, note?: string): { success: boolean } {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const now = new Date().toISOString();
    const oldStatus = order.orderStatus;

    const newEntry: ActivityLog = {
      id: `tl-${Date.now()}-pending`,
      orderId: order.id,
      timestamp: now,
      user: globalUser.name,
      role: globalUser.role,
      action: "Marked as Pending",
      details: `Reason: ${reason}${note ? `. Note: ${note}` : ""}`,
      oldValue: oldStatus,
      newValue: "NEW",
    };

    const noteString = `Reason: ${reason}${note ? ` | Note: ${note}` : ""}`;
    const updatedOrder: Order = {
      ...order,
      orderStatus: "NEW",
      pendingReason: reason,
      pendingNote: note || "",
      pendingAt: now,
      pendingBy: globalUser.name,
      notes: noteString,
      updatedAt: now,
      timeline: [...order.timeline, newEntry],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseOrderStatus(orderId, "NEW", newEntry);
    }

    return { success: true };
  },

  // Resolve Pending Order back to Active status
  resolveOrderPending(orderId: string): { success: boolean } {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const now = new Date().toISOString();
    const oldStatus = order.orderStatus;
    const newStatus: OrderStatus = order.completedAt ? "COMPLETED" : "CONFIRMED";

    const newEntry: ActivityLog = {
      id: `tl-${Date.now()}-resolve-pending`,
      orderId: order.id,
      timestamp: now,
      user: globalUser.name,
      role: globalUser.role,
      action: "Pending Resolved",
      details: `Pending status resolved. Order moved to ${newStatus === "COMPLETED" ? "Ready for Packing" : "Processing"}`,
      oldValue: oldStatus,
      newValue: newStatus,
    };

    const updatedOrder: Order = {
      ...order,
      orderStatus: newStatus,
      pendingReason: undefined,
      pendingNote: undefined,
      pendingAt: undefined,
      pendingBy: undefined,
      updatedAt: now,
      timeline: [...order.timeline, newEntry],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseOrderStatus(orderId, newStatus, newEntry);
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
    const dispatchId = order.dispatch.dispatchId || undefined;

    return this.updateOrderStatus(
      orderId,
      "DISPATCHED",
      "Order Dispatched from Packing Station",
      { dispatchId, llrNumber }
    );
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

    // 14 & 15. LLR / Tracking Number entry -> Courier Status = SHIPPED (DO NOT MARK DELIVERED)
    let finalCourierStatus: CourierStatus = order.dispatch.courierStatus;
    const isLlrEntered = Boolean(params.llrNumber && params.llrNumber.trim());

    if (isLlrEntered) {
      finalCourierStatus = "SHIPPED";
    } else if (params.courierStatus) {
      if (params.courierStatus === "SHIPPED" || params.courierStatus === "DELIVERED") {
        finalCourierStatus = "SHIPPED";
      } else {
        finalCourierStatus = params.courierStatus;
      }
    }

    const courierName = params.courierName !== undefined ? params.courierName : (order.dispatch.courierName || "Courier");
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

    // 14. LLR / Tracking Number entry -> "LLR / Tracking Added" then "Shipped"
    if (params.llrNumber !== undefined && params.llrNumber !== order.dispatch.llrNumber) {
      if (params.llrNumber.trim()) {
        timelineEntries.push({
          id: `tl-${Date.now()}-llr`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "LLR / Tracking Added",
          details: `${courierName} · LLR: ${params.llrNumber.trim()}`,
          oldValue: order.dispatch.llrNumber,
          newValue: params.llrNumber.trim(),
        });

        timelineEntries.push({
          id: `tl-${Date.now() + 50}-shipped`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 50).toISOString(),
          user: globalUser.name,
          role: "DISPATCH_STAFF",
          action: "Shipped",
          details: `Shipment in transit via ${courierName} (LLR: ${params.llrNumber.trim()})`,
          oldValue: oldCourierStatus,
          newValue: "SHIPPED",
        });

        timelineEntries.push({
          id: `tl-${Date.now() + 100}-waitsms`,
          orderId: order.id,
          timestamp: new Date(Date.now() + 100).toISOString(),
          user: "SMS System",
          role: "SYSTEM",
          action: "Waiting for SMS",
          details: "Shipment marked as Shipped, queued and waiting for SMS notification",
        });
      }
    }

    // Courier status transitions without LLR:
    if (params.courierStatus !== undefined && finalCourierStatus !== oldCourierStatus && !isLlrEntered) {
      if (finalCourierStatus === "PICKED_UP") {
        if (!order.timeline.some((t) => t.action === "Courier Picked Up" || t.action === "Courier picked up")) {
          timelineEntries.push({
            id: `tl-${Date.now()}-pickedup`,
            orderId: order.id,
            timestamp: now,
            user: globalUser.name || courierName || "Dispatch Staff",
            role: "DISPATCH_STAFF",
            action: "Courier Picked Up",
            details: `Courier: ${courierName}`,
            oldValue: oldCourierStatus,
            newValue: "PICKED_UP",
          });
        }
      } else if (finalCourierStatus === "WAITING_FOR_PICKUP") {
        timelineEntries.push({
          id: `tl-${Date.now()}-wait`,
          orderId: order.id,
          timestamp: now,
          user: globalUser.name,
          role: globalUser.role,
          action: "Waiting for Courier Pickup",
          details: `Courier: ${courierName}`,
          oldValue: oldCourierStatus,
          newValue: "WAITING_FOR_PICKUP",
        });
      }
    }

    const shippedAtTime = finalCourierStatus === "SHIPPED" ? (order.shippedAt || order.dispatch?.shippedAt || now) : order.shippedAt;
    const pickedUpAtTime = (finalCourierStatus === "PICKED_UP" || finalCourierStatus === "SHIPPED") ? (order.pickedUpAt || order.dispatch?.pickedUpAt || now) : order.pickedUpAt;

    const couriersList = this.getCourierPartners();
    const partner = couriersList.find((c) => c.code === (params.courierPartnerId || order.dispatch.courierPartnerId));
    const trackingUrl = (params.llrNumber && partner?.trackingUrlPattern)
      ? partner.trackingUrlPattern.replace("{llr}", params.llrNumber.trim())
      : undefined;

    const updatedOrder: Order = {
      ...order,
      orderStatus: order.orderStatus === "NEW" || order.orderStatus === "CONFIRMED" ? "DISPATCHED" : order.orderStatus,
      dispatchedAt: order.dispatchedAt || order.dispatch?.dispatchedAt || now,
      pickedUpAt: pickedUpAtTime,
      shippedAt: shippedAtTime,
      updatedAt: now,
      dispatch: {
        ...order.dispatch,
        dispatchId: params.dispatchId !== undefined ? params.dispatchId : order.dispatch.dispatchId,
        pickupPhone: params.pickupPhone !== undefined ? params.pickupPhone : order.dispatch.pickupPhone,
        llrNumber: params.llrNumber !== undefined ? params.llrNumber : order.dispatch.llrNumber,
        trackingNumber: params.llrNumber !== undefined ? params.llrNumber : order.dispatch.trackingNumber,
        trackingUrl: trackingUrl || order.dispatch.trackingUrl,
        courierStatus: finalCourierStatus,
        courierId: params.courierId || order.dispatch.courierId,
        courierName: params.courierName || order.dispatch.courierName,
        courierPartnerId: params.courierPartnerId !== undefined ? params.courierPartnerId : order.dispatch.courierPartnerId,
        dispatchedAt: order.dispatch?.dispatchedAt || order.dispatchedAt || now,
        pickedUpAt: pickedUpAtTime,
        shippedAt: shippedAtTime,
        deliveredAt: undefined, // 15. DO NOT MARK DELIVERED
      },
      sms: {
        ...order.sms,
        // 16. SHIPPED -> SMS stage becomes Waiting for SMS (PENDING)
        status: order.sms.status === "SENT" ? "SENT" : "PENDING",
        lastCheckedAt: now,
        deliveredAt: undefined,
        sentAt: order.sms.status === "SENT" ? order.sms.sentAt : undefined,
        providerMessageId: order.sms.providerMessageId || `P4S-SHIP-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, "")}`,
        responseSnippet: order.sms.status === "SENT"
          ? (order.sms.responseSnippet || "DELIVRD: Handset delivery confirmed")
          : "PENDING: Waiting for SMS",
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
        pickedUpAt: pickedUpAtTime,
        shippedAt: shippedAtTime,
      }, timelineEntries[0]);
    }

    return { success: true };
  },

  // 5b. Verify Courier Pickup by Customer Mobile Number
  // 8. Courier Hub Workflow: Enter Customer Mobile Number
  // 9. When courier person enters customer's mobile number: automatically search eligible dispatched orders.
  // 10. If multiple matching orders: return multipleMatches for staff selection dialog.
  // 11. If invalid phone: show "No eligible dispatched order found."
  // 12. Courier Partner Restriction: ST Courier only finds ST Courier orders, etc.
  // 13. Immediately sets Courier Status = Picked Up with exact server timestamp.
  verifyCourierPickupByCustomerMobile(params: {
    mobile: string;
    courierPartnerCode: string;
    orderId?: string;
  }): {
    success: boolean;
    error?: string;
    order?: Order;
    multipleMatches?: boolean;
    matchingOrders?: Order[];
  } {
    const cleanMobile = normalizePhoneDigits(params.mobile);
    if (!cleanMobile || cleanMobile.length < 10) {
      return {
        success: false,
        error: "Please enter a valid 10-digit customer mobile number",
      };
    }

    const partnerCode = params.courierPartnerCode || "ST_COURIER";
    const couriersList = this.getCourierPartners();
    let selectedCourier = couriersList.find(
      (c) => c.code === partnerCode || c.id === partnerCode || c.name === partnerCode
    );
    if (!selectedCourier) {
      selectedCourier = couriersList.find((c) => c.isStCourier) || couriersList[0] || {
        id: "cour-1",
        name: "ST Courier",
        code: "ST_COURIER",
        isStCourier: true,
        active: true,
      };
    }

    // 9. Eligible means:
    // - Order is Dispatched
    // - Order has not been picked up or shipped
    // - Order is assigned to the current courier partner (or eligible for current partner)
    // - Order is ready for courier handoff
    const eligibleOrders = globalOrders.filter((o) => {
      // 1. Must be Dispatched from Packing
      if (o.orderStatus !== "DISPATCHED") {
        return false;
      }

      // 2. Must not already be picked up or shipped
      if (
        o.dispatch?.courierStatus === "PICKED_UP" ||
        o.dispatch?.courierStatus === "SHIPPED" ||
        o.dispatch?.courierStatus === "DELIVERED" ||
        Boolean(o.dispatch?.pickedUpAt)
      ) {
        return false;
      }

      // 12. Courier Partner Restriction (at database/store query level)
      if (o.dispatch?.courierPartnerId && o.dispatch.courierPartnerId !== partnerCode) {
        return false;
      }

      // 4. Must match customer mobile (normalized 10 digits)
      return normalizePhoneDigits(o.customer.mobile) === cleanMobile;
    });

    // 11. Invalid Customer Phone
    if (eligibleOrders.length === 0) {
      return {
        success: false,
        error: "No eligible dispatched order found.",
      };
    }

    // 10. Multiple Orders with Same Customer Phone:
    // Do NOT choose the first record automatically. Show matching orders for staff selection.
    if (eligibleOrders.length > 1 && !params.orderId) {
      return {
        success: true,
        multipleMatches: true,
        matchingOrders: eligibleOrders,
      };
    }

    const targetOrder = params.orderId
      ? eligibleOrders.find((o) => o.id === params.orderId) || eligibleOrders[0]
      : eligibleOrders[0];

    const now = new Date().toISOString();
    const orderIndex = globalOrders.findIndex((o) => o.id === targetOrder.id);
    if (orderIndex === -1) {
      return { success: false, error: "No eligible dispatched order found." };
    }

    const currentOrder = globalOrders[orderIndex];
    const dispatchId = currentOrder.dispatch?.dispatchId || undefined;

    // 13. Timeline: "Courier Picked Up" and "Waiting for Shipment"
    const timelineEntry: ActivityLog = {
      id: `tl-${Date.now()}-pickedup`,
      orderId: currentOrder.id,
      timestamp: now,
      user: globalUser.name || selectedCourier.name || "Dispatch Staff",
      role: "DISPATCH_STAFF",
      action: "Courier Picked Up",
      details: `Courier: ${selectedCourier.name} · Customer Mobile Verified: ${cleanMobile}${dispatchId ? ` · Dispatch ID: ${dispatchId}` : ""}`,
      oldValue: currentOrder.dispatch?.courierStatus || "WAITING_FOR_PICKUP",
      newValue: "PICKED_UP",
    };

    const waitingShipmentEntry: ActivityLog = {
      id: `tl-${Date.now() + 50}-waitship`,
      orderId: currentOrder.id,
      timestamp: new Date(Date.now() + 50).toISOString(),
      user: selectedCourier.name,
      role: "DISPATCH_STAFF",
      action: "Waiting for Shipment",
      details: "Handed over to courier, awaiting LLR / Tracking number entry",
    };

    const updatedOrder: Order = {
      ...currentOrder,
      orderStatus: "DISPATCHED",
      dispatchedAt: currentOrder.dispatchedAt || now,
      pickedUpAt: now,
      updatedAt: now,
      dispatch: {
        ...currentOrder.dispatch,
        dispatchId,
        llrNumber: (currentOrder.dispatch?.llrNumber && currentOrder.dispatch.llrNumber !== dispatchId && !currentOrder.dispatch.llrNumber.toLowerCase().startsWith("dsp"))
          ? currentOrder.dispatch.llrNumber
          : undefined,
        courierId: selectedCourier.id,
        courierName: selectedCourier.name,
        courierPartnerId: selectedCourier.code,
        courierStatus: "PICKED_UP",
        pickedUpAt: now, // Save exact server timestamp
        pickedUpBy: globalUser.name,
        verifiedCustomerPhone: cleanMobile, // Customer phone only, not courier's phone
        dispatchedAt: currentOrder.dispatch?.dispatchedAt || now,
      },
      sms: {
        ...currentOrder.sms,
        status: "PENDING",
        lastCheckedAt: now,
        responseSnippet: "PENDING: Waiting for SMS",
      },
      timeline: [...currentOrder.timeline, timelineEntry, waitingShipmentEntry],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseCourierDetails(currentOrder.id, {
        dispatchId,
        courierId: selectedCourier.id,
        courierPartnerId: selectedCourier.code,
        courierStatus: "PICKED_UP",
        pickedUpAt: now,
        verifiedCustomerPhone: cleanMobile,
      }, timelineEntry);
    }

    return {
      success: true,
      order: updatedOrder,
      matchingOrders: [updatedOrder],
    };
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
              action: newSmsStatus === "SENT" ? "SMS Sent" : "Waiting for SMS",
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

  // 9. Manually update SMS Status (Waiting for SMS / Sent / Failed)
  updateSmsStatus(orderId: string, status: SmsStatus, failureReason?: string): { success: boolean } {
    const orderIndex = globalOrders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) return { success: false };

    const order = globalOrders[orderIndex];
    const now = new Date().toISOString();
    const oldStatus = order.sms.status;

    // 17. SMS Status: "SMS Sent" or "SMS Failed"
    const action = status === "SENT" ? "SMS Sent" : status === "FAILED" ? "SMS Failed" : "Waiting for SMS";
    const details = status === "SENT"
      ? "Customer delivery notification sent successfully"
      : status === "FAILED"
      ? (failureReason ? `SMS delivery failed: ${failureReason}` : "SMS delivery failed via Ping4SMS gateway")
      : "Order queued waiting for SMS notification";

    const timelineEntry: ActivityLog = {
      id: `tl-${Date.now()}-sms`,
      orderId: order.id,
      timestamp: now,
      user: globalUser.name || "Ping4SMS",
      role: globalUser.role || "SYSTEM",
      action,
      details,
      oldValue: oldStatus,
      newValue: status,
    };

    const updatedOrder: Order = {
      ...order,
      updatedAt: now,
      sms: {
        ...order.sms,
        status,
        lastCheckedAt: now,
        sentAt: status === "SENT" ? (order.sms.sentAt || now) : order.sms.sentAt,
        sentBy: status === "SENT" ? globalUser.name : undefined,
        deliveredAt: status === "SENT" ? (order.sms.deliveredAt || now) : undefined,
        responseSnippet: status === "SENT"
          ? "DELIVRD: Marked as Sent by staff"
          : status === "FAILED"
          ? (failureReason ? `FAILED: ${failureReason}` : "FAILED: Delivery failed")
          : "PENDING: Waiting for SMS",
      },
      timeline: [...order.timeline, timelineEntry],
    };

    const newOrders = [...globalOrders];
    newOrders[orderIndex] = updatedOrder;
    persistOrders(newOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseOrderStatus(orderId, order.orderStatus, timelineEntry);
      updateSupabaseSmsStatus(orderId, status);
    }

    return { success: true };
  },

  // 10. Bulk Update SMS Status
  bulkUpdateSmsStatus(orderIds: string[], status: SmsStatus): { successCount: number } {
    let successCount = 0;
    for (const id of orderIds) {
      const res = this.updateSmsStatus(id, status);
      if (res.success) successCount++;
    }
    return { successCount };
  },

  // Ingest order from Webhook (WooCommerce or WhatsApp)
  ingestWebhookOrder(payload: Partial<Order> & { source: OrderSource; externalOrderId: string }): { success: boolean; order?: Order; duplicate?: boolean } {
    const existingIndex = globalOrders.findIndex((o) => o.source === payload.source && o.externalOrderId === payload.externalOrderId);
    if (existingIndex !== -1) {
      const existing = globalOrders[existingIndex];
      // If order exists, preserve advanced fulfillment statuses (PACKING, PACKED, DISPATCHED, COMPLETED)
      const advancedStatuses: OrderStatus[] = ["PACKING", "PACKED", "DISPATCHED", "COMPLETED"];
      const updatedStatus = advancedStatuses.includes(existing.orderStatus)
        ? existing.orderStatus
        : (payload.orderStatus || existing.orderStatus);

      const updatedOrder: Order = {
        ...existing,
        customer: payload.customer || existing.customer,
        items: payload.items && payload.items.length > 0 ? payload.items : existing.items,
        totalAmount: payload.totalAmount !== undefined ? payload.totalAmount : existing.totalAmount,
        paymentStatus: payload.paymentStatus || existing.paymentStatus,
        orderStatus: updatedStatus,
        updatedAt: new Date().toISOString(),
      };

      const updatedList = [...globalOrders];
      updatedList[existingIndex] = updatedOrder;
      persistOrders(updatedList);
      return { success: true, duplicate: true, order: updatedOrder };
    }

    const count = globalOrders.length + 1;
    const now = new Date().toISOString();
    const orderNumber = payload.orderNumber || (payload.source === "WHATSAPP" ? `WA-${payload.externalOrderId}` : `OF-${9000 + count}`);
    const createdAt = payload.createdAt || now;
    const initialStatus: OrderStatus = payload.orderStatus || "CONFIRMED";

    const newOrder: Order = {
      id: payload.id || `ord-${count}`,
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
      orderStatus: initialStatus,
      dispatch: {
        courierId: undefined,
        courierName: undefined,
        courierStatus: "PENDING",
      },
      sms: {
        status: "PENDING",
        provider: "Ping4SMS",
      },
      createdAt,
      updatedAt: now,
      confirmedAt: initialStatus === "CONFIRMED" ? createdAt : undefined,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          orderId: payload.id || `ord-${count}`,
          timestamp: createdAt,
          user: payload.source === "WEBSITE" ? "WooCommerce Webhook" : "WhatsApp Integration",
          role: "ORDER_STAFF",
          action: "Order Created",
          details: `Imported via integration (Ext ID: ${payload.externalOrderId})`,
        },
        {
          id: `tl-${Date.now() + 50}`,
          orderId: payload.id || `ord-${count}`,
          timestamp: new Date(new Date(createdAt).getTime() + 1000).toISOString(),
          user: "Orders System",
          role: "ORDER_STAFF",
          action: "Processing Started",
          details: "Order placed in Processing workflow",
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

      // Courier Missing LLR only for orders that have actually been picked up by courier in Courier Hub
      const isPickedUp =
        o.dispatch?.courierStatus === "PICKED_UP" ||
        o.dispatch?.courierStatus === "DELIVERED" ||
        o.dispatch?.courierStatus === "SHIPPED" ||
        Boolean(o.dispatch?.pickedUpAt);

      if (isPickedUp && o.dispatch?.courierName === "ST Courier") {
        const hasLlr =
          o.dispatch.llrNumber &&
          o.dispatch.llrNumber.trim() &&
          o.dispatch.llrNumber !== o.dispatch.dispatchId &&
          !o.dispatch.llrNumber.toLowerCase().startsWith("dsp");

        if (!hasLlr) {
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

  appendOrderTimelineEvent(
    orderIdOrNumber: string,
    event: ActivityLog,
    extraOrderUpdates?: Partial<Order>
  ): boolean {
    const orderIndex = globalOrders.findIndex(
      (o) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber
    );
    if (orderIndex === -1) return false;

    const targetOrder = globalOrders[orderIndex];
    const updatedOrder: Order = {
      ...targetOrder,
      ...extraOrderUpdates,
      updatedAt: event.timestamp || new Date().toISOString(),
      timeline: [...targetOrder.timeline, event],
    };

    globalOrders[orderIndex] = updatedOrder;
    persistOrders(globalOrders);

    if (isSupabaseConfigured()) {
      updateSupabaseOrderStatus(
        targetOrder.id,
        updatedOrder.orderStatus,
        event,
        updatedOrder.dispatch?.dispatchId
      );
    }
    return true;
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
    returnDate?: string;
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
    const now = params.returnDate
      ? (params.returnDate.includes("T") ? params.returnDate : new Date(params.returnDate).toISOString())
      : new Date().toISOString();

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
      returnDate: params.returnDate,
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

    // 24. Return events must also appear inside the master order timeline
    this.appendOrderTimelineEvent(order.id, {
      id: `tl-${Date.now()}-ret-req`,
      orderId: order.id,
      timestamp: now,
      user: globalUser.name,
      role: globalUser.role,
      action: "Return Requested",
      details: `Return case ${returnId} initiated from Packing Station (Type: ${params.returnType}, Reason: ${params.reason}, Qty: ${totalRequestedQty})`,
      eventType: "RETURN",
    }, {
      linkedReturnId: returnId,
      orderStatus: "RETURN",
    });

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

    // 24. Return events must also appear inside the master order timeline
    const actionMap: Record<string, string> = {
      "Approved": "Return Approved",
      "Awaiting Return": "Awaiting Return",
      "Return Received": "Return Received",
      "QC Pending": "QC Pending",
      "QC Approved": "QC Approved",
      "Refund Pending": "Refund Pending",
      "Refunded": "Refund Completed",
      "Rejected": "Return Rejected",
      "Completed": "Return Completed",
      "Cancelled": "Return Cancelled",
    };
    const actionName = actionMap[newStatus] || `Return ${newStatus}`;
    this.appendOrderTimelineEvent(target.orderId, {
      id: `tl-${Date.now()}-ret-status`,
      orderId: target.orderId,
      timestamp: now,
      user: actionUser,
      role: actionRole,
      action: actionName,
      details: notes || `Return case ${target.returnId} status updated to ${newStatus}`,
      eventType: "RETURN",
    });

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

    // 24. Return events must also appear inside the master order timeline
    this.appendOrderTimelineEvent(target.orderId, {
      id: `tl-${Date.now()}-ret-recv`,
      orderId: target.orderId,
      timestamp: now,
      user: receiver,
      role: globalUser.role,
      action: "Return Received",
      details: `Physical return parcel checked in by ${receiver}. Expected: ${target.requestedQuantity}, Received: ${totalReceived}${shortNote}. Note: ${params.receivingNote || "Parcel in warehouse"}`,
      eventType: "RETURN",
    });

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

    // 24. Return events must also appear inside the master order timeline
    this.appendOrderTimelineEvent(target.orderId, {
      id: `tl-${Date.now()}-ret-qc`,
      orderId: target.orderId,
      timestamp: now,
      user: inspector,
      role: globalUser.role,
      action: params.qcResult === "Rejected" ? "QC Rejected" : "QC Approved",
      details: timelineNotes,
      eventType: "RETURN",
    });

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
    const nextStatus: ReturnStatus = isRefundCompleted ? "Refunded" : "Refund Pending";

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

    // 24. Return events must also appear inside the master order timeline
    this.appendOrderTimelineEvent(target.orderId, {
      id: `tl-${Date.now()}-ret-ref`,
      orderId: target.orderId,
      timestamp: now,
      user: processor,
      role: globalUser.role,
      action: isRefundCompleted ? "Refund Completed" : "Refund Processing",
      details: `Refund ${params.refundStatus}: ₹${refundAmount} via ${refundRecord.refundMethod}${refundRecord.utrReference ? ` (UTR: ${refundRecord.utrReference})` : ""}. Note: ${params.refundNotes || "Processed"}`,
      eventType: "RETURN",
    });

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
      status: "Exchanged",
      replacement: replacementRecord,
      updatedAt: now,
      timeline: [...target.timeline, timelineEntry],
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    // 24 & 25. Replacement events appear inside master order timeline
    this.appendOrderTimelineEvent(target.orderId, {
      id: `tl-${Date.now()}-ret-rep-create`,
      orderId: target.orderId,
      timestamp: now,
      user: globalUser.name,
      role: globalUser.role,
      action: "Replacement Created",
      details: `Replacement task ${repId} created (${replacementRecord.replacementItem}, Qty: ${replacementRecord.quantity})`,
      eventType: "REPLACEMENT",
    }, {
      linkedReplacementId: repId,
    });

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
      nextReturnStatus = "Dispatched";
    } else if (newStatus === "Delivered") {
      nextReturnStatus = "Completed";
    }

    const actionTitle = newStatus === "Packing" ? "Replacement Packing Started" : newStatus === "Packed" ? "Replacement Packed" : newStatus === "Dispatched" ? "Replacement Dispatched" : "Replacement Completed";
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

    // 24 & 25. Replacement events appear inside master order timeline
    this.appendOrderTimelineEvent(target.orderId, {
      id: `tl-${Date.now()}-ret-rep-disp`,
      orderId: target.orderId,
      timestamp: now,
      user: globalUser.name,
      role: globalUser.role,
      action: actionTitle,
      details: actionDetails,
      eventType: "REPLACEMENT",
    });

    return { success: true };
  },

  setDispatchNumber(
    returnId: string,
    dispatchNumber: string
  ): { success: boolean; error?: string } {
    const index = globalReturns.findIndex((r) => r.id === returnId || r.returnId === returnId);
    if (index === -1) return { success: false, error: "Return case not found" };

    const target = globalReturns[index];
    const now = new Date().toISOString();

    const timelineEntry: ReturnTimelineEvent = {
      id: `tl-${Date.now()}`,
      returnId: target.returnId,
      action: "Dispatched",
      user: globalUser.name,
      role: globalUser.role,
      notes: `Dispatch number entered: ${dispatchNumber}. Status updated to Dispatched.`,
      timestamp: now,
    };

    const updatedCase: ReturnCase = {
      ...target,
      status: "Dispatched" as ReturnStatus,
      dispatchNumber,
      updatedAt: now,
      timeline: [...target.timeline, timelineEntry],
    };

    const newReturns = [...globalReturns];
    newReturns[index] = updatedCase;
    persistReturns(newReturns);

    return { success: true };
  },
};


