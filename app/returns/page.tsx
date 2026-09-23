"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useOrderFlow } from "@/lib/hooks";
import { ReturnCase, ReturnStatus, ReturnType, ReturnReason, RefundStatus } from "@/types/orderflow";
import { ReturnStatusBadge, RefundStatusBadge } from "@/components/returns/return-status-badge";
import { ReturnDetailsDrawer } from "@/components/returns/return-details-drawer";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatINR, formatDate, cn, matchesDateFilter } from "@/lib/utils";
import { 
  RotateCcw, 
  Search, 
  Filter, 
  X, 
  Box, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  ArrowRightLeft, 
  Eye, 
  FileSpreadsheet, 
  FileText,
  CheckCheck,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

function ReturnsContent() {
  const searchParams = useSearchParams();
  const initialStatusParam = searchParams.get("status") || "ALL";

  const { 
    returns, 
    orders, 
    dateFilter, 
    customDate, 
    user,
    updateOrderStatus,
    updateCourierDetails
  } = useOrderFlow();

  // Modals & Drawers
  const [selectedReturn, setSelectedReturn] = useState<ReturnCase | null>(null);
  const [inspectedOrder, setInspectedOrder] = useState<any | null>(null);

  // Tab & Filter states
  const [activeTab, setActiveTab] = useState<string>(initialStatusParam);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [refundStatusFilter, setRefundStatusFilter] = useState<string>("ALL");
  const [replacementStatusFilter, setReplacementStatusFilter] = useState<string>("ALL");
  const [courierFilter, setCourierFilter] = useState<string>("ALL");

  // Sorting & Pagination
  const [sortField, setSortField] = useState<"createdAt" | "expectedAmount" | "returnId">("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected checkboxes for batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 1. Filter returns by current TopBar Date Filter (All, Today, Yesterday, Last 7 Days, This Month, Custom)
  const dateFilteredReturns = useMemo(() => {
    return returns.filter((r) => matchesDateFilter(r.createdAt, dateFilter, customDate));
  }, [returns, dateFilter, customDate]);

  // 2. Compute dynamic Summary Card counts based on currently selected date range
  const summaryCards = useMemo(() => {
    let total = dateFilteredReturns.length;
    let requested = 0;
    let awaiting = 0;
    let receivedQc = 0;
    let refundPending = 0;
    let replacementPending = 0;

    dateFilteredReturns.forEach((r) => {
      if (r.status === "Return Requested") requested++;
      if (r.status === "Awaiting Return" || r.status === "Return Approved") awaiting++;
      if (r.status === "Return Received" || r.status === "QC Pending") receivedQc++;
      if (r.status === "Refund Pending") refundPending++;
      if (r.status === "Replacement Pending") replacementPending++;
    });

    return {
      total,
      requested,
      awaiting,
      receivedQc,
      refundPending,
      replacementPending,
    };
  }, [dateFilteredReturns]);

  // 3. Tab Definitions with Counts
  const tabs = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: dateFilteredReturns.length,
      "Return Requested": 0,
      Approved: 0,
      "Awaiting Return": 0,
      Received: 0,
      "QC Pending": 0,
      "Refund Pending": 0,
      Replacement: 0,
      Completed: 0,
      Rejected: 0,
    };

    dateFilteredReturns.forEach((r) => {
      if (r.status === "Return Requested") counts["Return Requested"]++;
      if (r.status === "Return Approved") counts["Approved"]++;
      if (r.status === "Awaiting Return") counts["Awaiting Return"]++;
      if (r.status === "Return Received") counts["Received"]++;
      if (r.status === "QC Pending") counts["QC Pending"]++;
      if (r.status === "Refund Pending") counts["Refund Pending"]++;
      if (r.status === "Replacement Pending" || r.status === "Replacement Dispatched") counts["Replacement"]++;
      if (r.status === "Completed") counts["Completed"]++;
      if (r.status === "Rejected" || r.status === "Cancelled") counts["Rejected"]++;
    });

    return [
      { id: "ALL", label: "All Returns", count: counts.ALL },
      { id: "Return Requested", label: "Return Requested", count: counts["Return Requested"] },
      { id: "Approved", label: "Approved", count: counts["Approved"] },
      { id: "Awaiting Return", label: "Awaiting Return", count: counts["Awaiting Return"] },
      { id: "Received", label: "Received", count: counts["Received"] },
      { id: "QC Pending", label: "QC Pending", count: counts["QC Pending"] },
      { id: "Refund Pending", label: "Refund Pending", count: counts["Refund Pending"] },
      { id: "Replacement", label: "Replacement", count: counts["Replacement"] },
      { id: "Completed", label: "Completed", count: counts["Completed"] },
      { id: "Rejected", label: "Rejected", count: counts["Rejected"] },
    ];
  }, [dateFilteredReturns]);

  // 4. Filter and Sort Returns
  const filteredReturns = useMemo(() => {
    return dateFilteredReturns.filter((r) => {
      // Tab filter
      if (activeTab !== "ALL") {
        if (activeTab === "Approved" && r.status !== "Return Approved") return false;
        else if (activeTab === "Received" && r.status !== "Return Received") return false;
        else if (activeTab === "Replacement" && !(r.status === "Replacement Pending" || r.status === "Replacement Dispatched")) return false;
        else if (activeTab === "Rejected" && !(r.status === "Rejected" || r.status === "Cancelled")) return false;
        else if (!["Approved", "Received", "Replacement", "Rejected"].includes(activeTab) && r.status !== activeTab) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          r.returnId.toLowerCase().includes(q) ||
          r.orderNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerPhone.replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ||
          r.items.some((it) => it.productName.toLowerCase().includes(q) || (it.sku && it.sku.toLowerCase().includes(q))) ||
          (r.replacement?.llr && r.replacement.llr.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Reason filter
      if (reasonFilter !== "ALL" && r.reason !== reasonFilter) return false;

      // Type filter
      if (typeFilter !== "ALL" && r.returnType !== typeFilter) return false;

      // Refund Status filter
      if (refundStatusFilter !== "ALL") {
        const refStatus = r.refund?.refundStatus || "Pending";
        if (refStatus !== refundStatusFilter) return false;
      }

      // Replacement Status filter
      if (replacementStatusFilter !== "ALL") {
        const repStatus = r.replacement?.status || "None";
        if (repStatus !== replacementStatusFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      let comp = 0;
      if (sortField === "createdAt") {
        comp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === "expectedAmount") {
        comp = a.expectedAmount - b.expectedAmount;
      } else if (sortField === "returnId") {
        comp = a.returnId.localeCompare(b.returnId);
      }
      return sortAsc ? comp : -comp;
    });
  }, [dateFilteredReturns, activeTab, searchQuery, reasonFilter, typeFilter, refundStatusFilter, replacementStatusFilter, sortField, sortAsc]);

  // 5. Pagination
  const totalPages = Math.ceil(filteredReturns.length / pageSize) || 1;
  const paginatedReturns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, page, pageSize]);

  const isAllPageSelected = paginatedReturns.length > 0 && paginatedReturns.every((r) => selectedIds.includes(r.id));

  const handleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginatedReturns.some((r) => r.id === id)));
    } else {
      const pageIds = paginatedReturns.map((r) => r.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenOrderDrawer = (orderId: string) => {
    const found = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (found) {
      setInspectedOrder(found);
    }
  };

  const activeFilterCount = (reasonFilter !== "ALL" ? 1 : 0) +
    (typeFilter !== "ALL" ? 1 : 0) +
    (refundStatusFilter !== "ALL" ? 1 : 0) +
    (replacementStatusFilter !== "ALL" ? 1 : 0);

  const handleResetFilters = () => {
    setReasonFilter("ALL");
    setTypeFilter("ALL");
    setRefundStatusFilter("ALL");
    setReplacementStatusFilter("ALL");
    setSearchQuery("");
    setPage(1);
  };

  // Export handlers
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Return ID",
      "Order ID",
      "Date",
      "Customer Name",
      "Customer Phone",
      "Items",
      "Reason",
      "Qty",
      "Expected Amount",
      "Return Status",
      "Refund Status",
      "Type",
    ];

    const rows = filteredReturns.map((rtn, idx) => [
      idx + 1,
      rtn.returnId,
      rtn.orderNumber,
      formatDate(rtn.createdAt),
      rtn.customerName,
      rtn.customerPhone,
      rtn.items.map((i) => `${i.productName} (${i.size}) x${i.requestedQuantity}`).join("; "),
      rtn.reason,
      rtn.requestedQuantity,
      rtn.expectedAmount,
      rtn.status,
      rtn.refund?.refundStatus || "Pending",
      rtn.returnType,
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(`Returns_Report_${dateStr}`, headers, rows);
  };

  const handleExportPdf = () => {
    const headers = [
      "S.No",
      "Return ID",
      "Order ID",
      "Customer",
      "Items",
      "Reason",
      "Qty",
      "Amount",
      "Status",
    ];

    const rows = filteredReturns.map((rtn, idx) => [
      idx + 1,
      rtn.returnId,
      rtn.orderNumber,
      rtn.customerName,
      rtn.items[0]?.productName || "Item",
      rtn.reason,
      rtn.requestedQuantity,
      formatINR(rtn.expectedAmount),
      rtn.status,
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToPdf({
      title: "Returns Management Report",
      subtitle: `Status Filter: ${activeTab} | Total: ${filteredReturns.length} cases`,
      filename: `Returns_Report_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-3.5 max-w-full mx-auto select-none">
      {/* KPI STATUS FILTER BUTTONS ROW (Compact with matching colored borders like other pages) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 1. ALL RETURNS */}
        <button
          onClick={() => { setActiveTab("ALL"); setPage(1); }}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            activeTab === "ALL" 
              ? "border-orange-600 ring-2 ring-orange-500/20 bg-orange-50/10" 
              : "border-slate-300 hover:border-orange-400"
          )}
        >
          <span className="text-[11px] text-slate-500 block font-medium">All Returns</span>
          <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">{summaryCards.total}</span>
        </button>

        {/* 2. RETURN REQUESTED */}
        <button
          onClick={() => { setActiveTab("Return Requested"); setPage(1); }}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            activeTab === "Return Requested" 
              ? "border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/10" 
              : "border-amber-300 hover:border-amber-400"
          )}
        >
          <span className="text-[11px] text-amber-700 font-medium block">Return Requested</span>
          <span className="text-base font-bold text-amber-800 font-mono mt-0.5 block">{summaryCards.requested}</span>
        </button>

        {/* 3. AWAITING RETURN */}
        <button
          onClick={() => { setActiveTab("Awaiting Return"); setPage(1); }}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            activeTab === "Awaiting Return" 
              ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10" 
              : "border-indigo-300 hover:border-indigo-400"
          )}
        >
          <span className="text-[11px] text-indigo-700 font-medium block">Awaiting Return</span>
          <span className="text-base font-bold text-indigo-800 font-mono mt-0.5 block">{summaryCards.awaiting}</span>
        </button>

        {/* 4. RECEIVED / QC */}
        <button
          onClick={() => { setActiveTab("QC Pending"); setPage(1); }}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            activeTab === "QC Pending" 
              ? "border-orange-600 ring-2 ring-orange-500/20 bg-orange-50/10" 
              : "border-orange-300 hover:border-orange-400"
          )}
        >
          <span className="text-[11px] text-orange-700 font-medium block">Received / QC</span>
          <span className="text-base font-bold text-orange-600 font-mono mt-0.5 block">{summaryCards.receivedQc}</span>
        </button>

        {/* 5. REFUND PENDING */}
        <button
          onClick={() => { setActiveTab("Refund Pending"); setPage(1); }}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            activeTab === "Refund Pending" 
              ? "border-rose-600 ring-2 ring-rose-500/20 bg-rose-50/10" 
              : "border-rose-300 hover:border-rose-400"
          )}
        >
          <span className="text-[11px] text-rose-700 font-medium block">Refund Pending</span>
          <span className="text-base font-bold text-rose-800 font-mono mt-0.5 block">{summaryCards.refundPending}</span>
        </button>

        {/* 6. REPLACEMENT */}
        <button
          onClick={() => { setActiveTab("Replacement"); setPage(1); }}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            activeTab === "Replacement" 
              ? "border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/10" 
              : "border-purple-300 hover:border-purple-400"
          )}
        >
          <span className="text-[11px] text-purple-700 font-medium block">Replacement</span>
          <span className="text-base font-bold text-purple-800 font-mono mt-0.5 block">{summaryCards.replacementPending}</span>
        </button>
      </div>

      {/* STATUS TABS */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto scrollbar-none pb-px">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={cn(
                "px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5 cursor-pointer",
                isSelected
                  ? "border-orange-500 text-orange-600 bg-orange-50/50 rounded-t-lg"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-tight",
                  isSelected
                    ? "bg-orange-600 text-white"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* SEARCH, FILTERS & ACTION BAR */}
      <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Left: Search Input & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Return ID, Order ID, Customer, Phone, Item..."
              className="w-full text-xs pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:border-orange-500 focus:bg-white text-slate-800 placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:border-orange-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Return Reasons</option>
            <option value="Size Issue">Size Issue</option>
            <option value="Color Issue">Color Issue</option>
            <option value="Wrong Product">Wrong Product</option>
            <option value="Damaged Product">Damaged Product</option>
            <option value="Quality Issue">Quality Issue</option>
            <option value="Product Not as Expected">Not as Expected</option>
            <option value="Customer Changed Mind">Changed Mind</option>
            <option value="Courier Damage">Courier Damage</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:border-orange-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Return Types</option>
            <option value="Refund">Refund</option>
            <option value="Replacement">Replacement</option>
            <option value="Exchange">Exchange</option>
          </select>

          <select
            value={refundStatusFilter}
            onChange={(e) => {
              setRefundStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:border-orange-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Refund Statuses</option>
            <option value="Pending">Refund Pending</option>
            <option value="Processing">Refund Processing</option>
            <option value="Refunded">Refunded</option>
            <option value="Failed">Refund Failed</option>
          </select>

          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear ({activeFilterCount})</span>
            </button>
          )}
        </div>

        {/* Right: Export & + Create Return Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            title="Download filtered returns as Excel CSV"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            title="Print or Save PDF Report"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* EXCEL SPREADSHEET TABLE VIEW (Fits in full view without horizontal scroll) */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden w-full">
        <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-300">
          <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[10.5px] uppercase tracking-tight">
            <tr>
              <th className="py-2 px-1 w-[2.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                />
              </th>
              <th className="py-2 px-1 w-[3%] text-center border-r border-b-2 border-slate-300 bg-slate-100">S.No</th>
              <th 
                className="py-2 px-1 w-[9%] border-r border-b-2 border-slate-300 bg-slate-100 cursor-pointer hover:text-slate-900"
                onClick={() => {
                  setSortField("returnId");
                  setSortAsc(!sortAsc);
                }}
              >
                <div className="flex items-center gap-0.5 truncate">
                  <span>RETURN ID</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </th>
              <th className="py-2 px-1 w-[8.5%] border-r border-b-2 border-slate-300 bg-slate-100 truncate">ORDER ID</th>
              <th 
                className="py-2 px-1 w-[7.5%] border-r border-b-2 border-slate-300 bg-slate-100 cursor-pointer hover:text-slate-900"
                onClick={() => {
                  setSortField("createdAt");
                  setSortAsc(!sortAsc);
                }}
              >
                <div className="flex items-center gap-0.5 truncate">
                  <span>DATE</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </th>
              <th className="py-2 px-1.5 w-[11.5%] border-r border-b-2 border-slate-300 bg-slate-100 truncate">CUSTOMER</th>
              <th className="py-2 px-1.5 w-[15.5%] border-r border-b-2 border-slate-300 bg-slate-100 truncate">ITEMS</th>
              <th className="py-2 px-1 w-[9%] border-r border-b-2 border-slate-300 bg-slate-100 truncate">RETURN REASON</th>
              <th className="py-2 px-1 w-[4%] text-center border-r border-b-2 border-slate-300 bg-slate-100">QTY</th>
              <th 
                className="py-2 px-1 w-[7.5%] text-right border-r border-b-2 border-slate-300 bg-slate-100 cursor-pointer hover:text-slate-900"
                onClick={() => {
                  setSortField("expectedAmount");
                  setSortAsc(!sortAsc);
                }}
              >
                <div className="flex items-center justify-end gap-0.5 truncate">
                  <span>AMOUNT</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </th>
              <th className="py-2 px-1 w-[9.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">RETURN STATUS</th>
              <th className="py-2 px-1 w-[8.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">REFUND STATUS</th>
              <th className="py-2 px-1 w-[5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">TYPE</th>
              <th className="py-2 px-1 w-[6.5%] text-center border-b-2 border-slate-300 bg-slate-200/70 text-slate-800">ACTION</th>
            </tr>
          </thead>

          <tbody>
            {paginatedReturns.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-14 text-center text-slate-400 border-b border-slate-300">
                  <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600 text-xs">No return cases found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {searchQuery || activeFilterCount > 0 ? "Try changing search keywords or clearing filters." : "Create your first return case using the button above."}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedReturns.map((rtn, index) => {
                const sNo = (page - 1) * pageSize + index + 1;
                const isChecked = selectedIds.includes(rtn.id);
                const firstItem = rtn.items[0];

                return (
                  <tr
                    key={rtn.id}
                    onClick={() => setSelectedReturn(rtn)}
                    className={cn(
                      "hover:bg-orange-50/40 transition-colors cursor-pointer group",
                      isChecked && "bg-orange-50/60"
                    )}
                  >
                    {/* Checkbox */}
                    <td 
                      className="py-1.5 px-1 text-center bg-slate-50/70 border-r border-b border-slate-300" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelect(rtn.id)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                      />
                    </td>

                    {/* S.No */}
                    <td className="py-1.5 px-1 text-center font-mono font-bold text-slate-600 bg-slate-50 border-r border-b border-slate-300 text-[10.5px]">
                      {sNo}
                    </td>

                    {/* RETURN ID */}
                    <td className="py-1.5 px-1 font-mono font-bold text-orange-700 border-r border-b border-slate-300 text-[10.5px] truncate" title={rtn.returnId}>
                      {rtn.returnId}
                    </td>

                    {/* ORDER ID */}
                    <td className="py-1.5 px-1 border-r border-b border-slate-300 font-mono text-[10.5px] truncate">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenOrderDrawer(rtn.orderId);
                        }}
                        className="font-mono font-semibold text-slate-800 hover:text-orange-600 hover:underline cursor-pointer truncate block"
                        title={rtn.orderNumber}
                      >
                        {rtn.orderNumber}
                      </button>
                    </td>

                    {/* DATE */}
                    <td className="py-1.5 px-1 text-slate-600 border-r border-b border-slate-300 font-medium text-[10.5px] truncate">
                      {formatDate(rtn.createdAt)}
                    </td>

                    {/* CUSTOMER */}
                    <td className="py-1.5 px-1.5 border-r border-b border-slate-300 truncate">
                      <span className="font-semibold text-slate-800 truncate block leading-tight text-[10.5px]" title={rtn.customerName}>
                        {rtn.customerName}
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-mono block truncate">
                        {rtn.customerPhone}
                      </span>
                    </td>

                    {/* ITEMS */}
                    <td className="py-1.5 px-1.5 border-r border-b border-slate-300 text-slate-700 truncate">
                      <span className="font-medium truncate block leading-tight text-[10.5px]" title={firstItem?.productName}>
                        {firstItem?.productName || "Item"}
                        {firstItem?.size && <span className="text-slate-400 font-normal"> · {firstItem.size}</span>}
                      </span>
                      {rtn.items.length > 1 && (
                        <span className="text-[9.5px] text-orange-700 font-semibold block truncate">
                          +{rtn.items.length - 1} item
                        </span>
                      )}
                    </td>

                    {/* RETURN REASON */}
                    <td className="py-1.5 px-1 border-r border-b border-slate-300 text-slate-700 truncate text-[10.5px]">
                      <span className="truncate block" title={rtn.reason}>{rtn.reason}</span>
                    </td>

                    {/* QTY */}
                    <td className="py-1.5 px-1 text-center font-mono font-bold text-slate-800 border-r border-b border-slate-300 text-[11px]">
                      {rtn.requestedQuantity}
                    </td>

                    {/* RETURN AMOUNT */}
                    <td className="py-1.5 px-1 text-right font-mono font-bold text-slate-900 border-r border-b border-slate-300 text-[10.5px] whitespace-nowrap">
                      {formatINR(rtn.expectedAmount)}
                    </td>

                    {/* RETURN STATUS */}
                    <td className="py-1 px-1 text-center border-r border-b border-slate-300 truncate">
                      <ReturnStatusBadge status={rtn.status} className="text-[10px] py-0.5 px-1 justify-center truncate w-full" />
                    </td>

                    {/* REFUND STATUS */}
                    <td className="py-1 px-1 text-center border-r border-b border-slate-300 truncate">
                      <RefundStatusBadge status={rtn.refund?.refundStatus} className="text-[10px] py-0.5 px-1 justify-center truncate w-full" />
                    </td>

                    {/* TYPE */}
                    <td className="py-1 px-0.5 text-center border-r border-b border-slate-300 truncate">
                      <span className={cn(
                        "px-1 py-0.2 rounded text-[9.5px] font-bold border inline-block",
                        rtn.returnType === "Replacement"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}>
                        {rtn.returnType === "Replacement" ? "Rep" : "Ref"}
                      </span>
                    </td>

                    {/* ACTION */}
                    <td className="py-1 px-1 text-center border-b border-slate-300 bg-slate-50/50" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedReturn(rtn)}
                        className="px-2 py-0.5 text-[10.5px] font-semibold text-orange-700 hover:bg-orange-100/70 border border-orange-200 rounded transition-colors inline-flex items-center gap-1 shadow-2xs whitespace-nowrap cursor-pointer"
                        title="View return details"
                      >
                        <Eye className="w-3 h-3 shrink-0" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {filteredReturns.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="font-semibold text-slate-700">
                {Math.min(page * pageSize, filteredReturns.length)}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{filteredReturns.length}</span> cases
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  "p-1 rounded border transition-colors",
                  page <= 1
                    ? "border-slate-200 text-slate-300 cursor-not-allowed"
                    : "border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-medium text-slate-700">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  "p-1 rounded border transition-colors",
                  page >= totalPages
                    ? "border-slate-200 text-slate-300 cursor-not-allowed"
                    : "border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RETURN DETAILS DRAWER */}
      <ReturnDetailsDrawer
        returnCase={selectedReturn}
        isOpen={Boolean(selectedReturn)}
        onClose={() => setSelectedReturn(null)}
        onOpenOrder={(orderId) => {
          setSelectedReturn(null);
          handleOpenOrderDrawer(orderId);
        }}
      />

      {/* ORDER DETAILS DRAWER */}
      <OrderDetailsDrawer
        order={inspectedOrder}
        isOpen={Boolean(inspectedOrder)}
        onClose={() => setInspectedOrder(null)}
        onUpdateStatus={updateOrderStatus}
        onUpdateCourier={updateCourierDetails}
        userRole={user.role}
        courierPartnerId={user.courierPartnerId}
      />
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ReturnsContent />
    </Suspense>
  );
}
