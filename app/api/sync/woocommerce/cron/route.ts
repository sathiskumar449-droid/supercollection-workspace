import { NextRequest, NextResponse } from "next/server";
import { POST as syncWooCommerce } from "../route";

/**
 * Automated Scheduled Daily Cron Endpoint for WooCommerce Sync
 * Invoked by Vercel Cron or external scheduler daily to import new & updated orders.
 */
export async function GET(req: NextRequest) {
  try {
    // Check optional authorization header if CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow Vercel cron header
      const vercelCron = req.headers.get("x-vercel-cron");
      if (!vercelCron) {
        return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
      }
    }

    // Call WooCommerce sync for last 2 days (today & yesterday) to sync all daily orders
    const fakeRequest = new NextRequest(new URL("/api/sync/woocommerce", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rangeType: "last_2_days",
      }),
    });

    const response = await syncWooCommerce(fakeRequest);
    const data = await response.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cron: "daily_woocommerce_sync",
      result: data,
    });
  } catch (err: any) {
    console.error("WooCommerce Daily Cron Error:", err);
    return NextResponse.json({ error: err.message || "Cron sync error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
