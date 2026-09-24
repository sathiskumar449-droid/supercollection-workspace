import { NextRequest, NextResponse } from "next/server";
import { ingestWhatsAppOrder } from "@/lib/whatsapp-sync";

/**
 * WhatsApp Order Webhook Endpoint
 * Ingests orders finalized inside WhatsApp chat box.
 * Source is strictly WHATSAPP.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await ingestWhatsAppOrder(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to ingest WhatsApp order" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, orderNumber: result.orderNumber, source: "WHATSAPP", duplicate: result.isDuplicate },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("WhatsApp Order Webhook error:", error);
    return NextResponse.json({ error: error.message || "Failed to ingest WhatsApp order" }, { status: 500 });
  }
}
