import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { detectWooCommerceSource, parseWooCommerceDate } from "@/lib/woocommerce-source";
import { OrderStatus } from "@/types/orderflow";

export async function GET() {
  return NextResponse.json({ status: "active", message: "SuperCollection WooCommerce Webhook Endpoint is live" }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * WooCommerce Order Webhook Endpoint
 * Ingests orders created in WooCommerce store directly into SuperCollection Work Desk
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const topic = (req.headers.get("x-wc-webhook-topic") || "").toLowerCase();

    // 1. Handle WooCommerce Ping / Handshake verification (Returns 200 OK immediately)
    if (topic.includes("ping") || !rawBody || !rawBody.trim()) {
      return NextResponse.json({
        success: true,
        message: "WooCommerce Webhook ping successfully acknowledged",
      }, { status: 200 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Non-JSON ping
      return NextResponse.json({
        success: true,
        message: "Webhook ping received",
      }, { status: 200 });
    }

    // If payload is a WooCommerce test ping payload: { "webhook_id": ... }
    if (body.webhook_id && !body.id && !body.line_items) {
      return NextResponse.json({
        success: true,
        message: "WooCommerce Webhook test acknowledged",
        webhookId: body.webhook_id,
      }, { status: 200 });
    }

    const wcId = String(body.id || body.number || Date.now());
    const customerName = `${body.billing?.first_name || ""} ${body.billing?.last_name || ""}`.trim() || body.shipping?.first_name || "Online Customer";
    const mobile = (body.billing?.phone || body.shipping?.phone || "+91 98000 00000").trim();
    const address = [body.shipping?.address_1, body.shipping?.address_2].filter(Boolean).join(", ") || body.billing?.address_1 || "Customer Address";
    const city = body.shipping?.city || body.billing?.city || "Chennai";
    const state = body.shipping?.state || body.billing?.state || "Tamil Nadu";
    const pincode = body.shipping?.postcode || body.billing?.postcode || "600001";
    const totalAmount = parseFloat(body.total || "0") || 0;

    let orderStatus: OrderStatus = "NEW";
    if (body.status === "completed") orderStatus = "COMPLETED";
    else if (body.status === "processing") orderStatus = "CONFIRMED";
    else if (body.status === "cancelled" || body.status === "refunded" || body.status === "failed") orderStatus = "RETURN";
    else orderStatus = "NEW";

    const paymentStatus = body.status === "processing" || body.status === "completed" ? "PAID" : body.payment_method === "cod" ? "COD" : "PENDING";
    const courierStatus = "PENDING"; // Webhook orders start as PENDING courier status; only dispatched orders from packing reach courier hub

    // All WooCommerce webhook orders are strictly WEBSITE source
    const orderSource: OrderSource = "WEBSITE";

    const items = (body.line_items || []).map((item: any, idx: number) => ({
      product_name: item.name || "Product",
      sku: item.sku || `SKU-${idx + 1}`,
      size: item.meta_data?.find((m: any) => m.key?.toLowerCase() === "size" || m.key?.toLowerCase() === "pa_size")?.value || "M",
      quantity: parseInt(item.quantity, 10) || 1,
      unit_price: parseFloat(item.price || "0") || 0,
      subtotal: parseFloat(item.total || "0") || 0,
    }));

    const db = supabaseAdmin || supabase;
    if (isSupabaseConfigured() && db) {
      // 1. Safe Customer Lookup / Upsert (avoid 42P10 constraint error)
      let customerId: string | null = null;
      if (mobile) {
        const { data: existingCustomer } = await db
          .from("customers")
          .select("id")
          .eq("mobile", mobile)
          .maybeSingle();

        if (existingCustomer?.id) {
          customerId = existingCustomer.id;
          await db
            .from("customers")
            .update({
              name: customerName,
              address,
              city,
              state,
              pincode,
              updated_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        }
      }

      if (!customerId) {
        const { data: newCustomer, error: custError } = await db
          .from("customers")
          .insert({
            name: customerName,
            mobile,
            address,
            city,
            state,
            pincode,
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

      // Check if order already exists in Supabase to preserve active fulfillment progression (e.g. Dispatched)
      const { data: existingOrder } = await db
        .from("orders")
        .select("id, status")
        .eq("external_order_id", wcId)
        .maybeSingle();

      let effectiveStatus: OrderStatus = orderStatus;
      if (existingOrder?.status === "DISPATCHED") {
        effectiveStatus = "DISPATCHED";
      }

      // 2. Insert/Upsert Order
      const orderNumber = `SC-WC-${wcId}`;
      const orderPayload: any = {
        order_number: orderNumber,
        external_order_id: wcId,
        source: orderSource,
        customer_id: customerId,
        status: effectiveStatus,
        payment_status: paymentStatus,
        total_amount: totalAmount,
        created_at: parseWooCommerceDate(body.date_created_gmt, body.date_created),
        updated_at: new Date().toISOString(),
      };

      let { data: order, error: orderError } = await db
        .from("orders")
        .upsert(orderPayload, { onConflict: "source,external_order_id" })
        .select()
        .single();

      // If DB enum does not support DIRECT or INSTAGRAM, fallback safely to WEBSITE
      if (orderError && (orderError.code === "22P02" || orderError.message?.includes("enum"))) {
        orderPayload.source = "WEBSITE";
        const retry = await db
          .from("orders")
          .upsert(orderPayload, { onConflict: "source,external_order_id" })
          .select()
          .single();
        order = retry.data;
        orderError = retry.error;
      }

      if (orderError) {
        console.error("Supabase order error:", orderError);
        return NextResponse.json({ error: orderError.message }, { status: 500 });
      }

      // 3. Insert items (idempotent replacement, safe deduplication)
      if (order && items.length > 0) {
        await db.from("order_items").delete().eq("order_id", order.id);

        const { data: remainingItems } = await db
          .from("order_items")
          .select("id, sku, size, product_name")
          .eq("order_id", order.id);

        const existingKeySet = new Set(
          (remainingItems || []).map((r: any) =>
            `${(r.sku || "").trim().toLowerCase()}__${(r.size || "").trim().toLowerCase()}__${(r.product_name || "").trim().toLowerCase()}`
          )
        );

        const itemsToInsert = items
          .map((it: any) => ({
            order_id: order.id,
            ...it,
          }))
          .filter((it: any) => {
            const key = `${(it.sku || "").trim().toLowerCase()}__${(it.size || "").trim().toLowerCase()}__${(it.product_name || "").trim().toLowerCase()}`;
            return !existingKeySet.has(key);
          });

        if (itemsToInsert.length > 0) {
          await db.from("order_items").insert(itemsToInsert);
        }
      }

      // 4. Initial Activity Logs (Section 2 & 3: Order Created, Processing Started, and Order Completed / Ready for Packing if completed)
      // DO NOT automatically create Courier Hub dispatch record or assign ST Courier (Section 7)
      if (order) {
        const orderPlacedAt = parseWooCommerceDate(body.date_created_gmt, body.date_created);
        const orderPlacedMs = new Date(orderPlacedAt).getTime();
        const initialLogs: any[] = [
          {
            order_id: order.id,
            user_name: "WooCommerce",
            user_role: "SYSTEM",
            action: "Order Created",
            details: "Order created in WooCommerce",
            created_at: orderPlacedAt,
          },
          {
            order_id: order.id,
            user_name: "WooCommerce",
            user_role: "SYSTEM",
            action: "Processing Started",
            details: "Order processing started",
            created_at: new Date(orderPlacedMs + 1000).toISOString(),
          },
        ];

        if (body.status === "completed") {
          const completedTimestamp = parseWooCommerceDate(body.date_modified_gmt, body.date_modified) || new Date(orderPlacedMs + 2000).toISOString();
          initialLogs.push(
            {
              order_id: order.id,
              user_name: "WooCommerce",
              user_role: "SYSTEM",
              action: "Order Completed",
              details: "Order completed in WooCommerce",
              created_at: completedTimestamp,
            },
            {
              order_id: order.id,
              user_name: "Packing Station",
              user_role: "PACKING_STAFF",
              action: "Waiting for Packing",
              details: "Order completed, waiting for packing in fulfillment station",
              created_at: new Date(new Date(completedTimestamp).getTime() + 1000).toISOString(),
            }
          );
        }

        await db.from("activity_logs").insert(initialLogs);
      }

      return NextResponse.json({
        success: true,
        message: "Order ingested into Supabase successfully",
        orderNumber,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: "Order received (Supabase in local mode)",
      orderNumber: `SC-WC-${wcId}`,
    }, { status: 200 });
  } catch (err: any) {
    console.error("WooCommerce Webhook Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Server error" }, { status: 200 });
  }
}
