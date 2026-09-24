import { createClient } from "@supabase/supabase-js";
import { Order, OrderStatus, CourierStatus, SmsStatus, Customer, OrderItem, DispatchInfo, SmsInfo, ActivityLog, OrderSource } from "@/types/orderflow";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("your-project-id")
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabaseAdmin = (isSupabaseConfigured() && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : supabase;

// ==============================================================================
// SUPABASE DATA LAYER
// ==============================================================================

/**
 * Fetch all orders from Supabase with relational joins
 */
export async function fetchSupabaseOrders(): Promise<Order[] | null> {
  if (!supabase) return null;

  try {
    const { data: dbOrders, error } = await supabase
      .from("orders")
      .select(`
        *,
        customer:customers(*),
        items:order_items(*),
        dispatch:dispatches(*, courier:couriers(*)),
        sms:sms_logs(*),
        timeline:activity_logs(*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders from Supabase:", error);
      return null;
    }

    if (!dbOrders) return [];

    return dbOrders
      .filter((raw: any) => {
        const isWc = raw.source === "WEBSITE" || String(raw.order_number || "").startsWith("SC-WC-");
        // Exclude pending (NEW) and cancelled/failed/refunded (RETURN) WooCommerce orders
        if (isWc && (raw.status === "NEW" || raw.status === "RETURN")) {
          return false;
        }
        return true;
      })
      .map((raw: any): Order => {
      const cust: Customer = raw.customer || {
        id: raw.customer_id || "cust-unknown",
        name: "Unknown Customer",
        mobile: "N/A",
        address: "N/A",
        city: "N/A",
        state: "N/A",
        pincode: "N/A",
        totalOrders: 1,
      };

      const rawDispatch = Array.isArray(raw.dispatch) ? raw.dispatch[0] : raw.dispatch;
      const defaultCourierStatus: CourierStatus = "PENDING";
      const courierObj = rawDispatch?.courier;

      // Check if courier was explicitly assigned
      const notesStr = String(rawDispatch?.notes || "");
      const explicitCourierMatch = notesStr.match(/assigned_courier:([a-zA-Z0-9_\s]+)/);
      const explicitCourierName = explicitCourierMatch ? explicitCourierMatch[1].trim() : undefined;

      // Only actively assigned if courier partner or actual pickup/LLR exists (DISPATCHED alone does NOT assign courier)
      const isActivelyAssigned = Boolean(explicitCourierName) ||
                                Boolean(rawDispatch?.courier_partner_id) ||
                                (rawDispatch?.courier_status && rawDispatch.courier_status !== "PENDING") ||
                                Boolean(rawDispatch?.picked_up_at) ||
                                Boolean(rawDispatch?.llr_number);

      let resolvedCourierName: string | undefined = undefined;
      let resolvedPartnerCode: string | undefined = undefined;

      if (isActivelyAssigned) {
        resolvedCourierName = explicitCourierName || rawDispatch?.courier_name || courierObj?.name || undefined;
        resolvedPartnerCode = rawDispatch?.courier_partner_id || courierObj?.code || 
          (resolvedCourierName?.includes("Professional") ? "PROFESSIONAL" : resolvedCourierName?.includes("DTDC") ? "DTDC" : (resolvedCourierName?.includes("ST") ? "ST_COURIER" : undefined));
      }

      const notesMatch = raw.notes ? String(raw.notes).match(/dispatch_id:([^\s;|]+)/) : null;
      const parsedDispatchId = rawDispatch?.dispatch_id || rawDispatch?.dispatchId || (notesMatch ? notesMatch[1] : undefined);

      const rawLlr = String(rawDispatch?.llr_number || rawDispatch?.llrNumber || "").trim();
      const hasValidLlr = Boolean(
        rawLlr && 
        rawLlr.toLowerCase() !== "pending" && 
        rawLlr.toLowerCase() !== "available" && 
        rawLlr.toLowerCase() !== "/available" &&
        !rawLlr.toLowerCase().startsWith("dsp") &&
        rawLlr !== parsedDispatchId
      );

      let resolvedCourierStatus: CourierStatus = defaultCourierStatus;
      const rawCStatus = rawDispatch?.courier_status || rawDispatch?.courierStatus;
      if (hasValidLlr) {
        resolvedCourierStatus = "SHIPPED";
      } else if (rawCStatus === "PICKED_UP" || rawDispatch?.picked_up_at || notesStr.includes("courier_status:PICKED_UP")) {
        resolvedCourierStatus = "PICKED_UP";
      } else if (rawCStatus && rawCStatus !== "SHIPPED" && rawCStatus !== "DELIVERED") {
        resolvedCourierStatus = rawCStatus as CourierStatus;
      }

      const dispatchInfo: DispatchInfo = {
        courierId: isActivelyAssigned ? (rawDispatch?.courier_id || courierObj?.id) : undefined,
        courierName: resolvedCourierName,
        courierPartnerId: resolvedPartnerCode,
        dispatchId: parsedDispatchId,
        llrNumber: hasValidLlr ? rawLlr : undefined,
        pickupPhone: rawDispatch?.pickup_phone || rawDispatch?.pickupPhone || undefined,
        verifiedCustomerPhone: rawDispatch?.verified_customer_phone || cust.mobile,
        courierStatus: resolvedCourierStatus,
        dispatchedAt: rawDispatch?.dispatched_at || rawDispatch?.dispatchedAt || raw.dispatched_at,
        pickedUpAt: rawDispatch?.picked_up_at || rawDispatch?.pickedUpAt,
        deliveredAt: undefined,
        shippedAt: hasValidLlr ? (rawDispatch?.shipped_at || rawDispatch?.delivered_at || rawDispatch?.deliveredAt || raw.shipped_at) : undefined,
        notes: rawDispatch?.notes,
      };

      const rawSms = Array.isArray(raw.sms) ? raw.sms[0] : raw.sms;
      const smsInfo: SmsInfo = {
        status: (rawSms?.status === "SENT" ? "SENT" : rawSms?.status === "FAILED" ? "FAILED" : "PENDING") as SmsStatus,
        provider: rawSms?.provider || "Ping4SMS",
        providerMessageId: rawSms?.provider_message_id || rawSms?.providerMessageId,
        sentAt: rawSms?.sent_at || rawSms?.sentAt,
        deliveredAt: rawSms?.delivered_at || rawSms?.deliveredAt,
      };

      const timeline: ActivityLog[] = (raw.timeline || []).map((t: any): ActivityLog => ({
        id: t.id,
        orderId: t.order_id,
        timestamp: t.created_at,
        user: t.user_name,
        role: t.user_role,
        action: t.action,
        details: t.details || undefined,
        oldValue: t.old_value || undefined,
        newValue: t.new_value || undefined,
      }));

      // Safely deduplicate items against duplicate sync rows
      const uniqueItemsMap = new Map<string, OrderItem>();
      (raw.items || []).forEach((it: any) => {
        const itemKey = `${(it.sku || "").trim().toLowerCase()}__${(it.size || "").trim().toLowerCase()}__${(it.product_name || "").trim().toLowerCase()}`;
        if (!uniqueItemsMap.has(itemKey)) {
          uniqueItemsMap.set(itemKey, {
            id: it.id,
            productId: it.product_id || it.id,
            productName: it.product_name,
            sku: it.sku || "OF-ITEM",
            size: it.size || "M",
            color: it.color || undefined,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unit_price) || 0,
            subtotal: Number(it.subtotal) || 0,
          });
        }
      });
      const items: OrderItem[] = Array.from(uniqueItemsMap.values());

      return {
        id: raw.id,
        orderNumber: raw.order_number,
        externalOrderId: raw.external_order_id,
        source: (String(raw.order_number || "").startsWith("SC-WC-") ? "WEBSITE" : raw.source) as OrderSource,
        customer: cust,
        items,
        totalAmount: Number(raw.total_amount) || 0,
        paymentStatus: raw.payment_status,
        orderStatus: raw.status,
        dispatch: {
          courierId: dispatchInfo.courierId,
          courierName: dispatchInfo.courierName || undefined,
          courierPartnerId: dispatchInfo.courierPartnerId,
          dispatchId: dispatchInfo.dispatchId,
          pickupPhone: dispatchInfo.pickupPhone,
          llrNumber: dispatchInfo.llrNumber || undefined,
          courierStatus: dispatchInfo.courierStatus,
          dispatchedAt: dispatchInfo.dispatchedAt,
          deliveredAt: dispatchInfo.deliveredAt,
          notes: dispatchInfo.notes,
        },
        sms: {
          status: smsInfo.status || "PENDING",
          provider: smsInfo.provider || "Ping4SMS",
          providerMessageId: smsInfo.providerMessageId,
          sentAt: smsInfo.sentAt,
          deliveredAt: smsInfo.deliveredAt,
        },
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        confirmedAt: raw.confirmed_at,
        packingStartedAt: raw.packing_started_at,
        packedAt: raw.packed_at,
        dispatchedAt: raw.dispatched_at,
        pickedUpAt: dispatchInfo.pickedUpAt,
        shippedAt: dispatchInfo.shippedAt,
        notes: raw.notes,
        pendingReason: raw.pending_reason || (raw.status === "NEW" && raw.notes?.includes("Reason:") 
          ? raw.notes.split("Reason:")[1]?.split("|")[0]?.trim() 
          : (raw.status === "NEW" ? raw.notes : undefined)),
        pendingNote: raw.pending_note || (raw.status === "NEW" && raw.notes?.includes("Note:") 
          ? raw.notes.split("Note:")[1]?.trim() 
          : undefined),
        pendingAt: raw.pending_at,
        pendingBy: raw.pending_by,
        timeline,
      };
    });
  } catch (err) {
    console.error("Supabase fetch exception:", err);
    return null;
  }
}

let cachedCourierMap: Record<string, string> | null = null;

async function getCourierIdByCode(db: any, code: string): Promise<string | null> {
  try {
    if (!cachedCourierMap) {
      const { data } = await db.from("couriers").select("id, code, is_st_courier");
      if (data && data.length > 0) {
        cachedCourierMap = {};
        data.forEach((c: any) => {
          cachedCourierMap![c.code] = c.id;
          if (c.is_st_courier) cachedCourierMap!["DEFAULT"] = c.id;
        });
      }
    }
    return cachedCourierMap?.[code] || cachedCourierMap?.["DEFAULT"] || null;
  } catch {
    return null;
  }
}

/**
 * Persist an order state update to Supabase
 */
export async function updateSupabaseOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  activity?: ActivityLog,
  dispatchId?: string
): Promise<boolean> {
  const db = supabaseAdmin || supabase;
  if (!db) return false;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  if (!isUuid) return true;

  try {
    const updates: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "CONFIRMED") updates.confirmed_at = updates.updated_at;
    if (newStatus === "PACKING") updates.packing_started_at = updates.updated_at;
    if (newStatus === "PACKED") updates.packed_at = updates.updated_at;
    if (newStatus === "DISPATCHED") updates.dispatched_at = updates.updated_at;
    if (newStatus === "COMPLETED") updates.shipped_at = updates.updated_at;

    if (dispatchId !== undefined) {
      const { data: existingOrd } = await db.from("orders").select("notes").eq("id", orderId).maybeSingle();
      let currentNotes = existingOrd?.notes || "";
      currentNotes = currentNotes.replace(/(\s*\|\s*)?dispatch_id:[^\s;|]+/g, "").trim();
      if (dispatchId) {
        updates.notes = currentNotes ? `${currentNotes} | dispatch_id:${dispatchId}` : `dispatch_id:${dispatchId}`;
      } else {
        updates.notes = currentNotes || null;
      }
    }

    const { error: orderError } = await db
      .from("orders")
      .update(updates)
      .eq("id", orderId);

    if (orderError) {
      console.warn("Supabase order update warning:", orderError?.message || orderError);
      return false;
    }

    if (activity) {
      await db.from("activity_logs").insert({
        order_id: orderId,
        user_name: activity.user,
        user_role: activity.role,
        action: activity.action,
        details: activity.details || null,
        old_value: activity.oldValue || null,
        new_value: activity.newValue || null,
        created_at: activity.timestamp || new Date().toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.warn("Supabase status update exception:", err);
    return false;
  }
}

/**
 * Update Courier Dispatch and LLR in Supabase
 */
export async function updateSupabaseCourierDetails(
  orderId: string,
  details: Partial<DispatchInfo>,
  activity?: ActivityLog
): Promise<boolean> {
  const db = supabaseAdmin || supabase;
  if (!db) return false;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  if (!isUuid) return true;

  try {
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (details.dispatchId !== undefined) {
      updates.dispatch_id = details.dispatchId && details.dispatchId.trim() ? details.dispatchId.trim() : null;
    }
    if (details.pickupPhone !== undefined) {
      updates.pickup_phone = details.pickupPhone && details.pickupPhone.trim() ? details.pickupPhone.trim() : null;
    }
    if (details.courierPartnerId !== undefined) {
      updates.courier_partner_id = details.courierPartnerId || null;
    }
    if (details.llrNumber !== undefined) {
      updates.llr_number = details.llrNumber && details.llrNumber.trim() ? details.llrNumber.trim() : null;
    }

    if (details.courierName || details.courierPartnerId) {
      const cName = details.courierName || (details.courierPartnerId === "PROFESSIONAL" ? "Professional Courier" : details.courierPartnerId === "DTDC" ? "DTDC" : "ST Courier");
      const partnerCode = details.courierPartnerId || (cName.includes("Professional") ? "PROFESSIONAL" : cName.includes("DTDC") ? "DTDC" : "ST_COURIER");
      updates.courier_partner_id = partnerCode;
      updates.notes = `assigned_courier:${cName}`;

      const realCourierId = await getCourierIdByCode(db, partnerCode);
      if (realCourierId) {
        updates.courier_id = realCourierId;
      }
    }

    if (details.verifiedCustomerPhone) {
      updates.verified_customer_phone = details.verifiedCustomerPhone;
    }
    if (details.pickedUpAt) {
      updates.picked_up_at = details.pickedUpAt;
    }
    if (details.shippedAt) {
      updates.shipped_at = details.shippedAt;
    }

    if (details.courierStatus) {
      // PostgreSQL enum courier_status only accepts 'PENDING' and 'SHIPPED'
      const pgStatus = (details.courierStatus === "PICKED_UP" || details.courierStatus === "DELIVERED" || details.courierStatus === "SHIPPED")
        ? "SHIPPED"
        : "PENDING";
      updates.courier_status = pgStatus;

      const currentNotes = updates.notes || "";
      if (details.courierStatus === "PICKED_UP") {
        updates.picked_up_at = details.pickedUpAt || new Date().toISOString();
        updates.notes = currentNotes ? `${currentNotes};courier_status:PICKED_UP` : "courier_status:PICKED_UP";
      }
      if (details.courierStatus === "SHIPPED") {
        updates.shipped_at = details.shippedAt || new Date().toISOString();
        updates.notes = currentNotes ? `${currentNotes};courier_status:SHIPPED` : "courier_status:SHIPPED";
      }
    }

    // Check if dispatch record exists
    const { data: existingDispatch } = await db
      .from("dispatches")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingDispatch) {
      const { error: updateErr } = await db
        .from("dispatches")
        .update(updates)
        .eq("order_id", orderId);
      if (updateErr) {
        // If unique constraint or foreign key constraint hit, retry without conflicting fields
        if (updateErr.code === "23505" && updates.dispatch_id) {
          const fallbackUpdates = { ...updates };
          delete fallbackUpdates.dispatch_id;
          await db.from("dispatches").update(fallbackUpdates).eq("order_id", orderId);
        } else {
          console.warn("Supabase dispatch update warning:", updateErr?.message || updateErr);
        }
      }
    } else {
      let courierIdToUse: string | null = null;
      if (updates.courier_partner_id) {
        courierIdToUse = await getCourierIdByCode(db, updates.courier_partner_id);
      }
      const insertPayload: any = {
        order_id: orderId,
        ...updates,
      };
      if (courierIdToUse && !insertPayload.courier_id) {
        insertPayload.courier_id = courierIdToUse;
      }
      const { error: insertErr } = await db
        .from("dispatches")
        .insert(insertPayload);
      if (insertErr) {
        console.warn("Supabase dispatch insert warning:", insertErr?.message || insertErr);
      }
    }

    // If marked as SHIPPED or PICKED_UP, record shipped_at timestamp without overwriting SMS status
    if (details.courierStatus === "SHIPPED" || details.courierStatus === "PICKED_UP") {
      await db.from("orders").update({
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
    }

    if (activity) {
      await db.from("activity_logs").insert({
        order_id: orderId,
        user_name: activity.user,
        user_role: activity.role,
        action: activity.action,
        details: activity.details || null,
        old_value: activity.oldValue || null,
        new_value: activity.newValue || null,
        created_at: activity.timestamp || new Date().toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error("Supabase courier update exception:", err);
    return false;
  }
}

/**
 * Update SMS Status in Supabase
 */
export async function updateSupabaseSmsStatus(orderId: string, status: SmsStatus) {
  const db = supabaseAdmin || supabase;
  if (!db) return false;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  if (!isUuid) return true;

  try {
    const { data: existingSms } = await db
      .from("sms_logs")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingSms) {
      await db.from("sms_logs").update({
        status,
        sent_at: status === "SENT" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", existingSms.id);
    } else {
      await db.from("sms_logs").insert({
        order_id: orderId,
        mobile: "N/A",
        provider: "Ping4SMS",
        status,
        sent_at: status === "SENT" ? new Date().toISOString() : null,
      });
    }
  } catch (err) {
    console.warn("Supabase updateSupabaseSmsStatus warning:", err);
  }
}

/**
 * Subscribe to live real-time database changes
 */
export function subscribeToSupabaseRealtime(onUpdate: () => void) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel("supercollection-live-orders")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      onUpdate();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "dispatches" }, () => {
      onUpdate();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "sms_logs" }, () => {
      onUpdate();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
