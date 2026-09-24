import { NextRequest, NextResponse } from "next/server";
import { ingestWhatsAppOrder, RawWhatsAppOrderPayload } from "@/lib/whatsapp-sync";

export async function GET() {
  return NextResponse.json(
    { status: "active", message: "SuperCollection Work Desk WhatsApp Orders Webhook is live" },
    { status: 200 }
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * POST /api/webhooks/whatsapp-orders
 * Secure webhook receiver for new and updated orders from WhatsApp Chat Box
 * Authenticated via shared secret header: x-sync-secret: <WORKDESK_SYNC_SECRET>
 */
export async function POST(req: NextRequest) {
  try {
    const syncSecret = process.env.WORKDESK_SYNC_SECRET?.trim();
    const incomingSecret = (
      req.headers.get("x-sync-secret") ||
      req.headers.get("x-workdesk-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      ""
    ).trim();

    // Authenticate the incoming webhook request using shared secret
    if (syncSecret && incomingSecret !== syncSecret) {
      console.warn("Unauthorized WhatsApp webhook attempt with invalid secret header");
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing x-sync-secret header" },
        { status: 401 }
      );
    }

    const rawBody = await req.text();
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    let payload: RawWhatsAppOrderPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Ingest the WhatsApp order using shared ingestion and mapping logic
    const result = await ingestWhatsAppOrder(payload);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to process WhatsApp order" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        orderNumber: result.orderNumber,
        source: "WhatsApp",
        message: result.message || "WhatsApp order ingested successfully",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("WhatsApp Orders Webhook Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
