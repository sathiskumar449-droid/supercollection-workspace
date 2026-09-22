import { createClient } from "@supabase/supabase-js";
import { Order, OrderStatus, CourierStatus, SmsStatus, Customer, OrderItem, DispatchInfo, SmsInfo, ActivityLog } from "@/types/orderflow";

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
        dispatch:dispatches(*),
        sms:sms_logs(*),
        timeline:activity_logs(*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders from Supabase:", error);
      return null;
    }

    if (!dbOrders) return [];

    return dbOrders.map((raw: any): Order => {
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
      const dispatchInfo: DispatchInfo = {
        courierId: rawDispatch?.courier_id || rawDispatch?.courierId || raw.courier_id || "cour-1",
        courierName: rawDispatch?.courier_name || rawDispatch?.courierName || "ST Courier",
        courierPartnerId: rawDispatch?.courier_partner_id || rawDispatch?.courierPartnerId || (rawDispatch?.courier_name === "Professional Courier" ? "PROFESSIONAL" : rawDispatch?.courier_name === "DTDC" ? "DTDC" : "ST_COURIER"),
        dispatchId: rawDispatch?.dispatch_id || rawDispatch?.dispatchId || undefined,
        llrNumber: rawDispatch?.llr_number || rawDispatch?.llrNumber || undefined,
        pickupPhone: rawDispatch?.pickup_phone || rawDispatch?.pickupPhone || undefined,
        courierStatus: (rawDispatch?.courier_status || rawDispatch?.courierStatus || "WAITING_FOR_PICKUP") as CourierStatus,
        dispatchedAt: rawDispatch?.dispatched_at || rawDispatch?.dispatchedAt || raw.dispatched_at,
        pickedUpAt: rawDispatch?.picked_up_at || rawDispatch?.pickedUpAt,
        deliveredAt: rawDispatch?.shipped_at || rawDispatch?.delivered_at || rawDispatch?.deliveredAt || raw.shipped_at,
        notes: rawDispatch?.notes,
      };

      const rawSms = Array.isArray(raw.sms) ? raw.sms[0] : raw.sms;
      const smsInfo: SmsInfo = {
        status: (rawSms?.status || (dispatchInfo.courierStatus === "SHIPPED" ? "SENT" : "PENDING")) as SmsStatus,
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
        source: raw.source,
        customer: cust,
        items,
        totalAmount: Number(raw.total_amount) || 0,
        paymentStatus: raw.payment_status,
        orderStatus: raw.status,
        dispatch: {
          courierId: dispatchInfo.courierId,
          courierName: dispatchInfo.courierName || "ST Courier",
          llrNumber: dispatchInfo.llrNumber || undefined,
          courierStatus: dispatchInfo.courierStatus || "PENDING",
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
        notes: raw.notes,
        timeline,
      };
    });
  } catch (err) {
    console.error("Supabase fetch exception:", err);
    return null;
  }
}

/**
 * Persist an order state update to Supabase
 */
export async function updateSupabaseOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  activity?: ActivityLog
): Promise<boolean> {
  const db = supabaseAdmin || supabase;
  if (!db) return false;

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

    const { error: orderError } = await db
      .from("orders")
      .update(updates)
      .eq("id", orderId);

    if (orderError) {
      console.error("Error updating order in Supabase:", orderError);
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
    console.error("Supabase status update exception:", err);
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

  try {
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (details.dispatchId !== undefined) updates.dispatch_id = details.dispatchId;
    if (details.pickupPhone !== undefined) updates.pickup_phone = details.pickupPhone;
    if (details.courierPartnerId !== undefined) updates.courier_partner_id = details.courierPartnerId;
    if (details.llrNumber !== undefined) updates.llr_number = details.llrNumber;
    if (details.courierStatus) {
      updates.courier_status = details.courierStatus;
      if (details.courierStatus === "PICKED_UP" || details.courierStatus === "SHIPPED") {
        updates.picked_up_at = new Date().toISOString();
      }
      if (details.courierStatus === "DELIVERED") {
        updates.shipped_at = new Date().toISOString();
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
      if (updateErr) console.error("Error updating dispatch in Supabase:", updateErr);
    } else {
      const { error: insertErr } = await db
        .from("dispatches")
        .insert({
          order_id: orderId,
          courier_id: details.courierId || "1646c4ed-2883-4f72-b3c8-aab24f7631b6",
          ...updates,
        });
      if (insertErr) console.error("Error inserting dispatch in Supabase:", insertErr);
    }

    // If marked as SHIPPED, record shipped_at timestamp and log SMS sent without overwriting order status (keep DISPATCHED)
    if (details.courierStatus === "SHIPPED") {
      await db.from("orders").update({
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);

      const { data: existingSms } = await db
        .from("sms_logs")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();

      if (existingSms) {
        await db.from("sms_logs").update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", existingSms.id);
      } else {
        await db.from("sms_logs").insert({
          order_id: orderId,
          mobile: "N/A",
          provider: "Ping4SMS",
          status: "SENT",
          sent_at: new Date().toISOString(),
        });
      }
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
