import { NextRequest, NextResponse } from "next/server";
import { orderflowStore } from "@/lib/store";
import { INITIAL_COURIERS } from "@/lib/mock-data";

/**
 * GET /api/couriers
 * Lists courier partners. Courier partners can only see themselves.
 */
export async function GET(req: NextRequest) {
  try {
    const userRole = req.headers.get("x-user-role") || "ADMIN";
    const courierPartnerId = req.headers.get("x-courier-partner-id") || undefined;

    const allCouriers = orderflowStore.getCourierPartners();

    if (userRole === "COURIER") {
      const ownCourier = allCouriers.filter(
        (c) => c.code === courierPartnerId || c.id === courierPartnerId
      );
      return NextResponse.json({ success: true, couriers: ownCourier });
    }

    return NextResponse.json({ success: true, couriers: allCouriers });
  } catch (err: any) {
    console.error("Error in /api/couriers:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/couriers
 * Admin can add a new courier partner.
 */
export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get("x-user-role") || "ADMIN";
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 403 });
    }

    const { name, code, isStCourier, trackingUrlPattern } = await req.json();
    if (!name || !code) {
      return NextResponse.json({ error: "Missing required fields: name and code" }, { status: 400 });
    }

    const partner = orderflowStore.addCourierPartner({
      name,
      code,
      isStCourier: Boolean(isStCourier),
      trackingUrlPattern: trackingUrlPattern || `https://track.${name.toLowerCase().replace(/\s+/g, "")}.com?llr={llr}`,
      active: true,
    });

    return NextResponse.json({ success: true, partner });
  } catch (err: any) {
    console.error("Error adding courier partner:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
