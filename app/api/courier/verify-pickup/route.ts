import { NextRequest, NextResponse } from "next/server";
import { orderflowStore } from "@/lib/store";

/**
 * POST /api/courier/verify-pickup
 * Verifies and confirms parcel pickup using Customer Mobile Number.
 * 
 * Rules:
 * - Only eligible Dispatched orders for the given courier partner match.
 * - Customer mobile is strictly used for verification and never stored as courier person's pickupPhone.
 * - On single match or selected order: automatically changes Courier Status to "Picked Up" with actual server timestamp.
 * - On multiple matches: returns the matching orders for staff selection.
 * - On no match: returns 404 / error and does not create or update anything.
 */
export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get("x-user-role") || "ADMIN";
    const headerCourierPartnerId = req.headers.get("x-courier-partner-id") || undefined;

    const { mobile, courierPartnerCode, orderId } = await req.json();

    if (!mobile || typeof mobile !== "string") {
      return NextResponse.json({ error: "Missing or invalid customer mobile number" }, { status: 400 });
    }

    // Role-based authorization & partner isolation
    let activePartnerCode = courierPartnerCode || "ST_COURIER";
    if (userRole === "COURIER" && headerCourierPartnerId) {
      activePartnerCode = headerCourierPartnerId;
    }

    const result = orderflowStore.verifyCourierPickupByCustomerMobile({
      mobile,
      courierPartnerCode: activePartnerCode,
      orderId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    if (result.multipleMatches) {
      return NextResponse.json({
        success: true,
        multipleMatches: true,
        matchingOrders: result.matchingOrders,
      });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      order: result.order,
    });
  } catch (err: any) {
    console.error("Error in /api/courier/verify-pickup:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
