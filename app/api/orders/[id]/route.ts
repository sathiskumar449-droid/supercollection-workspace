import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, fetchSupabaseOrders } from "@/lib/supabase";
import { orderflowStore } from "@/lib/store";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orders/[id]
 * Fetches order details with strict security:
 * If a courier partner attempts to access an order belonging to another courier,
 * immediately return 403 Forbidden ("Order not available").
 */
export async function GET(req: NextRequest, segmentData: Params) {
  try {
    const { id } = await segmentData.params;
    const userRole = req.headers.get("x-user-role") || "ADMIN";
    const courierPartnerId = req.headers.get("x-courier-partner-id") || undefined;

    let order = null;

    if (isSupabaseConfigured()) {
      const liveOrders = await fetchSupabaseOrders();
      order = (liveOrders || []).find(
        (o) => o.id === id || o.orderNumber === id || o.dispatch?.dispatchId === id
      );
    } else {
      order = orderflowStore.getOrders().find(
        (o) => o.id === id || o.orderNumber === id || o.dispatch?.dispatchId === id
      );
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Strict privacy enforcement
    if (userRole === "COURIER") {
      if (!courierPartnerId || order.dispatch?.courierPartnerId !== courierPartnerId) {
        return NextResponse.json(
          { error: "Order not available" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error("Error in /api/orders/[id]:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
