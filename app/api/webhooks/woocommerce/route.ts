import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

    let orderStatus: "NEW" | "CONFIRMED" | "COMPLETED" | "RETURN" = "NEW";
    if (body.status === "completed") orderStatus = "COMPLETED";
    else if (body.status === "processing") orderStatus = "CONFIRMED";
    else if (body.status === "cancelled" || body.status === "refunded" || body.status === "failed") orderStatus = "RETURN";
    else orderStatus = "NEW";

    const paymentStatus = body.status === "processing" || body.status === "completed" ? "PAID" : body.payment_method === "cod" ? "COD" : "PENDING";
    const courierStatus = "PENDING"; // Webhook orders start as PENDING courier status; only dispatched orders from packing reach courier hub

    const items = (body.line_items || []).map((item: any, idx: number) => ({
      product_name: item.name || "Product",
      sku: item.sku || `SKU-${idx + 1}`,
      size: item.meta_data?.find((m: any) => m.key?.toLowerCase() === "size" || m.key?.toLowerCase() === "pa_size")?.value || "M",
      quantity: parseInt(item.quantity, 10) || 1,
      unit_price: parseFloat(item.price || "0") || 0,
      subtotal: parseFloat(item.total || "0") || 0,
    }));

    if (isSupabaseConfigured() && supabase) {
      // 1. Safe Customer Lookup / Upsert (avoid 42P10 constraint error)
      let customerId: string | null = null;
      if (mobile) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("mobile", mobile)
          .maybeSingle();

        if (existingCustomer?.id) {
          customerId = existingCustomer.id;
          await supabase
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
        const { data: newCustomer, error: custError } = await supabase
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
        const { data: fallbackCust } = await supabase.from("customers").select("id").limit(1).maybeSingle();
        customerId = fallbackCust?.id || null;
      }

      // 2. Insert/Upsert Order
      const orderNumber = `SC-WC-${wcId}`;
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .upsert({
          order_number: orderNumber,
          external_order_id: wcId,
          source: "WEBSITE",
          customer_id: customerId,
          status: orderStatus,
          payment_status: paymentStatus,
          total_amount: totalAmount,
          created_at: body.date_created ? new Date(body.date_created).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "source,external_order_id" })
        .select()
        .single();

      if (orderError) {
        console.error("Supabase order error:", orderError);
        return NextResponse.json({ error: orderError.message }, { status: 500 });
      }

      // 3. Insert items (idempotent replacement)
      if (order && items.length > 0) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("order_items").insert(
          items.map((it: any) => ({
            order_id: order.id,
            ...it,
          }))
        );
      }

      // 4. Initial Dispatch record
      if (order) {
        const { data: stCourier } = await supabase
          .from("couriers")
          .select("id")
          .eq("code", "ST_COURIER")
          .maybeSingle();

        await supabase.from("dispatches").upsert({
          order_id: order.id,
          courier_id: stCourier?.id || null,
          courier_status: courierStatus,
        }, { onConflict: "order_id" });

        // 5. Initial Activity Log
        await supabase.from("activity_logs").insert({
          order_id: order.id,
          user_name: "WooCommerce Webhook",
          user_role: "ORDER_STAFF",
          action: "Order Ingested",
          details: `WooCommerce Order #${wcId} received and processed as ${orderNumber}`,
        });
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
