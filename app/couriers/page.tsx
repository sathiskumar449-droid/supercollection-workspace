"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Truck, 
  Search, 
  Check, 
  Package, 
  FileSpreadsheet, 
  FileText, 
  Phone, 
  AlertCircle,
  Clock,
  CheckCheck
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { Order, CourierStatus } from "@/types/orderflow";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatDate, cn, matchesDateFilter } from "@/lib/utils";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

/**
 * Inline editor for Courier Pickup Person's Phone number
 * Strictly independent from Customer Phone.
 */
function InlinePickupPhoneInput({
  orderId,
  orderNumber,
  initialValue,
  onSave,
}: {
  orderId: string;
  orderNumber: string;
  initialValue?: string;
  onSave: (orderId: string, orderNumber: string, val: string) => void;
}) {
  const [val, setVal] = useState(initialValue || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    setVal(initialValue || "");
  }, [initialValue]);

  const commitSave = () => {
    const trimmed = val.trim();
    if (trimmed !== (initialValue || "")) {
      onSave(orderId, orderNumber, trimmed);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  return (
    <div 
      className="relative flex items-center w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={commitSave}
        placeholder="Enter pickup phone..."
        className={cn(
          "w-full text-xs font-mono py-1 px-2 rounded border transition-all outline-none",
          savedSuccess
            ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300 font-semibold"
            : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20",
          !val && "placeholder:text-slate-300 text-slate-500"
        )}
        title={val ? `Pickup Phone: ${val}` : "Enter phone number of courier pickup person"}
      />
      {savedSuccess && (
        <Check className="w-3.5 h-3.5 text-emerald-600 absolute right-2 pointer-events-none" />
      )}
    </div>
  );
}

/**
 * Inline editor for LLR / Tracking Number
 * Kept individual per order - never bulk applied.
 */
function InlineLlrInput({
  orderId,
  orderNumber,
  initialValue,
  onSave,
}: {
  orderId: string;
  orderNumber: string;
  initialValue?: string;
  onSave: (orderId: string, orderNumber: string, val: string) => void;
}) {
  const [val, setVal] = useState(initialValue || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    setVal(initialValue || "");
  }, [initialValue]);

  const commitSave = () => {
    const trimmed = val.trim();
    if (trimmed !== (initialValue || "")) {
      onSave(orderId, orderNumber, trimmed);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  return (
    <div 
      className="relative flex items-center w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={commitSave}
        placeholder="Enter LLR No..."
        className={cn(
          "w-full text-xs font-mono py-1 px-2 rounded border transition-all outline-none",
          savedSuccess
            ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300 font-semibold"
            : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20",
          !val && "placeholder:text-slate-300 text-slate-500"
        )}
        title={val ? `LLR No: ${val}` : "Enter order-specific LLR / Tracking Number"}
      />
      {savedSuccess && (
        <Check className="w-3.5 h-3.5 text-emerald-600 absolute right-2 pointer-events-none" />
      )}
    </div>
  );
}

function CourierHubContent() {
  const searchParams = useSearchParams();
  const initialStatusTab = searchParams.get("status") || "ALL";

  const { 
    orders, 
    user, 
    updateCourierDetails, 
    bulkUpdateCourierStatus, 
    courierPartners,
    dateFilter, 
    customDate 
  } = useOrderFlow();

  const isCourierUser = user.role === "COURIER";
  const userCourierPartnerId = user.courierPartnerId;

  // Active courier partner selection (Admin can toggle between partners; default to ST_COURIER or URL param)
  const initialPartnerParam = searchParams.get("partner");
  const [adminPartnerFilter, setAdminPartnerFilter] = useState<string>(initialPartnerParam || "ST_COURIER");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Sync if URL query param or courierPartners load
  React.useEffect(() => {
    const p = searchParams.get("partner");
    if (p) {
      setAdminPartnerFilter(p);
    } else if (!adminPartnerFilter && courierPartners.length > 0) {
      setAdminPartnerFilter(courierPartners[0].code);
    }
  }, [searchParams, courierPartners, adminPartnerFilter]);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<CourierStatus>("PICKED_UP");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Active courier partner code
  const activePartnerCode = useMemo(() => {
    if (isCourierUser) return userCourierPartnerId || "ST_COURIER";
    return adminPartnerFilter || courierPartners[0]?.code || "ST_COURIER";
  }, [isCourierUser, userCourierPartnerId, adminPartnerFilter, courierPartners]);

  // 1. Base eligibility: Orders marked as DISPATCHED in Packing Station
  const eligibleDispatchedOrders = useMemo(() => {
    return orders.filter((o) => {
      // Must be currently in DISPATCHED status from packing station
      if (o.orderStatus !== "DISPATCHED") {
        return false;
      }

      // Date filtering
      if (!matchesDateFilter(o.createdAt, dateFilter, customDate)) {
        return false;
      }

      // Strict courier partner isolation for courier user
      if (isCourierUser) {
        return (o.dispatch?.courierPartnerId || "ST_COURIER") === userCourierPartnerId;
      }

      return true;
    });
  }, [orders, dateFilter, customDate, isCourierUser, userCourierPartnerId]);

  // Partner order counts for Admin tabs
  const partnerCounts = useMemo(() => {
    if (isCourierUser) return {};

    const counts: Record<string, number> = {};
    courierPartners.forEach((cp) => {
      counts[cp.code] = 0;
    });

    eligibleDispatchedOrders.forEach((o) => {
      const code = o.dispatch?.courierPartnerId || "ST_COURIER";
      if (counts[code] !== undefined) {
        counts[code]++;
      } else {
        counts[code] = 1;
      }
    });

    return counts;
  }, [eligibleDispatchedOrders, courierPartners, isCourierUser]);

  // Orders belonging specifically to the active partner
  const currentPartnerOrders = useMemo(() => {
    return eligibleDispatchedOrders.filter((o) => {
      const code = o.dispatch?.courierPartnerId || "ST_COURIER";
      return code === activePartnerCode;
    });
  }, [eligibleDispatchedOrders, activePartnerCode]);

  // 2. Metrics calculation for active partner
  const metrics = useMemo(() => {
    let waiting = 0;
    let pickedUp = 0;
    let delivered = 0;
    let missingLlr = 0;

    currentPartnerOrders.forEach((o) => {
      const cStatus = o.dispatch?.courierStatus;
      if (cStatus === "DELIVERED") {
        delivered++;
      } else if (cStatus === "PICKED_UP" || cStatus === "SHIPPED") {
        pickedUp++;
      } else {
        waiting++;
      }

      if (!o.dispatch?.llrNumber || !o.dispatch.llrNumber.trim()) {
        missingLlr++;
      }
    });

    return {
      total: currentPartnerOrders.length,
      waiting,
      pickedUp,
      delivered,
      missingLlr,
    };
  }, [currentPartnerOrders]);

  // 3. Filtered Orders for the active partner based on Status Filter and Search Query
  const displayedOrders = useMemo(() => {
    return currentPartnerOrders.filter((o) => {
      // Status tab filter
      const cStatus = o.dispatch?.courierStatus;
      if (statusFilter === "WAITING_FOR_PICKUP") {
        if (cStatus === "PICKED_UP" || cStatus === "SHIPPED" || cStatus === "DELIVERED") {
          return false;
        }
      } else if (statusFilter === "PICKED_UP") {
        if (cStatus !== "PICKED_UP" && cStatus !== "SHIPPED") {
          return false;
        }
      } else if (statusFilter === "DELIVERED") {
        if (cStatus !== "DELIVERED") {
          return false;
        }
      } else if (statusFilter === "MISSING_LLR") {
        if (o.dispatch?.llrNumber && o.dispatch.llrNumber.trim()) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          o.orderNumber.toLowerCase().includes(q) ||
          (o.dispatch?.dispatchId && o.dispatch.dispatchId.toLowerCase().includes(q)) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.mobile.toLowerCase().includes(q) ||
          (o.dispatch?.pickupPhone && o.dispatch.pickupPhone.toLowerCase().includes(q)) ||
          (o.dispatch?.llrNumber && o.dispatch.llrNumber.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [currentPartnerOrders, statusFilter, searchQuery]);

  // 4. Inline handlers
  const handleSavePickupPhone = (orderId: string, orderNumber: string, val: string) => {
    updateCourierDetails(orderId, { pickupPhone: val });
    triggerToast(`Pickup phone saved for ${orderNumber}`);
  };

  const handleSaveLlr = (orderId: string, orderNumber: string, val: string) => {
    updateCourierDetails(orderId, { llrNumber: val });
    triggerToast(val ? `LLR ${val} saved for ${orderNumber}` : `LLR cleared for ${orderNumber}`);
  };

  const handleStatusChange = (orderId: string, newStatus: CourierStatus) => {
    updateCourierDetails(orderId, { courierStatus: newStatus });
    const label = newStatus === "WAITING_FOR_PICKUP" ? "Waiting for Pickup" : newStatus === "PICKED_UP" ? "Picked Up" : "Delivered";
    triggerToast(`Courier status updated to "${label}"`);
  };

  // 5. Bulk selection
  const isAllDisplayedSelected =
    displayedOrders.length > 0 &&
    displayedOrders.every((o) => selectedIds.includes(o.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = displayedOrders.map((o) => o.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...allIds])));
    } else {
      const displayedIdSet = new Set(displayedOrders.map((o) => o.id));
      setSelectedIds(selectedIds.filter((id) => !displayedIdSet.has(id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteBulkUpdate = () => {
    setIsBulkUpdating(true);
    const res = bulkUpdateCourierStatus(selectedIds, bulkTargetStatus);
    setIsBulkUpdating(false);
    setIsConfirmDialogOpen(false);
    setSelectedIds([]);
    const label = bulkTargetStatus === "WAITING_FOR_PICKUP" ? "Waiting for Pickup" : bulkTargetStatus === "PICKED_UP" ? "Picked Up" : "Delivered";
    triggerToast(`Successfully updated ${res.successCount} orders to "${label}"`);
  };

  // 6. Export handlers (Admin only)
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Order ID",
      "Dispatch ID",
      "Customer Name",
      "Customer Phone",
      "Pickup Phone",
      "Courier Partner",
      "LLR / Tracking #",
      "Courier Status",
      "Dispatched Date",
      "Destination City",
      "Destination State",
      "Pincode",
    ];

    const rows = displayedOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      order.dispatch.dispatchId || "",
      order.customer.name,
      order.customer.mobile,
      order.dispatch.pickupPhone || "",
      order.dispatch.courierName,
      order.dispatch.llrNumber || "",
      order.dispatch.courierStatus,
      order.dispatch.dispatchedAt ? new Date(order.dispatch.dispatchedAt).toLocaleDateString("en-IN") : "",
      order.customer.city,
      order.customer.state,
      order.customer.pincode,
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(`Courier_Hub_Manifest_${dateStr}`, headers, rows);
  };

  const handleExportPdf = () => {
    const headers = [
      "S.No",
      "Order ID",
      "Dispatch ID",
      "Customer",
      "Pickup Phone",
      "Courier",
      "LLR / Tracking #",
      "Courier Status",
      "City, Pincode",
    ];

    const rows = displayedOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      order.dispatch.dispatchId || "",
      order.customer.name,
      order.dispatch.pickupPhone || "-",
      order.dispatch.courierName,
      order.dispatch.llrNumber || "-",
      order.dispatch.courierStatus,
      `${order.customer.city} - ${order.customer.pincode}`,
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToPdf({
      title: "Courier Hub Handoff Manifest",
      subtitle: `Total Orders: ${displayedOrders.length} | Export Date: ${new Date().toLocaleDateString("en-IN")}`,
      filename: `Courier_Hub_Manifest_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  // Helper display name for current partner
  const currentPartner = useMemo(() => {
    return (
      courierPartners.find((c) => c.code === activePartnerCode) || {
        id: "cour-1",
        name: activePartnerCode === "PROFESSIONAL" ? "Professional Courier" : activePartnerCode === "DTDC" ? "DTDC" : "ST Courier",
        code: activePartnerCode,
      }
    );
  }, [courierPartners, activePartnerCode]);

  return (
    <div className="max-w-[1440px] mx-auto space-y-4 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {isCourierUser ? `${currentPartner.name} Portal` : `Courier Hub — ${currentPartner.name}`}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
              {currentPartnerOrders.length} Shipments
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isCourierUser 
              ? `Dedicated shipment queue for ${currentPartner.name}. Manage pickup details and update tracking statuses.`
              : `Active handoff queue for ${currentPartner.name}. Monitor driver pickup telemetry, enter LLR, and verify delivery.`
            }
          </p>
        </div>

        {/* Admin Export Buttons */}
        {!isCourierUser && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Metric Cards (Requirement 8 & 12) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Orders */}
        <div 
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "p-3.5 rounded-xl border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "ALL" ? "border-orange-500 ring-2 ring-orange-500/10" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            {isCourierUser ? "Today's Orders" : "Total Dispatched"}
          </span>
          <div className="text-2xl font-black text-slate-900 mt-0.5">
            {metrics.total}
          </div>
        </div>

        {/* Waiting for Pickup */}
        <div 
          onClick={() => setStatusFilter("WAITING_FOR_PICKUP")}
          className={cn(
            "p-3.5 rounded-xl border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "WAITING_FOR_PICKUP" ? "border-amber-500 ring-2 ring-amber-500/10" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] font-semibold text-amber-700 block uppercase tracking-wider">
            Waiting for Pickup
          </span>
          <div className="text-2xl font-black text-amber-600 mt-0.5">
            {metrics.waiting}
          </div>
        </div>

        {/* Picked Up */}
        <div 
          onClick={() => setStatusFilter("PICKED_UP")}
          className={cn(
            "p-3.5 rounded-xl border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "PICKED_UP" ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] font-semibold text-blue-700 block uppercase tracking-wider">
            Picked Up
          </span>
          <div className="text-2xl font-black text-blue-600 mt-0.5">
            {metrics.pickedUp}
          </div>
        </div>

        {/* Delivered */}
        <div 
          onClick={() => setStatusFilter("DELIVERED")}
          className={cn(
            "p-3.5 rounded-xl border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "DELIVERED" ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] font-semibold text-emerald-700 block uppercase tracking-wider">
            Delivered
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-0.5">
            {metrics.delivered}
          </div>
        </div>

        {/* Missing LLR (Admin only, or courier if needed) */}
        {!isCourierUser && (
          <div 
            onClick={() => setStatusFilter("MISSING_LLR")}
            className={cn(
              "p-3.5 rounded-xl border bg-white shadow-2xs cursor-pointer transition-all",
              statusFilter === "MISSING_LLR" ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <span className="text-[11px] font-semibold text-rose-700 block uppercase tracking-wider">
              Missing LLR
            </span>
            <div className="text-2xl font-black text-rose-600 mt-0.5">
              {metrics.missingLlr}
            </div>
          </div>
        )}
      </div>

      {/* ADMIN ONLY: Courier Partner Filter Tabs (Requirement 7 & 8) */}
      {/* Strict Privacy: NEVER shown to courier users! */}
      {!isCourierUser && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Courier Partner:
          </span>

          {courierPartners.map((cp) => {
            const isSelected = activePartnerCode === cp.code;
            const count = partnerCounts[cp.code] || 0;
            return (
              <button
                key={cp.id}
                onClick={() => {
                  setAdminPartnerFilter(cp.code);
                  if (typeof window !== "undefined") {
                    const params = new URLSearchParams(window.location.search);
                    params.set("partner", cp.code);
                    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 text-xs",
                  isSelected
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20 ring-1 ring-orange-500"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                )}
              >
                <span>{cp.name}</span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-bold",
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Status Filter Sub-tabs & Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-xs overflow-x-auto">
          {[
            { key: "ALL", label: "All Orders" },
            { key: "WAITING_FOR_PICKUP", label: "Waiting for Pickup" },
            { key: "PICKED_UP", label: "Picked Up" },
            { key: "DELIVERED", label: "Delivered" },
            ...(!isCourierUser ? [{ key: "MISSING_LLR", label: "Missing LLR" }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-3 py-1 rounded-md font-semibold transition-all whitespace-nowrap cursor-pointer",
                statusFilter === tab.key
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order, Dispatch ID, Mobile..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 text-slate-800"
          />
        </div>
      </div>

      {/* Bulk Actions Toolbar (Requirement 15) */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-xs font-bold text-orange-950">
              {selectedIds.length} {selectedIds.length === 1 ? "order" : "orders"} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-600 font-medium">Change Status:</span>
              <select
                value={bulkTargetStatus}
                onChange={(e) => setBulkTargetStatus(e.target.value as CourierStatus)}
                className="text-xs font-bold px-2 py-1 bg-white border border-slate-300 rounded-md outline-none cursor-pointer"
              >
                <option value="WAITING_FOR_PICKUP">Waiting for Pickup</option>
                <option value="PICKED_UP">Picked Up</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>

            <button
              onClick={() => setIsConfirmDialogOpen(true)}
              className="px-3.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Update {selectedIds.length} Orders
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 font-medium cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Bulk Update */}
      {isConfirmDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-orange-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Confirm Bulk Status Update</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Update <strong>{selectedIds.length} orders</strong> to{" "}
              <strong>
                {bulkTargetStatus === "WAITING_FOR_PICKUP"
                  ? "Waiting for Pickup"
                  : bulkTargetStatus === "PICKED_UP"
                  ? "Picked Up"
                  : "Delivered"}
              </strong>?
              <br />
              <span className="text-[11px] text-slate-400 block mt-1">
                An individual tracking event will be created for every updated order.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmDialogOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkUpdate}
                disabled={isBulkUpdating}
                className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                {isBulkUpdating ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                {/* Checkbox Header */}
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllDisplayedSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                  />
                </th>
                <th className="py-2.5 px-2 w-12 text-center">S.No</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Dispatch ID</th>
                {/* Admin sees Customer column; Courier sees minimal or read-only info */}
                {!isCourierUser && <th className="py-2.5 px-3">Customer</th>}
                {!isCourierUser && <th className="py-2.5 px-3">Courier</th>}
                <th className="py-2.5 px-3 min-w-[150px]">Pickup Phone</th>
                <th className="py-2.5 px-3 min-w-[140px]">LLR / Tracking</th>
                <th className="py-2.5 px-3 min-w-[140px]">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={isCourierUser ? 8 : 10} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No orders in this courier queue</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {isCourierUser 
                        ? "Any orders dispatched to your courier will appear here automatically."
                        : "Orders marked as Dispatched in Packing Station will automatically arrive here."}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order, idx) => {
                  const isSelected = selectedIds.includes(order.id);
                  const cStatus = order.dispatch?.courierStatus;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setInspectOrder(order)}
                      className={cn(
                        "hover:bg-orange-50/30 transition-colors cursor-pointer",
                        isSelected && "bg-orange-50/50"
                      )}
                    >
                      {/* Checkbox */}
                      <td 
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(order.id)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                        />
                      </td>

                      {/* S.No */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Order ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                        {order.orderNumber}
                      </td>

                      {/* Dispatch ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {order.dispatch?.dispatchId ? (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                            {order.dispatch.dispatchId}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-400 italic">
                            Pending ID
                          </span>
                        )}
                      </td>

                      {/* Customer (Admin only) */}
                      {!isCourierUser && (
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800 truncate max-w-[140px]">
                            {order.customer.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{order.customer.mobile}</span>
                          </div>
                        </td>
                      )}

                      {/* Courier Partner (Admin only) */}
                      {!isCourierUser && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-bold border",
                            order.dispatch?.courierPartnerId === "PROFESSIONAL"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : order.dispatch?.courierPartnerId === "DTDC"
                              ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                              : order.dispatch?.courierPartnerId === "ST_COURIER"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {order.dispatch?.courierName || "Unassigned"}
                          </span>
                        </td>
                      )}

                      {/* Pickup Phone (Separate from Customer Phone) */}
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <InlinePickupPhoneInput
                          orderId={order.id}
                          orderNumber={order.orderNumber}
                          initialValue={order.dispatch?.pickupPhone}
                          onSave={handleSavePickupPhone}
                        />
                      </td>

                      {/* LLR / Tracking Number */}
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <InlineLlrInput
                          orderId={order.id}
                          orderNumber={order.orderNumber}
                          initialValue={order.dispatch?.llrNumber}
                          onSave={handleSaveLlr}
                        />
                      </td>

                      {/* Courier Status */}
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={
                            cStatus === "DELIVERED"
                              ? "DELIVERED"
                              : cStatus === "PICKED_UP" || cStatus === "SHIPPED"
                              ? "PICKED_UP"
                              : "WAITING_FOR_PICKUP"
                          }
                          onChange={(e) => handleStatusChange(order.id, e.target.value as CourierStatus)}
                          className={cn(
                            "w-full text-xs font-bold py-1 px-2 rounded-md border outline-none cursor-pointer transition-colors shadow-2xs",
                            cStatus === "DELIVERED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : cStatus === "PICKED_UP" || cStatus === "SHIPPED"
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          )}
                        >
                          <option value="WAITING_FOR_PICKUP">Waiting for Pickup</option>
                          <option value="PICKED_UP">Picked Up</option>
                          <option value="DELIVERED">Delivered</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Order Drawer */}
      <OrderDetailsDrawer
        order={inspectOrder}
        isOpen={Boolean(inspectOrder)}
        onClose={() => setInspectOrder(null)}
        onUpdateCourier={updateCourierDetails}
        userRole={user.role}
        courierPartnerId={user.courierPartnerId}
      />
    </div>
  );
}

export default function CourierHubPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Courier Hub...</div>}>
      <CourierHubContent />
    </Suspense>
  );
}
