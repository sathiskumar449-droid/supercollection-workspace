import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Ping4SMS Delivery Report (DLR) Webhook Callback
 * Ping4SMS sends GET/POST requests when SMS status updates (DELIVRD, FAILED, DND, etc.)
 */
export async function GET(req: NextRequest) {
  return handleDlr(req);
}

export async function POST(req: NextRequest) {
  return handleDlr(req);
}

async function handleDlr(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get("msgid") || url.searchParams.get("MessageId");
    const statusStr = (url.searchParams.get("status") || url.searchParams.get("Status") || "").toUpperCase();
    const mobile = url.searchParams.get("mobile") || url.searchParams.get("Mobile");

    const isDelivered = statusStr === "DELIVRD" || statusStr === "DELIVERED" || statusStr === "SUCCESS";
    const isFailed = statusStr === "FAILED" || statusStr === "UNDELIV" || statusStr === "REJECTD" || statusStr === "DND";

    const targetStatus = isDelivered ? "SENT" : isFailed ? "FAILED" : "PENDING";

    if (isSupabaseConfigured() && supabase && messageId) {
      await supabase
        .from("sms_logs")
        .update({
          status: targetStatus,
          delivered_at: isDelivered ? new Date().toISOString() : null,
          last_checked_at: new Date().toISOString(),
        })
        .eq("provider_message_id", messageId);
    }

    return NextResponse.json({ success: true, message: "DLR processed" });
  } catch (err: any) {
    console.error("DLR callback error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
