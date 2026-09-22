"use client";

import React from "react";
import CourierHubPage from "../page";

/**
 * Backward compatibility route for /couriers/st-courier
 * Transparently delegates to the unified Courier Hub at /couriers
 */
export default function StCourierPage() {
  return <CourierHubPage />;
}
