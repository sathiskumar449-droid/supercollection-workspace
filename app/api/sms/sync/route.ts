import { NextRequest, NextResponse } from "next/server";
import { orderflowStore } from "@/lib/store";

/**
 * Ping4SMS Delivery Status Synchronization Endpoint
 * Strictly read-only status refresh from Ping4SMS.
 * NO SMS SENDING.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId as string | undefined;

    const result = orderflowStore.syncPing4SmsStatus(orderId);

    return NextResponse.json({
      success: true,
      message: `Ping4SMS delivery statuses refreshed successfully. ${result.updatedCount} records synchronized.`,
      updatedCount: result.updatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Ping4SMS sync error:", error);
    return NextResponse.json({ error: "Failed to synchronize Ping4SMS status" }, { status: 500 });
  }
}
