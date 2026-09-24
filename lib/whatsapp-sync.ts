import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { OrderStatus, OrderSource } from "@/types/orderflow";
import { orderflowStore } from "@/lib/store";

export interface RawWhatsAppOrderItem {
  id?: string;
  productId?: string;
  product_id?: string;
  name?: string;
  productName?: string;
  product_name?: string;
  title?: string;
  quantity?: number | string;
  qty?: number | string;
  size?: string;
  color?: string;
  colour?: string;
  variant?: string;
  unit_price?: number | string;
  unitPrice?: number | string;
  price?: number | string;
  rate?: number | string;
  subtotal?: number | string;
  total?: number | string;
  total_price?: number | string;
  totalPrice?: number | string;
  sku?: string;
}

export interface RawWhatsAppOrderPayload {
  source?: string;
  external_order_id?: string | number;
  externalOrderId?: string | number;
  id?: string | number;
  order_number?: string | number;
  orderNumber?: string | number;
  created_at?: string;
  createdAt?: string;
  customer_name?: string;
  customerName?: string;
  customer_phone?: string;
  customerPhone?: string;
  phone?: string;
  mobile?: string;
  customer?: {
    name?: string;
    phone?: string;
    mobile?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  address?: string;
  delivery_address?: string;
  deliveryAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  grand_total?: number | string;
  total_amount?: number | string;
  total?: number | string;
  payment_status?: string;
  paymentStatus?: string;
  payment_method?: string;
  paymentMethod?: string;
  status?: string;
  order_status?: string;
  orderStatus?: string;
  items?: RawWhatsAppOrderItem[];
  notes?: string;
}

export interface NormalizedWhatsAppOrder {
  externalOrderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalAmount: number;
  paymentStatus: "PAID" | "COD" | "PENDING";
  orderStatus: OrderStatus;
  createdAt: string;
  source: OrderSource;
  items: Array<{
    product_name: string;
    sku: string;
    size: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "Free Size";
    color?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

/**
 * Normalize raw WhatsApp order payload from webhook or API into unified format
 */
export function normalizeWhatsAppOrder(raw: RawWhatsAppOrderPayload): NormalizedWhatsAppOrder {
  const externalOrderId = String(
    raw.external_order_id || raw.externalOrderId || raw.order_number || raw.orderNumber || raw.id || Date.now()
  ).trim();

  let orderNumber = String(raw.order_number || raw.orderNumber || "").trim();
  if (!orderNumber) {
    orderNumber = `WA-${externalOrderId}`;
  } else if (!orderNumber.startsWith("WA-") && !orderNumber.startsWith("SC-")) {
    orderNumber = `WA-${orderNumber}`;
  }

  const customerName = (
    raw.customer_name ||
    raw.customerName ||
    raw.customer?.name ||
    "WhatsApp Customer"
  ).trim();

  const customerPhone = (
    raw.customer_phone ||
    raw.customerPhone ||
    raw.phone ||
    raw.mobile ||
    raw.customer?.phone ||
    raw.customer?.mobile ||
    "+91 98000 00000"
  ).trim();

  const address = (
    raw.delivery_address ||
    raw.deliveryAddress ||
    raw.address ||
    raw.customer?.address ||
    "WhatsApp Delivery Address"
  ).trim();

  const city = raw.city || raw.customer?.city || "Chennai";
  const state = raw.state || raw.customer?.state || "Tamil Nadu";
  const pincode = raw.pincode || raw.customer?.pincode || "600001";

  // Normalize payment status
  const payStatusStr = String(raw.payment_status || raw.paymentStatus || "").toLowerCase();
  const payMethodStr = String(raw.payment_method || raw.paymentMethod || "").toLowerCase();
  let paymentStatus: "PAID" | "COD" | "PENDING" = "PAID";
  if (payStatusStr.includes("cod") || payMethodStr.includes("cod")) {
    paymentStatus = "COD";
  } else if (payStatusStr.includes("paid")) {
    paymentStatus = "PAID";
  } else if (payStatusStr.includes("pending")) {
    paymentStatus = "PENDING";
  }

  // Normalize order status:
  // In Work Desk, the fulfillment lifecycle begins at "Processing" (CONFIRMED status)
  // Processing -> Completed -> Packing -> Dispatched -> Courier -> Shipped -> SMS
  const statusStr = String(raw.status || raw.order_status || raw.orderStatus || "").toLowerCase();
  let orderStatus: OrderStatus = "CONFIRMED"; // Default: Processing
  if (statusStr.includes("completed")) {
    orderStatus = "COMPLETED";
  } else if (statusStr.includes("packed")) {
    orderStatus = "PACKED";
  } else if (statusStr.includes("pack")) {
    orderStatus = "PACKING";
  } else if (statusStr.includes("dispatch")) {
    orderStatus = "DISPATCHED";
  } else if (statusStr.includes("return") || statusStr.includes("cancel") || statusStr.includes("refund")) {
    orderStatus = "RETURN";
  } else if (statusStr.includes("processing") || statusStr.includes("confirmed") || statusStr.includes("new") || statusStr.includes("pending")) {
    orderStatus = "CONFIRMED";
  }

  // Normalize created_at date
  let createdAt = new Date().toISOString();
  if (raw.created_at || raw.createdAt) {
    try {
      const d = new Date(raw.created_at || raw.createdAt!);
      if (!isNaN(d.getTime())) {
        createdAt = d.toISOString();
      }
    } catch {}
  }

  // Normalize items
  const rawItems = Array.isArray(raw.items) && raw.items.length > 0 ? raw.items : [];
  const normalizedItems = rawItems.map((it, idx) => {
    const qty = Math.max(1, parseInt(String(it.quantity || it.qty || "1"), 10) || 1);
    const unitPrice = parseFloat(String(it.unit_price || it.unitPrice || it.price || it.rate || "0")) || 0;
    const subtotal = parseFloat(String(it.subtotal || it.total || it.total_price || it.totalPrice || "0")) || (unitPrice * qty);
    const color = (it.color || it.colour || it.variant || "").trim();
    const sizeRaw = (it.size || "M").trim();
    const allowedSizes: Array<"XS" | "S" | "M" | "L" | "XL" | "XXL" | "Free Size"> = [
      "XS", "S", "M", "L", "XL", "XXL", "Free Size"
    ];
    const size = (allowedSizes.includes(sizeRaw as any) ? sizeRaw : "M") as "XS" | "S" | "M" | "L" | "XL" | "XXL" | "Free Size";
    const productName = (it.product_name || it.productName || it.name || it.title || "WhatsApp Product").trim();
    const sku = (it.sku || `WA-SKU-${idx + 1}`).trim();

    return {
      product_name: productName,
      sku,
      size,
      color: color || undefined,
      quantity: qty,
      unit_price: unitPrice,
      subtotal,
    };
  });

  // Calculate total amount
  const computedItemsTotal = normalizedItems.reduce((acc, it) => acc + it.subtotal, 0);
  const totalAmount = parseFloat(String(raw.grand_total || raw.total_amount || raw.total || "0")) || computedItemsTotal;

  return {
    externalOrderId,
    orderNumber,
    customerName,
    customerPhone,
    address,
    city,
    state,
    pincode,
    totalAmount,
    paymentStatus,
    orderStatus,
    createdAt,
    source: "WHATSAPP",
    items: normalizedItems.length > 0 ? normalizedItems : [
      {
        product_name: "WhatsApp Order Item",
        sku: `WA-SKU-1`,
        size: "M",
        quantity: 1,
        unit_price: totalAmount,
        subtotal: totalAmount,
      },
    ],
  };
}

/**
 * Ingest WhatsApp order into Work Desk database & in-memory store
 * Deduplication key: source + external_order_id
 */
export async function ingestWhatsAppOrder(rawPayload: RawWhatsAppOrderPayload): Promise<{
  success: boolean;
  orderNumber?: string;
  orderId?: string;
  isDuplicate?: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const orderData = normalizeWhatsAppOrder(rawPayload);
    const db = supabaseAdmin || supabase;

    // 1. Ingest into Supabase if configured
    if (isSupabaseConfigured() && db) {
      // Step A: Find or upsert customer
      let customerId: string | null = null;
      if (orderData.customerPhone) {
        const { data: existingCustomer } = await db
          .from("customers")
          .select("id")
          .eq("mobile", orderData.customerPhone)
          .maybeSingle();

        if (existingCustomer?.id) {
          customerId = existingCustomer.id;
          await db
            .from("customers")
            .update({
              name: orderData.customerName,
              address: orderData.address,
              city: orderData.city,
              state: orderData.state,
              pincode: orderData.pincode,
              updated_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        }
      }

      if (!customerId) {
        const { data: newCustomer, error: custError } = await db
          .from("customers")
          .insert({
            name: orderData.customerName,
            mobile: orderData.customerPhone,
            address: orderData.address,
            city: orderData.city,
            state: orderData.state,
            pincode: orderData.pincode,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (custError) {
          console.error("Supabase customer insert error:", custError);
        }
        customerId = newCustomer?.id || null;
      }

      if (!customerId) {
        const { data: fallbackCust } = await db.from("customers").select("id").limit(1).maybeSingle();
        customerId = fallbackCust?.id || null;
      }

      if (!customerId) {
        return { success: false, error: "Could not create or locate customer record" };
      }

      // Step B: Check if order already exists in Supabase (Deduplication + Lifecycle Protection)
      const { data: existingOrder } = await db
        .from("orders")
        .select("id, status, order_number")
        .eq("source", "WHATSAPP")
        .eq("external_order_id", orderData.externalOrderId)
        .maybeSingle();

      let effectiveStatus = orderData.orderStatus;
      if (existingOrder?.status) {
        const advancedStatuses: OrderStatus[] = ["PACKING", "PACKED", "DISPATCHED", "COMPLETED"];
        if (advancedStatuses.includes(existingOrder.status)) {
          effectiveStatus = existingOrder.status;
        }
      }

      const orderPayload: any = {
        order_number: existingOrder?.order_number || orderData.orderNumber,
        external_order_id: orderData.externalOrderId,
        source: "WHATSAPP",
        customer_id: customerId,
        status: effectiveStatus,
        payment_status: orderData.paymentStatus,
        total_amount: orderData.totalAmount,
        created_at: orderData.createdAt,
        updated_at: new Date().toISOString(),
      };

      const { data: savedOrder, error: orderError } = await db
        .from("orders")
        .upsert(orderPayload, { onConflict: "source,external_order_id" })
        .select()
        .single();

      if (orderError) {
        console.error("Supabase WhatsApp order upsert error:", orderError);
        return { success: false, error: orderError.message };
      }

      const currentOrderId = savedOrder.id;

      // Step C: Insert / Replace Order Items
      if (orderData.items.length > 0 && currentOrderId) {
        await db.from("order_items").delete().eq("order_id", currentOrderId);

        // Try inserting with color column first
        const itemsWithColor = orderData.items.map((it, idx) => ({
          order_id: currentOrderId,
          product_name: it.color ? `${it.product_name} (${it.color})` : it.product_name,
          sku: it.sku || `WA-SKU-${idx + 1}`,
          size: it.size,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
          color: it.color || null,
        }));

        const { error: itemsError } = await db.from("order_items").insert(itemsWithColor);

        // If table doesn't have color column, insert without color field (color is preserved in product_name)
        if (itemsError && itemsError.message?.includes("color")) {
          const itemsWithoutColor = itemsWithColor.map(({ color, ...rest }) => rest);
          await db.from("order_items").insert(itemsWithoutColor);
        }
      }

      // Step D: Initial Activity Logs
      const { data: existingLogs } = await db
        .from("activity_logs")
        .select("id, action")
        .eq("order_id", currentOrderId);

      if (!existingLogs || existingLogs.length === 0) {
        const orderTimeMs = new Date(orderData.createdAt).getTime();
        const initialLogs: any[] = [
          {
            order_id: currentOrderId,
            user_name: "WhatsApp Integration",
            user_role: "SYSTEM",
            action: "Order Created",
            details: `WhatsApp Order #${orderData.orderNumber} ingested via integration`,
            created_at: orderData.createdAt,
          },
          {
            order_id: currentOrderId,
            user_name: "Orders System",
            user_role: "SYSTEM",
            action: "Processing Started",
            details: "Order placed in Processing fulfillment queue",
            created_at: new Date(orderTimeMs + 1000).toISOString(),
          },
        ];

        if (orderData.orderStatus === "COMPLETED") {
          initialLogs.push({
            order_id: currentOrderId,
            user_name: "WhatsApp Integration",
            user_role: "SYSTEM",
            action: "Order Completed",
            details: "Order completed in WhatsApp Chat Box",
            created_at: new Date(orderTimeMs + 2000).toISOString(),
          });
        }

        await db.from("activity_logs").insert(initialLogs);
      }
    }

    // 2. Also ingest into in-memory store for instant UI reactivity
    orderflowStore.ingestWebhookOrder({
      source: "WHATSAPP",
      externalOrderId: orderData.externalOrderId,
      orderNumber: orderData.orderNumber,
      orderStatus: orderData.orderStatus,
      totalAmount: orderData.totalAmount,
      paymentStatus: orderData.paymentStatus,
      createdAt: orderData.createdAt,
      customer: {
        id: `cust-wa-${orderData.externalOrderId}`,
        name: orderData.customerName,
        mobile: orderData.customerPhone,
        address: orderData.address,
        city: orderData.city,
        state: orderData.state,
        pincode: orderData.pincode,
        totalOrders: 1,
      },
      items: orderData.items.map((it, idx) => ({
        id: `wa-it-${orderData.externalOrderId}-${idx}`,
        productId: `prod-wa-${idx}`,
        productName: it.product_name,
        sku: it.sku,
        size: it.size,
        color: it.color,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        subtotal: it.subtotal,
      })),
    });

    return {
      success: true,
      orderNumber: orderData.orderNumber,
      message: "WhatsApp order ingested successfully",
    };
  } catch (err: any) {
    console.error("ingestWhatsAppOrder error:", err);
    return { success: false, error: err.message || "Failed to ingest WhatsApp order" };
  }
}

/**
 * Fetch and sync WhatsApp orders from the last 2 days via WhatsApp API
 */
export async function fetchAndSyncWhatsAppOrdersLast2Days(options?: {
  apiUrl?: string;
  syncSecret?: string;
}): Promise<{
  success: boolean;
  syncedCount: number;
  totalReceived: number;
  since: string;
  message?: string;
  error?: string;
}> {
  const apiUrl = (
    options?.apiUrl ||
    process.env.WHATSAPP_API_URL ||
    process.env.WHATSAPP_APP_URL ||
    "http://localhost:3001"
  ).trim().replace(/\/+$/, "");

  const syncSecret = (
    options?.syncSecret ||
    process.env.WORKDESK_SYNC_SECRET ||
    ""
  ).trim();

  if (!syncSecret) {
    return {
      success: false,
      syncedCount: 0,
      totalReceived: 0,
      since: "",
      error: "Missing WORKDESK_SYNC_SECRET. Please configure WORKDESK_SYNC_SECRET in your environment or provide it in the request.",
    };
  }

  // Calculate timestamp for strictly last 2 days (today & yesterday)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);
  const sinceIso = twoDaysAgo.toISOString();

  const fetchUrl = `${apiUrl}/api/integrations/workdesk/orders?since=${encodeURIComponent(sinceIso)}`;

  try {
    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        "x-sync-secret": syncSecret,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        syncedCount: 0,
        totalReceived: 0,
        since: sinceIso,
        error: `WhatsApp API Error (${res.status}): ${errText || res.statusText}`,
      };
    }

    const data = await res.json();
    const ordersList: RawWhatsAppOrderPayload[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.orders)
      ? data.orders
      : Array.isArray(data?.data)
      ? data.data
      : [];

    let syncedCount = 0;
    for (const rawOrder of ordersList) {
      const result = await ingestWhatsAppOrder(rawOrder);
      if (result.success) {
        syncedCount++;
      }
    }

    // Refresh store from Supabase if configured
    if (isSupabaseConfigured()) {
      await orderflowStore.refreshFromSupabase();
    }

    return {
      success: true,
      syncedCount,
      totalReceived: ordersList.length,
      since: sinceIso,
      message: `Successfully synced ${syncedCount} WhatsApp orders from the last 2 days.`,
    };
  } catch (err: any) {
    console.error("fetchAndSyncWhatsAppOrdersLast2Days network error:", err);
    return {
      success: false,
      syncedCount: 0,
      totalReceived: 0,
      since: sinceIso,
      error: `Could not connect to WhatsApp API at ${apiUrl}: ${err.message}`,
    };
  }
}
