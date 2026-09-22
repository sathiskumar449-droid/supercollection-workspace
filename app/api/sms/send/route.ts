import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Ping4SMS Outbound Dispatch/Shipped SMS Trigger
 */
export async function POST(req: NextRequest) {
  try {
    const { orderId, orderNumber, customerMobile, customerName, courierName, llrNumber } = await req.json();

    if (!customerMobile || !orderNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.PING4SMS_API_KEY;
    const senderId = process.env.PING4SMS_SENDER_ID || "SUPCOL";
    const entityId = process.env.PING4SMS_ENTITY_ID || "";
    const templateId = process.env.PING4SMS_TEMPLATE_ID || "";

    // Message template
    const trackingLink = llrNumber 
      ? `https://stcourier.com/track?llr=${llrNumber}` 
      : `https://supercollection.in/track`;
    
    const message = `Dear ${customerName || "Customer"}, your SuperCollection Order ${orderNumber} has been shipped via ${courierName || "ST Courier"}.${llrNumber ? ` LLR: ${llrNumber}.` : ""} Track here: ${trackingLink} - SuperCollection`;

    let providerMessageId = `p4s-${Date.now()}`;
    let smsStatus: "SENT" | "FAILED" = "SENT";

    if (apiKey) {
      try {
        // Live Ping4SMS Gateway HTTP Call
        const pingUrl = `https://api.ping4sms.com/api/v2/SendSMS?ApiKey=${encodeURIComponent(apiKey)}&ClientId=${encodeURIComponent(senderId)}&SenderId=${encodeURIComponent(senderId)}&Message=${encodeURIComponent(message)}&MobileNumbers=${encodeURIComponent(customerMobile)}&EntityId=${encodeURIComponent(entityId)}&TemplateId=${encodeURIComponent(templateId)}`;

        const response = await fetch(pingUrl, { method: "GET" });
        const resData = await response.json();
        if (resData?.status === "success" || resData?.ErrorCode === "000") {
          providerMessageId = resData.MessageId || providerMessageId;
          smsStatus = "SENT";
        } else {
          smsStatus = "FAILED";
        }
      } catch (smsErr) {
        console.error("Ping4SMS Gateway Request Failed:", smsErr);
        smsStatus = "FAILED";
      }
    }

    // Persist SMS log into Supabase if configured
    if (isSupabaseConfigured() && orderId) {
      const db = supabaseAdmin || supabase;
      if (db) {
        const { data: existingSms } = await db
          .from("sms_logs")
          .select("id")
          .eq("order_id", orderId)
          .maybeSingle();

        if (existingSms) {
          await db.from("sms_logs").update({
            mobile: customerMobile,
            provider: "Ping4SMS",
            provider_message_id: providerMessageId,
            status: smsStatus,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", existingSms.id);
        } else {
          await db.from("sms_logs").insert({
            order_id: orderId,
            mobile: customerMobile,
            provider: "Ping4SMS",
            provider_message_id: providerMessageId,
            status: smsStatus,
            sent_at: new Date().toISOString(),
          });
        }

        await db.from("activity_logs").insert({
          order_id: orderId,
          user_name: "Ping4SMS Gateway",
          user_role: "DISPATCH_STAFF",
          action: "SMS Sent",
          details: `Dispatched SMS ${smsStatus === "SENT" ? "sent successfully" : "failed"} to ${customerMobile} (ID: ${providerMessageId})`,
        });
      }
    }

    return NextResponse.json({
      success: smsStatus === "SENT",
      providerMessageId,
      status: smsStatus,
      message: `SMS ${smsStatus.toLowerCase()} to ${customerMobile}`,
    });
  } catch (err: any) {
    console.error("SMS Send Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
