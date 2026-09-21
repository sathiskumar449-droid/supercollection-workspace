import { NextRequest, NextResponse } from "next/server";
import { orderflowStore } from "@/lib/store";

/**
 * Existing WhatsApp Chat Box Webhook Endpoint
 * Ingests orders finalized inside the existing WhatsApp chat box.
 * Source is strictly WHATSAPP.
 * Does NOT handle customer messaging or chat.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const externalOrderId = String(body.chat_order_id || body.order_id || `WA-${Date.now()}`);
    const customerName = String(body.customer_name || "WhatsApp Shopper");
    const mobile = String(body.mobile || body.phone || "+91 98400 12345");
    const shippingAddress = String(body.address || "WhatsApp Delivery Address");

    const rawItems = (body.items || []) as Array<{
      product_name?: string;
      size?: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "Free Size";
      quantity?: number;
      price?: number;
    }>;

    const items = rawItems.map((item, idx) => ({
      id: `wa-item-${idx}`,
      productId: `wa-prod-${idx}`,
      productName: item.product_name || "Handloom Apparel",
      sku: `WA-SKU-${idx}`,
      size: item.size || "Free Size",
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.price) || 1499,
      subtotal: (Number(item.price) || 1499) * (Number(item.quantity) || 1),
    }));

    const totalAmount = Number(body.total_amount) || items.reduce((sum, it) => sum + it.subtotal, 1499);

    const result = orderflowStore.ingestWebhookOrder({
      source: "WHATSAPP",
      externalOrderId,
      customer: {
        id: `cust-wa-${externalOrderId}`,
        name: customerName,
        mobile,
        address: shippingAddress,
        city: body.city || "Chennai",
        state: body.state || "Tamil Nadu",
        pincode: body.pincode || "600001",
        totalOrders: 1,
      },
      items: items.length > 0 ? items : undefined,
      totalAmount,
      paymentStatus: (body.payment_mode === "COD" ? "COD" : "PAID") as "COD" | "PAID",
    });

    if (result.duplicate) {
      return NextResponse.json(
        { message: "WhatsApp order already synced", orderNumber: result.order?.orderNumber },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, orderNumber: result.order?.orderNumber, source: "WHATSAPP" },
      { status: 201 }
    );
  } catch (error) {
    console.error("WhatsApp Order Webhook error:", error);
    return NextResponse.json({ error: "Failed to ingest WhatsApp order" }, { status: 500 });
  }
}
