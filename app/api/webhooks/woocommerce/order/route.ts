import { NextRequest, NextResponse } from "next/server";
import { orderflowStore } from "@/lib/store";

/**
 * WooCommerce Webhook Endpoint
 * Ingests orders created on the website.
 * Prevents duplicates via WooCommerce Order ID.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Optional secret verification header if configured
    const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    const signature = request.headers.get("x-wc-webhook-signature");
    if (webhookSecret && !signature) {
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
    }

    const wcId = String(body.id || body.order_id || `WC-${Date.now()}`);
    const billing = (body.billing || {}) as Record<string, string>;
    const shipping = (body.shipping || {}) as Record<string, string>;
    const lineItems = (body.line_items || []) as Array<{
      id?: number;
      product_id?: number;
      name?: string;
      sku?: string;
      quantity?: number;
      price?: string | number;
      subtotal?: string | number;
    }>;

    const customerName = `${billing.first_name || shipping.first_name || "Website"} ${billing.last_name || shipping.last_name || "Customer"}`.trim();
    const mobile = billing.phone || "+91 98400 00000";
    const address = `${billing.address_1 || shipping.address_1 || ""}, ${billing.city || shipping.city || ""}`.trim();

    const items = lineItems.map((item, idx) => ({
      id: `wc-item-${item.id || idx}`,
      productId: String(item.product_id || `wc-prod-${idx}`),
      productName: item.name || "Apparel Item",
      sku: item.sku || `SKU-${idx}`,
      size: "M" as const,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.price) || 1999,
      subtotal: Number(item.subtotal) || (Number(item.price) || 1999) * (Number(item.quantity) || 1),
    }));

    const totalAmount = Number(body.total) || items.reduce((sum, it) => sum + it.subtotal, 0);

    const result = orderflowStore.ingestWebhookOrder({
      source: "WEBSITE",
      externalOrderId: wcId,
      customer: {
        id: `cust-wc-${wcId}`,
        name: customerName,
        mobile,
        email: billing.email,
        address: address || "Website Customer Address",
        city: billing.city || "Chennai",
        state: billing.state || "Tamil Nadu",
        pincode: billing.postcode || "600001",
        totalOrders: 1,
      },
      items: items.length > 0 ? items : undefined,
      totalAmount,
      paymentStatus: (body.payment_method === "cod" ? "COD" : "PAID") as "COD" | "PAID",
    });

    if (result.duplicate) {
      return NextResponse.json(
        { message: "Order already ingested (idempotent)", orderNumber: result.order?.orderNumber },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, orderNumber: result.order?.orderNumber, orderId: result.order?.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("WooCommerce Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
