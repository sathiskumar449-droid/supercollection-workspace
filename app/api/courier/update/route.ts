import { NextRequest, NextResponse } from "next/server";
import { orderflowStore } from "@/lib/store";

/**
 * POST /api/courier/update
 * Updates pickup phone, LLR, or courier status with server-side ownership validation.
 */
export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get("x-user-role") || "ADMIN";
    const courierPartnerId = req.headers.get("x-courier-partner-id") || undefined;

    const { orderId, pickupPhone, llrNumber, courierStatus, courierId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const order = orderflowStore.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Role-based authorization & privacy checks
    if (userRole === "COURIER") {
      if (!courierPartnerId || order.dispatch?.courierPartnerId !== courierPartnerId) {
        return NextResponse.json(
          { error: "Forbidden: You cannot modify orders assigned to other courier partners" },
          { status: 403 }
        );
      }

      // Courier cannot reassign to another courier
      if (courierId && courierId !== order.dispatch.courierId) {
        return NextResponse.json(
          { error: "Forbidden: Couriers cannot reassign orders to other courier partners" },
          { status: 403 }
        );
      }
    }

    const result = orderflowStore.updateCourierDetails(orderId, {
      pickupPhone,
      llrNumber,
      courierStatus,
      courierId: userRole === "ADMIN" ? courierId : undefined,
    });

    return NextResponse.json({ success: result.success });
  } catch (err: any) {
    console.error("Error in /api/courier/update:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
