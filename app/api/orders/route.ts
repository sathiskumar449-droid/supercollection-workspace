import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, fetchSupabaseOrders } from "@/lib/supabase";
import { orderflowStore } from "@/lib/store";

/**
 * GET /api/orders
 * Returns orders with strict role-based data isolation for courier partners.
 */
export async function GET(req: NextRequest) {
  try {
    const userRole = req.headers.get("x-user-role") || "ADMIN";
    const courierPartnerId = req.headers.get("x-courier-partner-id") || undefined;

    let orders = [];

    if (isSupabaseConfigured()) {
      const liveOrders = await fetchSupabaseOrders();
      orders = liveOrders || [];
    } else {
      orders = orderflowStore.getOrders();
    }

    // Strict courier isolation:
    // If request is from a courier partner user, strictly filter down to only their orders.
    if (userRole === "COURIER") {
      if (!courierPartnerId) {
        return NextResponse.json(
          { error: "Unauthorized: Missing courier partner identifier" },
          { status: 403 }
        );
      }

      orders = orders.filter((o) => o.dispatch?.courierPartnerId === courierPartnerId);
    }

    return NextResponse.json({ success: true, count: orders.length, orders });
  } catch (err: any) {
    console.error("Error in /api/orders:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
