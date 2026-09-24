import { NextRequest, NextResponse } from "next/server";
import { fetchAndSyncWhatsAppOrdersLast2Days } from "@/lib/whatsapp-sync";

/**
 * WhatsApp 2-Day Live Sync Endpoint
 * Connects to WhatsApp Chat Box App API:
 * GET /api/integrations/workdesk/orders?since=<ISO_TIMESTAMP>
 * Authenticated via header:
 * x-sync-secret: <WORKDESK_SYNC_SECRET>
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional if env variables exist
    }

    const apiUrl = body.apiUrl || body.whatsappApiUrl;
    const syncSecret = body.syncSecret;

    const result = await fetchAndSyncWhatsAppOrdersLast2Days({
      apiUrl,
      syncSecret,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          needsSecret: result.error?.includes("Missing WORKDESK_SYNC_SECRET"),
        },
        { status: result.error?.includes("Missing") ? 400 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      syncedCount: result.syncedCount,
      totalReceived: result.totalReceived,
      since: result.since,
      message: result.message,
    });
  } catch (err: any) {
    console.error("WhatsApp Sync Endpoint Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Allow GET to trigger sync using environment variables
  try {
    const result = await fetchAndSyncWhatsAppOrdersLast2Days();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
