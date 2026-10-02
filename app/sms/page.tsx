"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Phone,
  FileSpreadsheet, 
  FileText, 
  CheckCheck, 
  CheckSquare, 
  X,
  Truck
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatDate, cn, matchesDateFilter, normalizePhoneDigits } from "@/lib/utils";
import { Order, SmsStatus } from "@/types/orderflow";
import { exportToXlsx, exportToPdf } from "@/lib/export-utils";
import { showToast } from "@/components/ui/toast";

function SmsMonitoringContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "ALL";
  const initialPartnerParam = searchParams.get("partner") || "ALL";

  const {
    orders,
    user,
    courierPartners,
    updateSmsStatus,
    bulkUpdateSmsStatus,
    updateOrderStatus,
    updateCourierDetails,
    dateFilter,
    customDate,
  } = useOrderFlow();

  const isCourierUser = user.role === "COURIER";
  const userCourierPartnerId = user.courierPartnerId;

  // Filter out any unwanted courier partners (e.g. Professional Courier)
  const activeCourierPartners = useMemo(() => {
    return courierPartners.filter(
      (cp) => cp.code !== "PROFESSIONAL" && !cp.name.toLowerCase().includes("professional")
    );
  }, [courierPartners]);

  // Courier partner filter state: "ALL" or specific partner code e.g. "ST_COURIER" | "DTDC" | "INDIA_POST"
  const [courierFilter, setCourierFilter] = useState<string>(() => {
    if (isCourierUser && userCourierPartnerId && userCourierPartnerId !== "PROFESSIONAL") {
      return userCourierPartnerId;
    }
    return initialPartnerParam;
  });

  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sync courier filter and status with URL params
  React.useEffect(() => {
    const p = searchParams.get("partner");
    if (isCourierUser && userCourierPartnerId && userCourierPartnerId !== "PROFESSIONAL") {
      setCourierFilter(userCourierPartnerId);
    } else if (p) {
      setCourierFilter(p);
    }

    const s = searchParams.get("status");
    if (s) {
      setStatusFilter(s);
    }
  }, [searchParams, isCourierUser, userCourierPartnerId]);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Helper to reliably resolve an order's courier partner code
  const getOrderCourierCode = (o: Order): string => {
    if (o.dispatch?.courierPartnerId) {
      return o.dispatch.courierPartnerId;
    }
    const name = (o.dispatch?.courierName || "").toLowerCase();
    if (name.includes("india") || name.includes("post")) return "INDIA_POST";
    if (name.includes("dtdc")) return "DTDC";
    if (name.includes("st courier") || name.includes("st")) return "ST_COURIER";
    return "ST_COURIER";
  };

  // Helper to resolve display name of an order's courier partner
  const getOrderCourierName = (o: Order): string => {
    if (o.dispatch?.courierName && o.dispatch.courierName !== "Courier") {
      return o.dispatch.courierName;
    }
    const code = getOrderCourierCode(o);
    const matched = activeCourierPartners.find((c) => c.code === code);
    return matched?.name || (code === "DTDC" ? "DTDC" : code === "INDIA_POST" ? "India Post" : "ST Courier");
  };

  // ONLY orders that have reached "SHIPPED" in Courier Hub (when LLR / Tracking is entered)
  // Filtered by global TopBar date filter / calendar picker
  const shippedOrders = useMemo(() => {
    return orders.filter((o) => {
      const isShipped = 
        o.dispatch?.courierStatus === "SHIPPED" || 
        o.dispatch?.courierStatus === "DELIVERED" || 
        Boolean(o.dispatch?.llrNumber && o.dispatch.llrNumber.trim()) || 
        Boolean(o.shippedAt) || 
        Boolean(o.dispatch?.shippedAt);

      if (!isShipped) return false;

      // Relevant date: when SMS sent, when parcel shipped, or fallback to updated/created
      const relevantDate = o.sms?.sentAt || o.dispatch?.shippedAt || o.shippedAt || o.updatedAt || o.createdAt;
      return matchesDateFilter(relevantDate, dateFilter, customDate);
    });
  }, [orders, dateFilter, customDate]);

  // Partner order counts across shipped orders for courier selector badges
  const partnerCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: shippedOrders.length };
    activeCourierPartners.forEach((cp) => {
      counts[cp.code] = 0;
    });

    shippedOrders.forEach((o) => {
      const code = getOrderCourierCode(o);
      if (counts[code] !== undefined) {
        counts[code]++;
      }
    });

    return counts;
  }, [shippedOrders, activeCourierPartners]);

  // Shipped orders filtered by selected courier partner
  const partnerOrders = useMemo(() => {
    if (isCourierUser && userCourierPartnerId) {
      return shippedOrders.filter((o) => getOrderCourierCode(o) === userCourierPartnerId);
    }
    if (courierFilter === "ALL") {
      return shippedOrders;
    }
    return shippedOrders.filter((o) => getOrderCourierCode(o) === courierFilter);
  }, [shippedOrders, courierFilter, isCourierUser, userCourierPartnerId]);

  // Overall counts for the selected courier partner
  const totalSms = partnerOrders.length;
  const sentCount = partnerOrders.filter((o) => o.sms.status === "SENT").length;
  const pendingCount = partnerOrders.filter((o) => o.sms.status === "PENDING").length;
  const failedCount = partnerOrders.filter((o) => o.sms.status === "FAILED").length;
  const deliveryRate = totalSms > 0 ? Math.round((sentCount / totalSms) * 100) : 0;

  // Final orders filtered by SMS Status and Search query
  const smsOrders = useMemo(() => {
    return partnerOrders.filter((o) => {
      // Filter by SMS status
      if (statusFilter !== "ALL" && o.sms.status !== statusFilter) {
        return false;
      }

      // Search across Order #, Customer Name, Mobile, Courier Name, LLR #
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const courierName = getOrderCourierName(o).toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.mobile.toLowerCase().includes(q) ||
          courierName.includes(q) ||
          (o.dispatch.llrNumber && o.dispatch.llrNumber.toLowerCase().includes(q)) ||
          (o.sms.providerMessageId && o.sms.providerMessageId.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [partnerOrders, statusFilter, searchQuery]);

  // Handle Courier Partner change
  const handleSelectCourierPartner = (code: string) => {
    setCourierFilter(code);
    setSelectedIds([]);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (code === "ALL") {
        params.delete("partner");
      } else {
        params.set("partner", code);
      }
      const newSearch = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState({}, "", `${window.location.pathname}${newSearch}`);
    }
  };

  // Bulk selection state helpers
  const isAllSelected = smsOrders.length > 0 && selectedIds.length === smsOrders.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < smsOrders.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(smsOrders.map((o) => o.id));
    }
  };

  const handleToggleSelect = (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleBulkMarkSent = () => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      bulkUpdateSmsStatus(selectedIds, "SENT");
      triggerToast(`${selectedIds.length} order(s) marked as SMS Sent!`);
      setSelectedIds([]);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleUpdateSmsStatus = (orderId: string, orderNumber: string, newStatus: SmsStatus) => {
    updateSmsStatus(orderId, newStatus);
    const label = newStatus === "SENT" ? "Sent" : newStatus === "PENDING" ? "Waiting for SMS" : "Failed";
    triggerToast(`Order ${orderNumber} SMS status updated to ${label}`);
  };

  // Toast feedback state
  const triggerToast = (msg: string) => {
    showToast(msg, "success");
  };

  // Current selected partner object
  const currentPartnerName = useMemo(() => {
    if (courierFilter === "ALL") return "All Couriers";
    const found = activeCourierPartners.find((c) => c.code === courierFilter);
    return found?.name || courierFilter;
  }, [courierFilter, activeCourierPartners]);

  // Export handler matching client's exact Excel formats:
  // - ST Courier: [Mobile no, Name, Trcking id, Transport, Website] -> st DDMM.xlsx (e.g. st 3009.xlsx)
  // - DTDC: [Mobile no, Tracking id, Transport, Website] -> dtdcDDMM.xlsx (e.g. dtdc3001.xlsx)
  const handleExportExcel = () => {
    const targetOrders = selectedIds.length > 0 
      ? smsOrders.filter((o) => selectedIds.includes(o.id))
      : smsOrders;

    if (targetOrders.length === 0) {
      triggerToast("No orders available to export");
      return;
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");

    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = "";

    if (courierFilter === "DTDC") {
      // Exact DTDC format from client screenshot:
      // Columns: [Mobile no, Tracking id, Transport, Website]
      // Values: [Phone, Tracking id, "DTDC courier", "dtdc.com"]
      headers = ["Mobile no", "Tracking id", "Transport", "Website"];
      rows = targetOrders.map((order) => [
        normalizePhoneDigits(order.customer.mobile),
        order.dispatch.llrNumber || "",
        "DTDC courier",
        "dtdc.com",
      ]);
      filename = `dtdc${dd}${mm}.xlsx`;
    } else if (courierFilter === "ST_COURIER") {
      // Exact ST Courier format from client screenshot:
      // Columns: [Mobile no, Name, Trcking id, Transport, Website]
      // Values: [Phone, "Sir/Madam", Trcking id, "ST courier", "stcourier.com"]
      headers = ["Mobile no", "Name", "Trcking id", "Transport", "Website"];
      rows = targetOrders.map((order) => [
        normalizePhoneDigits(order.customer.mobile),
        "Sir/Madam",
        order.dispatch.llrNumber || "",
        "ST courier",
        "stcourier.com",
      ]);
      filename = `st ${dd}${mm}.xlsx`;
    } else if (courierFilter === "INDIA_POST") {
      headers = ["Mobile no", "Tracking id", "Transport", "Website"];
      rows = targetOrders.map((order) => [
        normalizePhoneDigits(order.customer.mobile),
        order.dispatch.llrNumber || "",
        "India Post",
        "indiapost.gov.in",
      ]);
      filename = `indiapost${dd}${mm}.xlsx`;
    } else {
      // "ALL" couriers export:
      headers = ["Mobile no", "Tracking id", "Transport", "Website"];
      rows = targetOrders.map((order) => {
        const code = getOrderCourierCode(order);
        let transport = "ST courier";
        let website = "stcourier.com";
        if (code === "DTDC") {
          transport = "DTDC courier";
          website = "dtdc.com";
        } else if (code === "INDIA_POST") {
          transport = "India Post";
          website = "indiapost.gov.in";
        }
        return [
          normalizePhoneDigits(order.customer.mobile),
          order.dispatch.llrNumber || "",
          transport,
          website,
        ];
      });
      filename = `sms ${dd}${mm}.xlsx`;
    }

    exportToXlsx(filename, headers, rows);
    triggerToast(`Exported ${rows.length} records in ${currentPartnerName} format (${filename})`);
  };

  const handleExportPdf = () => {
    const targetOrders = selectedIds.length > 0 
      ? smsOrders.filter((o) => selectedIds.includes(o.id))
      : smsOrders;

    if (targetOrders.length === 0) {
      triggerToast("No orders available to export");
      return;
    }

    const headers = [
      "S.No",
      "Order ID",
      "Customer Name",
      "Phone Number",
      "Courier Partner",
      "LLR Number",
      "SMS Status",
      "Date",
    ];

    const rows = targetOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      order.customer.name,
      order.customer.mobile,
      getOrderCourierName(order),
      order.dispatch.llrNumber || "-",
      order.sms.status,
      formatDate(order.sms.sentAt || order.createdAt),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileSuffix = courierFilter === "ALL" ? "All" : courierFilter;
    exportToPdf({
      title: `Ping4SMS Gateway - SMS Delivery Monitoring Report (${currentPartnerName})`,
      subtitle: `Courier: ${currentPartnerName} | Status Filter: ${statusFilter} | Total Records: ${targetOrders.length}`,
      filename: `SMS_Monitoring_${fileSuffix}_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-4 max-w-full pb-16">
      {/* TOP SECTION: Courier Partner Selector Bar (matching Courier Hub style) */}
      {(!isCourierUser || !userCourierPartnerId) && (
        <div className="bg-white p-3 rounded-lg border border-slate-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto text-xs py-0.5 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span>Courier Partner:</span>
            </span>

            {/* "All" Courier Tab */}
            <button
              type="button"
              onClick={() => handleSelectCourierPartner("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 text-xs shadow-2xs",
                courierFilter === "ALL"
                  ? "bg-orange-600 text-white shadow-xs ring-1 ring-orange-500"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
              )}
            >
              <span>All</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10.5px] font-bold",
                  courierFilter === "ALL"
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                )}
              >
                {partnerCounts["ALL"] || 0}
              </span>
            </button>

            {/* Individual Courier Partner Tabs (ST Courier, DTDC, India Post) */}
            {activeCourierPartners.map((cp) => {
              const isSelected = courierFilter === cp.code;
              const count = partnerCounts[cp.code] || 0;
              return (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => handleSelectCourierPartner(cp.code)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 text-xs shadow-2xs",
                    isSelected
                      ? "bg-orange-600 text-white shadow-xs ring-1 ring-orange-500"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
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

          {/* Quick Partner Summary */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="text-[11px] font-semibold text-slate-500 hidden md:inline">
              Viewing: <strong className="text-slate-800">{currentPartnerName}</strong> ({totalSms} records)
            </span>
          </div>
        </div>
      )}

      {/* Metric Cards (Compact matching Courier page with themed border colors) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total SMS */}
        <div
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "px-3.5 py-2 rounded-lg border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "ALL" 
              ? "border-orange-500 ring-1 ring-orange-500/20 bg-orange-50/10" 
              : "border-slate-300 hover:border-orange-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Total Messages</span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{deliveryRate}% Delivered</span>
          </div>
          <div className="text-xl font-black text-slate-900 mt-0.5 tracking-tight font-mono">
            {totalSms}
          </div>
        </div>

        {/* Sent */}
        <div
          onClick={() => setStatusFilter("SENT")}
          className={cn(
            "px-3.5 py-2 rounded-lg border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "SENT" 
              ? "border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/10" 
              : "border-emerald-300 hover:border-emerald-400"
          )}
        >
          <div className="flex items-center justify-between text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider">
            <span>Delivered (SENT)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono mt-0.5 tracking-tight">
            {sentCount}
          </div>
        </div>

        {/* Pending / Waiting for SMS */}
        <div
          onClick={() => setStatusFilter("PENDING")}
          className={cn(
            "px-3.5 py-2 rounded-lg border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "PENDING" 
              ? "border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/10" 
              : "border-amber-300 hover:border-amber-400"
          )}
        >
          <div className="flex items-center justify-between text-[10.5px] font-bold text-amber-700 uppercase tracking-wider">
            <span>Waiting for SMS</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-600 font-mono mt-0.5 tracking-tight">
            {pendingCount}
          </div>
        </div>

        {/* Failed */}
        <div
          onClick={() => setStatusFilter("FAILED")}
          className={cn(
            "px-3.5 py-2 rounded-lg border bg-white shadow-2xs cursor-pointer transition-all",
            statusFilter === "FAILED" 
              ? "border-rose-500 ring-1 ring-rose-500/20 bg-rose-50/10" 
              : "border-rose-300 hover:border-rose-400"
          )}
        >
          <div className="flex items-center justify-between text-[10.5px] font-bold text-rose-700 uppercase tracking-wider">
            <span>Delivery Failed</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-600 font-mono mt-0.5 tracking-tight">
            {failedCount}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* 1st Position: Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Mobile, Order #, LLR, Courier..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-orange-500 font-medium text-slate-800 placeholder-slate-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Right Side: Active Filter Badges + Selected Bulk Actions + Export Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end w-full sm:w-auto">
            {/* Active Status Filter Badge (if filtered from top metric cards) */}
            {statusFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold border border-orange-200">
                <span>Filter: {statusFilter === "PENDING" ? "Waiting for SMS" : statusFilter === "SENT" ? "Sent" : "Failed"}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="hover:text-red-700 cursor-pointer p-0.5"
                  title="Clear status filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Active Courier Filter Badge (if non-ALL) */}
            {courierFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-300">
                <span>Courier: {currentPartnerName}</span>
                <button
                  type="button"
                  onClick={() => handleSelectCourierPartner("ALL")}
                  className="hover:text-red-700 cursor-pointer p-0.5"
                  title="Clear courier filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Bulk Selection Actions (Only shown when rows are checked) */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold text-orange-900 text-xs">
                  <CheckSquare className="w-3.5 h-3.5 text-orange-700" />
                  <span>{selectedIds.length} selected</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="hover:text-red-600 p-0.5 ml-0.5 text-slate-400 hover:bg-orange-200/70 rounded cursor-pointer transition-colors"
                    title="Clear selection"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="h-4 w-px bg-orange-200 mx-0.5" />

                <button
                  type="button"
                  onClick={handleBulkMarkSent}
                  disabled={isBulkUpdating}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs cursor-pointer active:scale-98 transition-all"
                  title="Mark selected orders as SMS Sent"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Sent</span>
                </button>
              </div>
            )}

            {/* Export Actions (Excel .xlsx & PDF) */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
              <button
                onClick={handleExportExcel}
                title={`Export ${currentPartnerName} SMS Format Excel (.xlsx)`}
                className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer group relative"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportPdf}
                title={`Export ${currentPartnerName} SMS Records to PDF`}
                className="inline-flex items-center justify-center p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* SMS Excel Spreadsheet Table */}
        <div className="table-scroll-container w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)] min-h-[380px] relative">
          <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-300">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[11px] uppercase tracking-tight shadow-xs">
              <tr>
                <th className="sticky top-0 z-20 py-2.5 px-2 w-[4%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  <input
                    type="checkbox"
                    aria-label="Select all orders"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer align-middle"
                  />
                </th>
                <th className="sticky top-0 z-20 py-2.5 px-2 w-[4%] text-center border-r border-b-2 border-slate-300 bg-slate-100">S.No</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 w-[15%] border-r border-b-2 border-slate-300 bg-slate-100">Order ID</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 w-[20%] border-r border-b-2 border-slate-300 bg-slate-100">Customer Name</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 w-[16%] border-r border-b-2 border-slate-300 bg-slate-100">Customer Phone Number</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 w-[13%] border-r border-b-2 border-slate-300 bg-slate-100">Courier</th>
                <th className="sticky top-0 z-20 py-2.5 px-3 w-[14%] border-r border-b-2 border-slate-300 bg-slate-100">LLR Number</th>
                <th className="sticky top-0 z-20 py-2.5 px-2 w-[14%] text-center border-b-2 border-slate-300 bg-slate-200/90 text-slate-800">SMS Status</th>
              </tr>
            </thead>
            <tbody>
              {smsOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 border-b border-slate-300">
                    <Send className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">
                      {courierFilter !== "ALL"
                        ? `No Shipped Orders found for ${currentPartnerName}`
                        : "No Shipped Orders for SMS Tracking"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {shippedOrders.length === 0
                        ? "Orders will appear here automatically once marked as 'Shipped' in the Courier Hub."
                        : "Try switching courier partner tabs, status filters, or clearing the search query."}
                    </p>
                  </td>
                </tr>
              ) : (
                smsOrders.map((order, index) => {
                  const courierCode = getOrderCourierCode(order);
                  const courierDisplayName = getOrderCourierName(order);

                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "hover:bg-orange-50/40 transition-colors group",
                        selectedIds.includes(order.id) && "bg-orange-50/60"
                      )}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-2.5 px-2 text-center border-r border-b border-slate-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select order ${order.orderNumber}`}
                          checked={selectedIds.includes(order.id)}
                          onChange={() => handleToggleSelect(order.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer align-middle"
                        />
                      </td>

                      {/* 1. S.No (Spreadsheet row index) */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 bg-slate-50 border-r border-b border-slate-300">
                        {index + 1}
                      </td>

                      {/* 2. Order ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-900 border-r border-b border-slate-300 text-xs">
                        {order.orderNumber}
                      </td>

                      {/* 3. Customer Name */}
                      <td className="py-2.5 px-3 border-r border-b border-slate-300 truncate">
                        <span className="font-semibold text-slate-800 truncate block text-xs" title={order.customer.name}>
                          {order.customer.name}
                        </span>
                        {order.customer.city && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {order.customer.city}
                          </span>
                        )}
                      </td>

                      {/* 4. Customer Phone Number */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700 border-r border-b border-slate-300 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{order.customer.mobile}</span>
                        </div>
                      </td>

                      {/* 5. Courier Partner Pill Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300 text-xs">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-bold border inline-block",
                            courierCode === "INDIA_POST"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : courierCode === "DTDC"
                              ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                              : courierCode === "ST_COURIER"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {courierDisplayName}
                        </span>
                      </td>

                      {/* 6. LLR Number */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300 font-mono text-xs">
                        {order.dispatch.llrNumber ? (
                          <span className="font-semibold text-slate-800 font-mono">
                            {order.dispatch.llrNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No LLR</span>
                        )}
                      </td>

                      {/* 7. SMS Status (Interactive Manual Dropdown) */}
                      <td
                        className="py-2.5 px-2 text-center whitespace-nowrap border-b border-slate-300 bg-slate-50/50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <select
                            value={order.sms.status}
                            onChange={(e) => handleUpdateSmsStatus(order.id, order.orderNumber, e.target.value as SmsStatus)}
                            className={cn(
                              "text-xs font-semibold py-1 px-2.5 rounded-md border shadow-2xs outline-none cursor-pointer transition-all",
                              order.sms.status === "SENT"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                : order.sms.status === "FAILED"
                                ? "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100"
                                : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 font-bold"
                            )}
                          >
                            <option value="PENDING">Waiting for SMS</option>
                            <option value="SENT">Sent</option>
                            <option value="FAILED">Failed</option>
                          </select>
                        </div>
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
        onUpdateStatus={updateOrderStatus}
        onUpdateCourier={updateCourierDetails}
        userRole={user.role}
        courierPartnerId={user.courierPartnerId}
      />
    </div>
  );
}

export default function SmsMonitoringPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SmsMonitoringContent />
    </Suspense>
  );
}
