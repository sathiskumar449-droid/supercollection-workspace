"use client";

import React, { useState, useMemo, Suspense, useRef } from "react";
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
  CheckCheck,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { Order, CourierStatus } from "@/types/orderflow";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatDate, cn, normalizePhoneDigits } from "@/lib/utils";
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
    verifyCourierPickupByCustomerMobile,
    updateCourierDetails, 
    courierPartners,
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

  // Active courier partner code
  const activePartnerCode = useMemo(() => {
    if (isCourierUser && userCourierPartnerId) return userCourierPartnerId;
    return adminPartnerFilter || courierPartners[0]?.code || "ST_COURIER";
  }, [isCourierUser, userCourierPartnerId, adminPartnerFilter, courierPartners]);

  // Current Partner Object
  const currentPartner = useMemo(() => {
    return (
      courierPartners.find((c) => c.code === activePartnerCode) || {
        id: "cour-1",
        name: activePartnerCode === "PROFESSIONAL" ? "Professional Courier" : activePartnerCode === "DTDC" ? "DTDC" : activePartnerCode === "INDIA_POST" ? "India Post" : "ST Courier",
        code: activePartnerCode,
      }
    );
  }, [courierPartners, activePartnerCode]);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Top Customer Mobile Input State (automatic search & pickup)
  const [customerMobileInput, setCustomerMobileInput] = useState("");
  const [searchFeedback, setSearchFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Track orders picked up in this session to ensure they accumulate and never get removed
  const [sessionPickedUpIds, setSessionPickedUpIds] = useState<string[]>([]);

  // Core Rule:
  // Dispatched = Ready for Courier Pickup (remains in Packing & All Orders as "Dispatched")
  // Do NOT automatically show in Courier Hub until Customer Mobile is verified!
  // Customer Mobile Verified = Picked Up
  // Only orders verified / Picked Up or Delivered appear in the Courier Hub table!
  const verifiedOrders = useMemo(() => {
    const seenIds = new Set<string>();
    return orders.filter((o) => {
      if (seenIds.has(o.id)) {
        return false;
      }
      seenIds.add(o.id);

      // Must not be cancelled or returned
      if (o.orderStatus === "RETURN" || (o.orderStatus as string) === "CANCELLED" || (o.orderStatus as string) === "RETURNED") {
        return false;
      }

      // Must be picked up (ONLY when Customer Mobile Number was entered & verified, or has active LLR or explicit pickup)
      const isSessionPicked = sessionPickedUpIds.includes(o.id);
      const cStatus = o.dispatch?.courierStatus;
      const hasLlr = Boolean(o.dispatch?.llrNumber && o.dispatch.llrNumber.trim());
      const hasVerifiedCustomerPhone = Boolean(o.dispatch?.verifiedCustomerPhone && o.dispatch.verifiedCustomerPhone.trim());
      const isPickedUp =
        isSessionPicked ||
        cStatus === "PICKED_UP" ||
        cStatus === "DELIVERED" ||
        cStatus === "SHIPPED" ||
        hasVerifiedCustomerPhone ||
        hasLlr;

      if (!isPickedUp) {
        return false;
      }

      // Must have an assigned courier partner (DO NOT default to ST_COURIER)
      const partnerCode = o.dispatch?.courierPartnerId;
      if (!partnerCode) {
        return false;
      }

      // Strict courier partner isolation for courier user only if a specific partner is bound to their account
      if (isCourierUser && userCourierPartnerId) {
        return partnerCode === userCourierPartnerId;
      }

      return true;
    });
  }, [orders, isCourierUser, userCourierPartnerId, sessionPickedUpIds]);

  // Partner order counts for tabs
  const partnerCounts = useMemo(() => {
    if (isCourierUser && userCourierPartnerId) return {};

    const counts: Record<string, number> = {};
    courierPartners.forEach((cp) => {
      counts[cp.code] = 0;
    });

    verifiedOrders.forEach((o) => {
      const code = o.dispatch?.courierPartnerId;
      if (code && counts[code] !== undefined) {
        counts[code]++;
      }
    });

    return counts;
  }, [verifiedOrders, courierPartners, isCourierUser]);

  // Orders belonging specifically to the active partner - strictly isolated, no cross-tab duplicates
  const currentPartnerOrders = useMemo(() => {
    return verifiedOrders
      .filter((o) => o.dispatch?.courierPartnerId === activePartnerCode)
      .sort((a, b) => {
        const timeA = new Date(a.dispatch?.pickedUpAt || a.updatedAt).getTime();
        const timeB = new Date(b.dispatch?.pickedUpAt || b.updatedAt).getTime();
        return timeB - timeA;
      });
  }, [verifiedOrders, activePartnerCode]);

  // Multiple matching orders dialog state (Section 10)
  const [multipleMatchingOrders, setMultipleMatchingOrders] = useState<Order[] | null>(null);
  const [multipleMatchingPhone, setMultipleMatchingPhone] = useState<string>("");

  // Automatic pickup execution when valid 10-digit mobile number is entered
  const processPickup = (cleanPhone: string, specificOrderId?: string) => {
    const res = verifyCourierPickupByCustomerMobile({
      mobile: cleanPhone,
      courierPartnerCode: activePartnerCode,
      orderId: specificOrderId,
    });

    if (!res.success) {
      setSearchFeedback({
        type: "error",
        message: res.error || "No eligible dispatched order found.",
      });
      return;
    }

    // 10. Multiple Orders with Same Customer Phone: Do NOT choose automatically
    if (res.multipleMatches && res.matchingOrders && res.matchingOrders.length > 1) {
      setMultipleMatchingOrders(res.matchingOrders);
      setMultipleMatchingPhone(cleanPhone);
      setSearchFeedback(null);
      return;
    }

    if (res.order) {
      setSessionPickedUpIds((prev) => Array.from(new Set([...prev, res.order!.id])));
      setHighlightedOrderId(res.order.id);
      setSearchFeedback({
        type: "success",
        message: `Order ${res.order.orderNumber} auto-filled & marked as Picked Up!`,
      });
      triggerToast(`Order ${res.order.orderNumber} added to table as Picked Up!`);

      // Auto-clear input after a brief delay so staff can immediately enter next number
      setTimeout(() => {
        setCustomerMobileInput("");
        setSearchFeedback(null);
        setHighlightedOrderId(null);
      }, 3500);
    }
  };

  const selectOrderPickup = (selectedOrder: Order) => {
    processPickup(multipleMatchingPhone, selectedOrder.id);
    setMultipleMatchingOrders(null);
    setMultipleMatchingPhone("");
    setCustomerMobileInput("");
  };

  const handleCustomerMobileChange = (val: string) => {
    setCustomerMobileInput(val);
    const clean = normalizePhoneDigits(val);
    if (clean.length === 10) {
      processPickup(clean);
    } else {
      setSearchFeedback(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const clean = normalizePhoneDigits(customerMobileInput);
      if (clean.length >= 10) {
        processPickup(clean);
      } else if (customerMobileInput.trim()) {
        setSearchFeedback({ type: "error", message: "No eligible dispatched order found." });
      }
    }
  };

  // Filtered Orders for the active partner based on Status Filter and Search Query
  const displayedOrders = useMemo(() => {
    return currentPartnerOrders.filter((o) => {
      // Status tab filter
      const cStatus = o.dispatch?.courierStatus;
      const hasLlr = Boolean(
        o.dispatch?.llrNumber &&
        o.dispatch.llrNumber.trim() &&
        o.dispatch.llrNumber !== o.dispatch.dispatchId &&
        !o.dispatch.llrNumber.toLowerCase().startsWith("dsp")
      );

      if (statusFilter === "PICKED_UP") {
        if (cStatus !== "PICKED_UP" && cStatus !== "SHIPPED") {
          return false;
        }
      } else if (statusFilter === "SHIPPED") {
        if (cStatus !== "SHIPPED" && !hasLlr) {
          return false;
        }
      } else if (statusFilter === "DELIVERED") {
        if (cStatus !== "DELIVERED") {
          return false;
        }
      } else if (statusFilter === "MISSING_LLR") {
        if (hasLlr) {
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

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const totalPages = Math.ceil(displayedOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayedOrders.slice(start, start + pageSize);
  }, [displayedOrders, page, pageSize]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, adminPartnerFilter]);

  // Inline handlers
  const handleSavePickupPhone = (orderId: string, orderNumber: string, val: string) => {
    updateCourierDetails(orderId, { pickupPhone: val });
    triggerToast(`Pickup phone saved for ${orderNumber}`);
  };

  const handleSaveLlr = (orderId: string, orderNumber: string, val: string) => {
    const trimmed = (val || "").trim();
    if (trimmed) {
      updateCourierDetails(orderId, {
        llrNumber: trimmed,
        courierStatus: "SHIPPED",
      });
      triggerToast(`Order ${orderNumber} LLR ${trimmed} saved & status marked Shipped!`);
    } else {
      updateCourierDetails(orderId, {
        llrNumber: undefined,
        courierStatus: "PICKED_UP",
      });
      triggerToast(`LLR cleared for ${orderNumber}`);
    }
  };

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isAllDisplayedSelected =
    paginatedOrders.length > 0 &&
    paginatedOrders.every((o) => selectedIds.includes(o.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedOrders.map((o) => o.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
    } else {
      const pageIdSet = new Set(paginatedOrders.map((o) => o.id));
      setSelectedIds(selectedIds.filter((id) => !pageIdSet.has(id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Export handlers (Admin only)
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Order ID",
      "Dispatch ID",
      "Customer Name",
      "Customer Mobile",
      "Pickup Phone",
      "Courier Partner",
      "LLR / Tracking #",
      "Courier Status",
      "Picked Up Timestamp",
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
      order.dispatch.courierName || currentPartner.name,
      order.dispatch.llrNumber || "",
      order.dispatch.courierStatus,
      order.dispatch.pickedUpAt ? formatDate(order.dispatch.pickedUpAt) : "",
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
      "Customer Name",
      "Customer Mobile",
      "Courier",
      "LLR / Tracking #",
      "Courier Status",
      "Picked Up Timestamp",
    ];

    const rows = displayedOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      order.dispatch.dispatchId || "",
      order.customer.name,
      order.customer.mobile,
      order.dispatch.courierName || currentPartner.name,
      order.dispatch.llrNumber || "-",
      order.dispatch.courierStatus,
      order.dispatch.pickedUpAt ? formatDate(order.dispatch.pickedUpAt) : "-",
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToPdf({
      title: `${currentPartner.name} - Picked Up Manifest`,
      subtitle: `Total Orders: ${displayedOrders.length} | Export Date: ${new Date().toLocaleDateString("en-IN")}`,
      filename: `Courier_Hub_Manifest_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-4 max-w-full pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP SECTION: Customer Mobile Number Input ONLY */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-2xs">
        <label 
          htmlFor="customer-mobile-input" 
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          Customer Mobile Number
        </label>
        <div className="relative max-w-sm">
          <input
            id="customer-mobile-input"
            ref={mobileInputRef}
            type="tel"
            inputMode="numeric"
            value={customerMobileInput}
            onChange={(e) => handleCustomerMobileChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter customer mobile number"
            className="w-full text-xs font-mono py-2 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 outline-none transition-all shadow-2xs"
            autoFocus
          />
        </div>

        {/* Small "No order found" message */}
        {searchFeedback?.type === "error" && (
          <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{searchFeedback.message}</span>
          </p>
        )}

        {/* Success auto-pickup confirmation */}
        {searchFeedback?.type === "success" && (
          <p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{searchFeedback.message}</span>
          </p>
        )}
      </div>

      {/* Courier Partner Tabs & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200">
        {(!isCourierUser || !userCourierPartnerId) ? (
          <div className="flex items-center gap-2 overflow-x-auto text-xs py-0.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
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
                    setPage(1);
                    if (typeof window !== "undefined") {
                      const params = new URLSearchParams(window.location.search);
                      params.set("partner", cp.code);
                      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
                    }
                  }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 text-xs",
                    isSelected
                      ? "bg-orange-600 text-white shadow-xs ring-1 ring-orange-500"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  <span>{cp.name}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10.5px] font-bold",
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
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <span className="px-3 py-1 bg-orange-100 text-orange-800 border border-orange-200 rounded-lg">
              {currentPartner.name}
            </span>
          </div>
        )}

        {/* Manifest Export Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center p-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center justify-center p-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            title="Export PDF"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Filter Sub-tabs & Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-xs overflow-x-auto">
          {[
            { key: "ALL", label: "All Picked Up" },
            { key: "PICKED_UP", label: "Picked Up" },
            { key: "SHIPPED", label: "Shipped" },
            ...(!isCourierUser ? [{ key: "MISSING_LLR", label: "Missing LLR" }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={cn(
                "px-3 py-1 rounded-md font-semibold transition-all whitespace-nowrap cursor-pointer",
                statusFilter === tab.key
                  ? "bg-white text-slate-900 shadow-xs font-bold"
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
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search by Order, Dispatch ID, Mobile..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 text-slate-800"
          />
        </div>
      </div>

      {/* Table Section (Compact Full-Width Spreadsheet Grid) */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[11px] uppercase tracking-tight">
                {/* Checkbox Header */}
                <th className="py-2.5 px-2 w-10 text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  <input
                    type="checkbox"
                    checked={isAllDisplayedSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                  />
                </th>
                <th className="py-2.5 px-2 w-12 text-center border-r border-b-2 border-slate-300 bg-slate-100">S.No</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Date</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Customer Mobile</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Order ID</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Dispatch ID</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Customer</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Courier</th>
                <th className="py-2.5 px-3 min-w-[150px] border-r border-b-2 border-slate-300 bg-slate-100">LLR / Tracking</th>
                <th className="py-2.5 px-3 min-w-[130px] border-b-2 border-slate-300 bg-slate-100">Courier Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 border-b border-slate-300">
                    <Package className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">No picked up orders in this queue</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Enter a customer mobile number above to automatically verify and auto-fill parcel pickup into this table.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, idx) => {
                  const isSelected = selectedIds.includes(order.id);
                  const isHighlighted = highlightedOrderId === order.id;
                  const cStatus = order.dispatch?.courierStatus;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setInspectOrder(order)}
                      className={cn(
                        "hover:bg-orange-50/40 transition-colors cursor-pointer border-b border-slate-200",
                        isSelected && "bg-orange-50/60",
                        isHighlighted && "bg-emerald-50 ring-2 ring-emerald-400 font-semibold"
                      )}
                    >
                      {/* Checkbox */}
                      <td 
                        className="py-2.5 px-2 text-center border-r border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(order.id)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                        />
                      </td>

                      {/* 1. S.No */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      {/* 2. Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium border-r border-slate-200">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* 3. Customer Mobile */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{order.customer.mobile}</span>
                        </div>
                      </td>

                      {/* 4. Order ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900 border-r border-slate-200">
                        {order.orderNumber}
                      </td>

                      {/* 5. Dispatch ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">
                        {order.dispatch?.dispatchId || order.dispatch?.llrNumber ? (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                            {order.dispatch.dispatchId || order.dispatch.llrNumber}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      {/* 6. Customer */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-800 truncate max-w-[160px]">
                          {order.customer.name}
                        </div>
                      </td>

                      {/* 7. Courier */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">
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
                          {order.dispatch?.courierName || currentPartner.name}
                        </span>
                      </td>

                      {/* 8. LLR / Tracking Number */}
                      <td className="py-2 px-3 border-r border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <InlineLlrInput
                          orderId={order.id}
                          orderNumber={order.orderNumber}
                          initialValue={
                            order.dispatch?.llrNumber &&
                            order.dispatch.llrNumber !== order.dispatch.dispatchId &&
                            !order.dispatch.llrNumber.toLowerCase().startsWith("dsp")
                              ? order.dispatch.llrNumber
                              : ""
                          }
                          onSave={handleSaveLlr}
                        />
                      </td>

                      {/* 9. Courier Status: "Picked Up" or "Shipped" */}
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={cStatus === "SHIPPED" ? "SHIPPED" : "PICKED_UP"}
                          onChange={(e) => {
                            const newStatus = e.target.value as CourierStatus;
                            updateCourierDetails(order.id, {
                              courierStatus: newStatus,
                              llrNumber: order.dispatch?.llrNumber,
                            });
                            triggerToast(`Order ${order.orderNumber} status updated to ${newStatus === "SHIPPED" ? "Shipped" : "Picked Up"}`);
                          }}
                          className={cn(
                            "text-xs font-bold rounded px-2 py-1 border shadow-2xs outline-none cursor-pointer transition-colors",
                            cStatus === "SHIPPED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                              : "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100"
                          )}
                        >
                          <option value="PICKED_UP">Picked Up</option>
                          <option value="SHIPPED">Shipped</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-3 border-t border-slate-300 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing {displayedOrders.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, displayedOrders.length)} of {displayedOrders.length} orders
            </span>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none ml-2 cursor-pointer font-medium"
            >
              <option value={10}>10 / page</option>
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Multiple Matching Orders Selection Modal (Section 10) */}
      {multipleMatchingOrders && multipleMatchingOrders.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div 
            className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 bg-orange-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Multiple Dispatched Orders Found ({multipleMatchingOrders.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customer Mobile: <strong className="font-mono text-slate-700">{multipleMatchingPhone}</strong>. Select the specific order to pick up:
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMultipleMatchingOrders(null);
                  setMultipleMatchingPhone("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10.5px]">
                    <th className="py-2 px-3 border-b border-r border-slate-200">Order ID</th>
                    <th className="py-2 px-3 border-b border-r border-slate-200">Dispatch ID</th>
                    <th className="py-2 px-3 border-b border-r border-slate-200">Customer</th>
                    <th className="py-2 px-3 border-b border-r border-slate-200">Order Date</th>
                    <th className="py-2 px-3 border-b text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {multipleMatchingOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">
                        {ord.orderNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-200">
                        {ord.dispatch?.dispatchId || "-"}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <span className="font-semibold text-slate-800 block truncate">{ord.customer.name}</span>
                        {ord.customer.city && <span className="text-[10px] text-slate-400 block">{ord.customer.city}</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 border-r border-slate-200">
                        {formatDate(ord.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => selectOrderPickup(ord)}
                          className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-bold transition-colors cursor-pointer shadow-xs"
                        >
                          Select & Pick Up
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setMultipleMatchingOrders(null);
                  setMultipleMatchingPhone("");
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
