import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * WhatsApp Order Webhook / Verification Endpoint
 * Ingests orders placed via WhatsApp catalog or chat bot
 */
export async function GET(req: NextRequest) {
  // WhatsApp Webhook verification handshake
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "supercollection_wa_token";

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const waOrderId = body.externalOrderId || `WA-${Date.now().toString().slice(-6)}`;
    const customerName = body.customer?.name || body.senderName || "WhatsApp Customer";
    const mobile = body.customer?.mobile || body.from || "+91 98400 12345";
    const address = body.customer?.address || "Address provided via WhatsApp";
    const city = body.customer?.city || "Chennai";
    const state = body.customer?.state || "Tamil Nadu";
    const pincode = body.customer?.pincode || "600001";
    const totalAmount = parseFloat(body.totalAmount || "1999") || 1999;

    const items = body.items || [
      {
        product_name: "Silk Kurti Set",
        sku: "SC-WA-KURTI-01",
        size: "L",
        quantity: 1,
        unit_price: totalAmount,
        subtotal: totalAmount,
      },
    ];

    if (isSupabaseConfigured() && supabase) {
      // 1. Upsert Customer
      const { data: customer } = await supabase
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

      const customerId = customer?.id;

      // 2. Insert Order
      const orderNumber = `SC-WA-${waOrderId}`;
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .upsert({
          order_number: orderNumber,
          external_order_id: waOrderId,
          source: "WHATSAPP",
          customer_id: customerId,
          status: "NEW",
          payment_status: body.paymentStatus || "PAID",
          total_amount: totalAmount,
        }, { onConflict: "source,external_order_id" })
        .select()
        .single();

      if (orderError) {
        return NextResponse.json({ error: orderError.message }, { status: 500 });
      }

      if (order && items.length > 0) {
        await supabase.from("order_items").insert(
          items.map((it: any) => ({
            order_id: order.id,
            ...it,
          }))
        );

        await supabase.from("dispatches").upsert({
          order_id: order.id,
          courier_status: "PENDING",
        }, { onConflict: "order_id" });

        await supabase.from("activity_logs").insert({
          order_id: order.id,
          user_name: "WhatsApp Order Bot",
          user_role: "ORDER_STAFF",
          action: "Order Created",
          details: `WhatsApp Order #${waOrderId} received from ${mobile}`,
        });
      }

      return NextResponse.json({
        success: true,
        orderNumber,
        message: "WhatsApp order ingested successfully",
      });
    }

    return NextResponse.json({
      success: true,
      orderNumber: `SC-WA-${waOrderId}`,
      message: "WhatsApp order received (Supabase not configured yet)",
    });
  } catch (err: any) {
    console.error("WhatsApp Webhook Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
