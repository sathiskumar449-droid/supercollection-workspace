import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * WooCommerce Order Webhook Endpoint
 * Ingests orders created in WooCommerce store directly into SuperCollection Work Desk
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Optional: verify WooCommerce webhook secret if configured
    const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    const signature = req.headers.get("x-wc-webhook-signature");
    if (webhookSecret && signature) {
      // In production, verify crypto HMAC SHA256 if needed
    }

    const wcId = String(body.id || body.number || Date.now());
    const customerName = `${body.billing?.first_name || ""} ${body.billing?.last_name || ""}`.trim() || body.shipping?.first_name || "Online Customer";
    const mobile = body.billing?.phone || body.shipping?.phone || "+91 98000 00000";
    const address = [body.shipping?.address_1, body.shipping?.address_2].filter(Boolean).join(", ") || body.billing?.address_1 || "Customer Address";
    const city = body.shipping?.city || body.billing?.city || "Chennai";
    const state = body.shipping?.state || body.billing?.state || "Tamil Nadu";
    const pincode = body.shipping?.postcode || body.billing?.postcode || "600001";
    const totalAmount = parseFloat(body.total || "0") || 0;
    const paymentStatus = body.status === "processing" || body.status === "completed" ? "PAID" : body.payment_method === "cod" ? "COD" : "PENDING";

    const items = (body.line_items || []).map((item: any, idx: number) => ({
      product_name: item.name || "Product",
      sku: item.sku || `SKU-${idx + 1}`,
      size: item.meta_data?.find((m: any) => m.key?.toLowerCase() === "size" || m.key?.toLowerCase() === "pa_size")?.value || "M",
      quantity: parseInt(item.quantity, 10) || 1,
      unit_price: parseFloat(item.price || "0") || 0,
      subtotal: parseFloat(item.total || "0") || 0,
    }));

    if (isSupabaseConfigured() && supabase) {
      // 1. Upsert Customer
      const { data: customer, error: custError } = await supabase
        .from("customers")
        .upsert({
          name: customerName,
          mobile,
          address,
          city,
          state,
          pincode,
          updated_at: new Date().toISOString(),
        }, { onConflict: "mobile" })
        .select()
        .single();

      if (custError) {
        console.error("Supabase customer error:", custError);
      }

      const customerId = customer?.id;

      // 2. Insert Order
      const orderNumber = `SC-WC-${wcId}`;
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .upsert({
          order_number: orderNumber,
          external_order_id: wcId,
          source: "WEBSITE",
          customer_id: customerId,
          status: "NEW",
          payment_status: paymentStatus,
          total_amount: totalAmount,
        }, { onConflict: "source,external_order_id" })
        .select()
        .single();

      if (orderError) {
        return NextResponse.json({ error: orderError.message }, { status: 500 });
      }

      // 3. Insert items
      if (order && items.length > 0) {
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
          courier_status: "PENDING",
        }, { onConflict: "order_id" });

        // 5. Initial Activity Log
        await supabase.from("activity_logs").insert({
          order_id: order.id,
          user_name: "WooCommerce Webhook",
          user_role: "ORDER_STAFF",
          action: "Order Ingested",
          details: `WooCommerce Order #${wcId} received and created as ${orderNumber}`,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Order ingested into Supabase successfully",
        orderNumber,
      });
    }

    // Fallback response if Supabase not yet configured
    return NextResponse.json({
      success: true,
      message: "Order received (Supabase not configured yet)",
      orderNumber: `SC-WC-${wcId}`,
    });
  } catch (err: any) {
    console.error("WooCommerce Webhook Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
