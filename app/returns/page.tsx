"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useOrderFlow } from "@/lib/hooks";
import { ReturnCase, ReturnStatus, ReturnType, ReturnReason, RefundStatus } from "@/types/orderflow";
import { ReturnStatusBadge, RefundStatusBadge } from "@/components/returns/return-status-badge";
import { CreateReturnModal } from "@/components/returns/create-return-modal";
import { ReturnDetailsDrawer } from "@/components/returns/return-details-drawer";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatINR, formatDate, cn, matchesDateFilter } from "@/lib/utils";
import { 
  RotateCcw, 
  Plus, 
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
  CheckCheck,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

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
  const [createModalOpen, setCreateModalOpen] = useState(false);
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

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto pb-12 select-none">
      {/* Page Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Returns Management</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
              {summaryCards.total} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete lifecycle management for customer returns, inspection, refunds, and replacement fulfillment.
          </p>
        </div>

        {/* Create Return Button */}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Return</span>
        </button>
      </div>

      {/* SUMMARY CARDS (Requirement 3) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. TOTAL RETURNS */}
        <div 
          onClick={() => { setActiveTab("ALL"); setPage(1); }}
          className={cn(
            "p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-subtle hover:border-slate-300",
            activeTab === "ALL" ? "ring-2 ring-slate-900 border-slate-900" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Returns</span>
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{summaryCards.total}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Filtered range</span>
        </div>

        {/* 2. RETURN REQUESTED */}
        <div 
          onClick={() => { setActiveTab("Return Requested"); setPage(1); }}
          className={cn(
            "p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-subtle hover:border-amber-300",
            activeTab === "Return Requested" ? "ring-2 ring-amber-500 border-amber-500" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Return Requested</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-900 font-mono">{summaryCards.requested}</div>
          <span className="text-[10px] text-amber-600 font-medium mt-0.5 block truncate">Awaiting review</span>
        </div>

        {/* 3. AWAITING RETURN */}
        <div 
          onClick={() => { setActiveTab("Awaiting Return"); setPage(1); }}
          className={cn(
            "p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-subtle hover:border-indigo-300",
            activeTab === "Awaiting Return" ? "ring-2 ring-indigo-500 border-indigo-500" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting Return</span>
            <Truck className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-indigo-900 font-mono">{summaryCards.awaiting}</div>
          <span className="text-[10px] text-indigo-600 font-medium mt-0.5 block truncate">In transit to hub</span>
        </div>

        {/* 4. RECEIVED / QC PENDING */}
        <div 
          onClick={() => { setActiveTab("QC Pending"); setPage(1); }}
          className={cn(
            "p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-subtle hover:border-orange-300",
            activeTab === "QC Pending" ? "ring-2 ring-orange-500 border-orange-500" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-orange-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Received / QC</span>
            <Box className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <div className="text-xl font-bold text-orange-900 font-mono">{summaryCards.receivedQc}</div>
          <span className="text-[10px] text-orange-600 font-medium mt-0.5 block truncate">Requires inspection</span>
        </div>

        {/* 5. REFUND PENDING */}
        <div 
          onClick={() => { setActiveTab("Refund Pending"); setPage(1); }}
          className={cn(
            "p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-subtle hover:border-rose-300",
            activeTab === "Refund Pending" ? "ring-2 ring-rose-500 border-rose-500" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Refund Pending</span>
            <DollarSign className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-900 font-mono">{summaryCards.refundPending}</div>
          <span className="text-[10px] text-rose-600 font-medium mt-0.5 block truncate">Awaiting payout</span>
        </div>

        {/* 6. REPLACEMENT PENDING */}
        <div 
          onClick={() => { setActiveTab("Replacement"); setPage(1); }}
          className={cn(
            "p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-subtle hover:border-purple-300",
            activeTab === "Replacement" ? "ring-2 ring-purple-500 border-purple-500" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Replacement</span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-purple-900 font-mono">{summaryCards.replacementPending}</div>
          <span className="text-[10px] text-purple-600 font-medium mt-0.5 block truncate">Queue in Packing</span>
        </div>
      </div>

      {/* STATUS TABS (Requirement 4) */}
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
                "px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5 cursor-pointer",
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

      {/* SEARCH & FILTERS BAR (Requirement 5) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search Return ID, Order ID, Customer, Phone, Item..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 focus:bg-white text-slate-800 placeholder:text-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Return Reason Filter */}
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Return Reasons</option>
            <option value="Size Issue">Size Issue</option>
            <option value="Color Issue">Color Issue</option>
            <option value="Wrong Product">Wrong Product</option>
            <option value="Damaged Product">Damaged Product</option>
            <option value="Quality Issue">Quality Issue</option>
            <option value="Product Not as Expected">Not as Expected</option>
            <option value="Customer Changed Mind">Changed Mind</option>
            <option value="Duplicate Order">Duplicate Order</option>
            <option value="Courier Damage">Courier Damage</option>
            <option value="Missing Item">Missing Item</option>
            <option value="Other">Other</option>
          </select>

          {/* Return Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Return Types</option>
            <option value="Refund">Refund</option>
            <option value="Replacement">Replacement</option>
            <option value="Exchange">Exchange</option>
          </select>

          {/* Refund Status Filter */}
          <select
            value={refundStatusFilter}
            onChange={(e) => {
              setRefundStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Refund Statuses</option>
            <option value="Pending">Refund Pending</option>
            <option value="Processing">Refund Processing</option>
            <option value="Refunded">Refunded</option>
            <option value="Failed">Refund Failed</option>
          </select>

          {/* Clear Filters Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear ({activeFilterCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* RETURNS TABLE (Requirement 6) */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[10.5px] uppercase tracking-tight border-b-2 border-slate-300">
              <tr>
                <th className="py-2.5 px-2 w-10 text-center border-r border-slate-300">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                  />
                </th>
                <th className="py-2.5 px-2 w-12 text-center border-r border-slate-300">S.No</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 border-r border-slate-300"
                  onClick={() => {
                    setSortField("returnId");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>RETURN ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300">ORDER ID</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 border-r border-slate-300"
                  onClick={() => {
                    setSortField("createdAt");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300">CUSTOMER</th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[200px]">ITEMS</th>
                <th className="py-2.5 px-2.5 border-r border-slate-300">RETURN REASON</th>
                <th className="py-2.5 px-2 text-center border-r border-slate-300">QTY</th>
                <th 
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 border-r border-slate-300"
                  onClick={() => {
                    setSortField("expectedAmount");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>RETURN AMOUNT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center border-r border-slate-300">RETURN STATUS</th>
                <th className="py-2.5 px-2.5 text-center border-r border-slate-300">REFUND STATUS</th>
                <th className="py-2.5 px-2 text-center border-r border-slate-300">REPLACEMENT</th>
                <th className="py-2.5 px-3 text-center">ACTION</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedReturns.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-16 text-center text-slate-400">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No return cases found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
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
                        "hover:bg-orange-50/40 transition-colors cursor-pointer",
                        isChecked ? "bg-orange-50/60" : index % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                      )}
                    >
                      {/* Checkbox */}
                      <td 
                        className="py-2 px-2 text-center border-r border-slate-200" 
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
                      <td className="py-2 px-2 text-center font-mono text-slate-400 text-[11px] border-r border-slate-200">
                        {sNo}
                      </td>

                      {/* RETURN ID */}
                      <td className="py-2 px-3 font-mono font-bold text-orange-700 border-r border-slate-200 whitespace-nowrap">
                        {rtn.returnId}
                      </td>

                      {/* ORDER ID */}
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrderDrawer(rtn.orderId);
                          }}
                          className="font-mono font-semibold text-slate-800 hover:text-orange-600 hover:underline cursor-pointer"
                        >
                          {rtn.orderNumber}
                        </button>
                      </td>

                      {/* DATE */}
                      <td className="py-2 px-3 text-slate-600 border-r border-slate-200 whitespace-nowrap text-[11px]">
                        {formatDate(rtn.createdAt)}
                      </td>

                      {/* CUSTOMER */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-900 truncate max-w-[140px]" title={rtn.customerName}>
                          {rtn.customerName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{rtn.customerPhone}</div>
                      </td>

                      {/* ITEMS */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="truncate max-w-[220px] font-medium text-slate-800" title={firstItem ? `${firstItem.productName} - ${firstItem.size}` : ""}>
                          {firstItem?.productName || "Item"}
                          {firstItem?.size && <span className="text-slate-400 font-normal"> · {firstItem.size}</span>}
                        </div>
                        {rtn.items.length > 1 && (
                          <span className="text-[10px] font-semibold text-orange-600">
                            +{rtn.items.length - 1} more item(s)
                          </span>
                        )}
                      </td>

                      {/* RETURN REASON */}
                      <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap text-slate-700">
                        {rtn.reason}
                      </td>

                      {/* QTY */}
                      <td className="py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-200">
                        {rtn.requestedQuantity}
                      </td>

                      {/* RETURN AMOUNT */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {formatINR(rtn.expectedAmount)}
                      </td>

                      {/* RETURN STATUS */}
                      <td className="py-2 px-3 text-center border-r border-slate-200">
                        <ReturnStatusBadge status={rtn.status} />
                      </td>

                      {/* REFUND STATUS */}
                      <td className="py-2 px-2.5 text-center border-r border-slate-200">
                        <RefundStatusBadge status={rtn.refund?.refundStatus} />
                      </td>

                      {/* REPLACEMENT */}
                      <td className="py-2 px-2 text-center font-medium border-r border-slate-200 text-[11px]">
                        {rtn.returnType === "Replacement" || rtn.returnType === "Exchange" ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>

                      {/* ACTION */}
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedReturn(rtn)}
                          className="px-2.5 py-1 text-xs font-semibold text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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

      {/* CREATE RETURN MODAL / DRAWER */}
      <CreateReturnModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(returnId) => {
          const created = returns.find((r) => r.returnId === returnId);
          if (created) setSelectedReturn(created);
        }}
      />

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
