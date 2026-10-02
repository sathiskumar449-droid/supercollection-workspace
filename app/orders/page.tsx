"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { 
  Search, 
  Filter, 
  ChevronDown, 
  SlidersHorizontal, 
  Download, 
  Eye, 
  CheckCircle2, 
  ArrowUpDown, 
  ArrowUp,
  ArrowDown,
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Layers, 
  X,
  FileSpreadsheet,
  FileText,
  Globe,
  MessageSquare,
  CheckSquare,
  RotateCcw
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { Order, OrderStatus, CourierStatus, SmsStatus, OrderSource, ReturnCase } from "@/types/orderflow";
import { OrderStatusBadge, CourierStatusBadge, SmsStatusBadge, SourceBadge } from "@/components/ui/status-badge";
import { ReturnCompactIndicator } from "@/components/returns/return-status-badge";
import { ReturnDetailsDrawer } from "@/components/returns/return-details-drawer";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { SyncWooCommerceDialog } from "@/components/sync-woocommerce-dialog";
import { SyncWhatsAppDialog } from "@/components/sync-whatsapp-dialog";
import { formatINR, formatDate, cn, matchesDateFilter } from "@/lib/utils";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";
import { BulkConfirmDialog } from "@/components/bulk-actions/bulk-confirm-dialog";
import { StatusOption } from "@/components/bulk-actions/bulk-toolbar";
import { ExcelColumnFilter } from "@/components/orders/excel-column-filter";

function OrdersContent() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");

  const { 
    orders, 
    returns,
    user, 
    updateOrderStatus, 
    updateCourierDetails,
    searchQuery,
    setSearchQuery,
    dateFilter,
    customDate,
  } = useOrderFlow();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnCase | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [whatsappSyncDialogOpen, setWhatsappSyncDialogOpen] = useState(false);

  // Column filter states
  const [statusFilter, setStatusFilter] = useState<string[]>(
    statusParam && statusParam !== "ALL" ? [statusParam] : []
  );
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [courierFilter, setCourierFilter] = useState<string[]>([]);
  const [courierStatusFilter, setCourierStatusFilter] = useState<string[]>([]);
  const [smsStatusFilter, setSmsStatusFilter] = useState<string[]>([]);
  const [orderIdFilter, setOrderIdFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [amountFilter, setAmountFilter] = useState<string[]>([]);
  const [returnFilter, setReturnFilter] = useState<string>("ALL");
  const [llrFilter, setLlrFilter] = useState<string>("ALL");

  // Open column filter popover state
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);

  const toggleFilterColumn = (col: string) => {
    setOpenFilterColumn((prev) => (prev === col ? null : col));
  };
  
  // Sort state
  const [sortField, setSortField] = useState<
    "createdAt" | "totalAmount" | "orderNumber" | "customerName" | "itemsCount" | "orderStatus" | "courierName" | "courierStatus" | "smsStatus"
  >("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: any, asc: boolean) => {
    setSortField(field);
    setSortAsc(asc);
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // All Orders remains the master overview: all orders stay visible across every lifecycle stage
  const baseOrders = orders;

  // Dynamic counts for Excel filter checkboxes
  const {
    statusCounts,
    sourceCounts,
    courierCounts,
    courierStatusCounts,
    smsStatusCounts,
    returnCounts,
    llrCounts,
    amountCounts,
  } = useMemo(() => {
    const sCounts: Record<string, number> = {
      CONFIRMED: 0,
      PACKING: 0,
      PACKED: 0,
      DISPATCHED: 0,
      COMPLETED: 0,
      RETURN: 0,
    };
    const srcCounts: Record<string, number> = {
      WEBSITE: 0,
      WHATSAPP: 0,
    };
    const cCounts: Record<string, number> = {
      "ST Courier": 0,
      "DTDC": 0,
      "India Post": 0,
      "Delhivery": 0,
      "Blue Dart": 0,
      "(Unassigned)": 0,
    };
    const csCounts: Record<string, number> = {
      PENDING: 0,
      SHIPPED: 0,
      WAITING_FOR_PICKUP: 0,
      PICKED_UP: 0,
      DELIVERED: 0,
    };
    const smsCounts: Record<string, number> = {
      SENT: 0,
      PENDING: 0,
      FAILED: 0,
    };
    const retCounts = { HAS_RETURN: 0, NO_RETURN: 0 };
    const lCounts = { WITH_LLR: 0, WITHOUT_LLR: 0 };
    const amtCounts = {
      UNDER_500: 0,
      "500_1000": 0,
      "1000_2500": 0,
      ABOVE_2500: 0,
    };

    baseOrders.forEach((o) => {
      // Filter out WooCommerce NEW / RETURN as per existing rule
      if (o.source === "WEBSITE" && (o.orderStatus === "NEW" || o.orderStatus === "RETURN")) {
        return;
      }

      if (sCounts[o.orderStatus] !== undefined) sCounts[o.orderStatus]++;
      if (srcCounts[o.source] !== undefined) srcCounts[o.source]++;

      const cName = o.dispatch.courierName;
      if (!cName) {
        cCounts["(Unassigned)"] = (cCounts["(Unassigned)"] || 0) + 1;
      } else {
        cCounts[cName] = (cCounts[cName] || 0) + 1;
      }

      if (csCounts[o.dispatch.courierStatus] !== undefined) {
        csCounts[o.dispatch.courierStatus]++;
      }

      if (smsCounts[o.sms.status] !== undefined) {
        smsCounts[o.sms.status]++;
      }

      const hasRet = returns.some((r) => r.orderId === o.id || r.orderNumber === o.orderNumber);
      if (hasRet) retCounts.HAS_RETURN++;
      else retCounts.NO_RETURN++;

      if (o.dispatch.llrNumber && o.dispatch.llrNumber.trim()) lCounts.WITH_LLR++;
      else lCounts.WITHOUT_LLR++;

      if (o.totalAmount < 500) amtCounts.UNDER_500++;
      else if (o.totalAmount <= 1000) amtCounts["500_1000"]++;
      else if (o.totalAmount <= 2500) amtCounts["1000_2500"]++;
      else amtCounts.ABOVE_2500++;
    });

    return {
      statusCounts: sCounts,
      sourceCounts: srcCounts,
      courierCounts: cCounts,
      courierStatusCounts: csCounts,
      smsStatusCounts: smsCounts,
      returnCounts: retCounts,
      llrCounts: lCounts,
      amountCounts: amtCounts,
    };
  }, [baseOrders, returns]);

  // Filtered & Sorted orders calculation
  const filteredOrders = useMemo(() => {
    return baseOrders.filter((order) => {
      // Exclude pending and cancelled WooCommerce/Website orders
      if (order.source === "WEBSITE" && (order.orderStatus === "NEW" || order.orderStatus === "RETURN")) {
        return false;
      }

      // Global Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          order.orderNumber.toLowerCase().includes(q) ||
          order.externalOrderId.toLowerCase().includes(q) ||
          order.customer.name.toLowerCase().includes(q) ||
          order.customer.mobile.toLowerCase().includes(q) ||
          (order.dispatch.llrNumber && order.dispatch.llrNumber.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Column: Order ID Search
      if (orderIdFilter.trim()) {
        const q = orderIdFilter.toLowerCase();
        const matches =
          order.orderNumber.toLowerCase().includes(q) ||
          order.externalOrderId.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Column: Customer Name Search
      if (customerFilter.trim()) {
        const q = customerFilter.toLowerCase();
        const matches =
          order.customer.name.toLowerCase().includes(q) ||
          order.customer.mobile.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Column: Order Status (multi-select)
      if (statusFilter.length > 0 && !statusFilter.includes(order.orderStatus)) {
        return false;
      }

      // Column: Source (multi-select)
      if (sourceFilter.length > 0 && !sourceFilter.includes(order.source)) {
        return false;
      }

      // Column: Courier (multi-select)
      if (courierFilter.length > 0) {
        const cName = order.dispatch.courierName;
        const matchesCourier = 
          (cName && courierFilter.includes(cName)) ||
          (!cName && courierFilter.includes("(Unassigned)"));
        if (!matchesCourier) return false;
      }

      // Column: Courier Status (multi-select)
      if (courierStatusFilter.length > 0) {
        const cs = order.dispatch.courierStatus;
        const isShippedSelected = courierStatusFilter.includes("SHIPPED");
        const orderIsShipped = cs === "SHIPPED" || (cs as string) === "DELIVERED";
        const matchesCS = courierStatusFilter.includes(cs) || (isShippedSelected && orderIsShipped);
        if (!matchesCS) return false;
      }

      // Column: SMS Status (multi-select)
      if (smsStatusFilter.length > 0 && !smsStatusFilter.includes(order.sms.status)) {
        return false;
      }

      // Column: Return
      if (returnFilter !== "ALL") {
        const hasReturn = returns.some((r) => r.orderId === order.id || r.orderNumber === order.orderNumber);
        if (returnFilter === "HAS_RETURN" && !hasReturn) return false;
        if (returnFilter === "NO_RETURN" && hasReturn) return false;
      }

      // Column: LLR
      if (llrFilter !== "ALL") {
        const hasLLR = Boolean(order.dispatch.llrNumber && order.dispatch.llrNumber.trim());
        if (llrFilter === "WITH_LLR" && !hasLLR) return false;
        if (llrFilter === "WITHOUT_LLR" && hasLLR) return false;
      }

      // Column: Amount range (multi-select)
      if (amountFilter.length > 0) {
        const amt = order.totalAmount;
        const matchesAmount = amountFilter.some((range) => {
          if (range === "UNDER_500") return amt < 500;
          if (range === "500_1000") return amt >= 500 && amt <= 1000;
          if (range === "1000_2500") return amt > 1000 && amt <= 2500;
          if (range === "ABOVE_2500") return amt > 2500;
          return false;
        });
        if (!matchesAmount) return false;
      }

      // Date Filter from TopBar / Calendar
      if (!matchesDateFilter(order.createdAt, dateFilter, customDate)) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === "totalAmount") {
        comparison = a.totalAmount - b.totalAmount;
      } else if (sortField === "orderNumber") {
        comparison = a.orderNumber.localeCompare(b.orderNumber);
      } else if (sortField === "customerName") {
        comparison = a.customer.name.localeCompare(b.customer.name);
      } else if (sortField === "itemsCount") {
        comparison = a.items.length - b.items.length;
      } else if (sortField === "orderStatus") {
        comparison = a.orderStatus.localeCompare(b.orderStatus);
      } else if (sortField === "courierName") {
        comparison = (a.dispatch.courierName || "").localeCompare(b.dispatch.courierName || "");
      } else if (sortField === "courierStatus") {
        comparison = (a.dispatch.courierStatus || "").localeCompare(b.dispatch.courierStatus || "");
      } else if (sortField === "smsStatus") {
        comparison = (a.sms.status || "").localeCompare(b.sms.status || "");
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [
    baseOrders,
    returns,
    searchQuery,
    orderIdFilter,
    customerFilter,
    statusFilter,
    sourceFilter,
    courierFilter,
    courierStatusFilter,
    smsStatusFilter,
    returnFilter,
    llrFilter,
    amountFilter,
    dateFilter,
    customDate,
    sortField,
    sortAsc,
  ]);

  // Paginated orders
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const BULK_STATUS_OPTIONS: StatusOption[] = [
    { value: "CONFIRMED", label: "Processing" },
    { value: "PACKING", label: "Packaging" },
    { value: "PACKED", label: "Packed" },
    { value: "DISPATCHED", label: "Dispatched" },
  ];

  // Bulk actions validation
  const { validOrders, skippedOrders } = useMemo(() => {
    if (!bulkStatus || selectedIds.length === 0) {
      return { validOrders: [], skippedOrders: [] };
    }
    const targetStatus = bulkStatus as OrderStatus;
    const targetLabel = BULK_STATUS_OPTIONS.find((s) => s.value === targetStatus)?.label || targetStatus;

    const valid: Order[] = [];
    const skipped: { orderNumber: string; reason: string }[] = [];

    selectedIds.forEach((id) => {
      const ord = orders.find((o) => o.id === id);
      if (!ord) return;

      if (ord.orderStatus === targetStatus) {
        skipped.push({
          orderNumber: ord.orderNumber,
          reason: `Already in ${targetLabel} status`,
        });
        return;
      }

      if (targetStatus === "PACKING" && (ord.orderStatus === "PACKED" || ord.orderStatus === "DISPATCHED")) {
        skipped.push({
          orderNumber: ord.orderNumber,
          reason: `Cannot move backwards from ${ord.orderStatus} to Packaging`,
        });
        return;
      }

      if (targetStatus === "PACKED" && ord.orderStatus === "DISPATCHED") {
        skipped.push({
          orderNumber: ord.orderNumber,
          reason: `Cannot move backwards from Dispatched to Packed`,
        });
        return;
      }

      valid.push(ord);
    });

    return { validOrders: valid, skippedOrders: skipped };
  }, [selectedIds, bulkStatus, orders]);

  const isAllPageSelected =
    paginatedOrders.length > 0 &&
    paginatedOrders.every((o) => selectedIds.includes(o.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newIds = Array.from(new Set([...selectedIds, ...paginatedOrders.map((o) => o.id)]));
      setSelectedIds(newIds);
    } else {
      const pageIdSet = new Set(paginatedOrders.map((o) => o.id));
      setSelectedIds(selectedIds.filter((id) => !pageIdSet.has(id)));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(filteredOrders.map((o) => o.id));
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkUpdate = () => {
    if (validOrders.length === 0 || !bulkStatus) return;
    setIsBulkUpdating(true);
    const targetStatus = bulkStatus as OrderStatus;
    const targetLabel = BULK_STATUS_OPTIONS.find((s) => s.value === targetStatus)?.label || targetStatus;

    validOrders.forEach((order) => {
      updateOrderStatus(order.id, targetStatus, `Bulk status updated to ${targetLabel}`);
    });

    setIsBulkUpdating(false);
    setIsConfirmDialogOpen(false);
    setSelectedIds([]);
    setBulkStatus("");
    triggerToast(`${validOrders.length} ${validOrders.length === 1 ? "order" : "orders"} updated to ${targetLabel} successfully.`);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setOrderIdFilter("");
    setCustomerFilter("");
    setStatusFilter([]);
    setSourceFilter([]);
    setCourierFilter([]);
    setCourierStatusFilter([]);
    setSmsStatusFilter([]);
    setReturnFilter("ALL");
    setLlrFilter("ALL");
    setAmountFilter([]);
    setPage(1);
  };

  const activeFilterCount = [
    statusFilter.length > 0,
    sourceFilter.length > 0,
    courierFilter.length > 0,
    courierStatusFilter.length > 0,
    smsStatusFilter.length > 0,
    Boolean(orderIdFilter.trim()),
    Boolean(customerFilter.trim()),
    amountFilter.length > 0,
    returnFilter !== "ALL",
    llrFilter !== "ALL",
    Boolean(searchQuery.trim()),
  ].filter(Boolean).length;

  // Export handlers
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Order ID",
      "Date",
      "Customer Name",
      "Phone",
      "Source",
      "Items Count",
      "Amount (INR)",
      "Order Status",
      "Courier",
      "LLR Number",
      "Courier Status",
      "SMS Status",
    ];

    const rows = filteredOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      formatDate(order.createdAt),
      order.customer.name,
      order.customer.mobile,
      order.source,
      order.items.length,
      order.totalAmount,
      order.orderStatus,
      order.dispatch.courierName || "-",
      order.dispatch.llrNumber || "",
      order.dispatch.courierStatus,
      order.sms.status,
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(`All_Orders_${dateStr}`, headers, rows);
  };

  const handleExportPdf = () => {
    const headers = [
      "S.No",
      "Order ID",
      "Date",
      "Customer",
      "Phone",
      "Amount",
      "Status",
      "Courier",
      "LLR #",
      "Courier St",
      "SMS St",
    ];

    const rows = filteredOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      formatDate(order.createdAt),
      order.customer.name,
      order.customer.mobile,
      formatINR(order.totalAmount),
      order.orderStatus,
      order.dispatch.courierName || "-",
      order.dispatch.llrNumber || "-",
      order.dispatch.courierStatus,
      order.sms.status,
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToPdf({
      title: "All Orders - Fulfillment Ledger",
      subtitle: `Filtered Orders: ${filteredOrders.length}`,
      filename: `All_Orders_Report_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-3.5 max-w-full mx-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Select All Across Pages Banner */}
      {selectedIds.length > 0 && isAllPageSelected && filteredOrders.length > paginatedOrders.length && selectedIds.length < filteredOrders.length && (
        <div className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs text-slate-700 flex items-center justify-between">
          <span>
            All <strong>{paginatedOrders.length}</strong> orders on this page selected.
          </span>
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="text-orange-700 font-bold hover:underline ml-2 cursor-pointer"
          >
            Select all {filteredOrders.length} filtered orders
          </button>
        </div>
      )}

      {/* Bulk Confirmation Modal */}
      <BulkConfirmDialog
        isOpen={isConfirmDialogOpen}
        targetStatusLabel={BULK_STATUS_OPTIONS.find((s) => s.value === bulkStatus)?.label || bulkStatus}
        totalSelected={selectedIds.length}
        validCount={validOrders.length}
        skippedOrders={skippedOrders}
        onConfirm={handleConfirmBulkUpdate}
        onCancel={() => setIsConfirmDialogOpen(false)}
        isLoading={isBulkUpdating}
      />

      {/* Filter Toolbar (Streamlined: Search + Active Filter Pills + Bulk Actions + Export) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-subtle space-y-2">
        {/* Row 1: Global Search + Bulk Actions + Export */}
        <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex items-center shrink-0 w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Order ID, Customer, Phone..."
                className="text-xs pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-800 placeholder-slate-400 w-full transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Bulk Selection Actions (Fixed in Top Toolbar - Always Visible) */}
            <div className="flex items-center gap-2 shrink-0 bg-orange-50/95 border border-orange-200 px-2.5 py-1.5 rounded-lg">
              {/* Selected Badge with Clear (Only shown when rows selected) */}
              {selectedIds.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 font-bold text-orange-900 text-xs animate-in fade-in">
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
                </>
              )}

              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="text-xs px-2.5 py-1 bg-white border border-orange-300 hover:border-orange-400 rounded-md font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer shadow-2xs"
              >
                <option value="" disabled>Change Status ▾</option>
                {BULK_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (selectedIds.length === 0) {
                    triggerToast("Please select at least 1 order using checkbox first to update status");
                    return;
                  }
                  if (!bulkStatus) {
                    triggerToast("Please select a status from the dropdown");
                    return;
                  }
                  if (validOrders.length === 0) {
                    triggerToast("None of the selected orders can be transitioned to this status");
                    return;
                  }
                  setIsConfirmDialogOpen(true);
                }}
                disabled={isBulkUpdating}
                className={cn(
                  "px-3 py-1 rounded-md font-bold text-xs transition-all shadow-2xs cursor-pointer",
                  isBulkUpdating
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-orange-600 hover:bg-orange-700 text-white active:scale-98"
                )}
              >
                {isBulkUpdating ? "Applying..." : "Apply"}
              </button>
            </div>

            {/* Export Actions (inline, rightmost) */}
            <button
              onClick={handleExportExcel}
              title="Export Excel"
              className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportPdf}
              title="Export PDF"
              className="inline-flex items-center justify-center p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Active Filter Chips (Only shown when any column filter is active) */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-orange-600" /> Active Filters:
            </span>

            {/* Status chip */}
            {statusFilter.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-medium border border-orange-200">
                Status: {statusFilter.join(", ")}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter([]);
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Source chip */}
            {sourceFilter.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-medium border border-blue-200">
                Source: {sourceFilter.join(", ")}
                <button
                  type="button"
                  onClick={() => {
                    setSourceFilter([]);
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Courier chip */}
            {courierFilter.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-medium border border-purple-200">
                Courier: {courierFilter.join(", ")}
                <button
                  type="button"
                  onClick={() => {
                    setCourierFilter([]);
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Courier Status chip */}
            {courierStatusFilter.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium border border-amber-200">
                Courier St: {courierStatusFilter.join(", ")}
                <button
                  type="button"
                  onClick={() => {
                    setCourierStatusFilter([]);
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* SMS Status chip */}
            {smsStatusFilter.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                SMS: {smsStatusFilter.join(", ")}
                <button
                  type="button"
                  onClick={() => {
                    setSmsStatusFilter([]);
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Order ID chip */}
            {orderIdFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-300">
                ID: &quot;{orderIdFilter}&quot;
                <button
                  type="button"
                  onClick={() => {
                    setOrderIdFilter("");
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Customer chip */}
            {customerFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-300">
                Customer: &quot;{customerFilter}&quot;
                <button
                  type="button"
                  onClick={() => {
                    setCustomerFilter("");
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Amount chip */}
            {amountFilter.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                Amount: {amountFilter.length} range(s)
                <button
                  type="button"
                  onClick={() => {
                    setAmountFilter([]);
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Return chip */}
            {returnFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-medium border border-rose-200">
                Return: {returnFilter === "HAS_RETURN" ? "Has Return" : "No Return"}
                <button
                  type="button"
                  onClick={() => {
                    setReturnFilter("ALL");
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* LLR chip */}
            {llrFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-medium border border-indigo-200">
                LLR: {llrFilter === "WITH_LLR" ? "Has LLR" : "Missing LLR"}
                <button
                  type="button"
                  onClick={() => {
                    setLlrFilter("ALL");
                    setPage(1);
                  }}
                  className="hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Reset All Filters button */}
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 px-2 py-0.5 rounded hover:bg-red-50 transition-colors ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All ({activeFilterCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* Orders Table (Excel Spreadsheet Grid Style with S.No & Column Header Filters) */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden w-full min-h-[460px]">
        <div className="table-scroll-container overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)] min-h-[380px] hidden md:block w-full relative">
          <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-300 min-w-[1200px]">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[10.5px] uppercase tracking-tight shadow-xs">
              <tr>
                {/* Checkbox */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[2.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={isAllPageSelected}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                    title={isAllPageSelected ? "Deselect page" : "Select all orders on this page"}
                  />
                </th>

                {/* S.No */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[3%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  S.No
                </th>

                {/* ORDER ID */}
                <th className="sticky top-0 z-20 py-2 px-1.5 w-[8%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">ORDER ID</span>
                    <ExcelColumnFilter
                      title="Order ID"
                      columnKey="orderNumber"
                      isOpen={openFilterColumn === "orderNumber"}
                      onToggle={() => toggleFilterColumn("orderNumber")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={Boolean(orderIdFilter.trim())}
                      filterType="search"
                      searchValue={orderIdFilter}
                      onApplySearch={(val) => {
                        setOrderIdFilter(val);
                        setPage(1);
                      }}
                      searchPlaceholder="Search Order ID..."
                      onClearFilter={() => {
                        setOrderIdFilter("");
                        setPage(1);
                      }}
                      align="left"
                    />
                  </div>
                </th>

                {/* DATE */}
                <th 
                  className="sticky top-0 z-20 py-2 px-1.5 w-[7.5%] border-r border-b-2 border-slate-300 bg-slate-100 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                  onClick={() => {
                    if (sortField === "createdAt") {
                      setSortAsc(!sortAsc);
                    } else {
                      setSortField("createdAt");
                      setSortAsc(false);
                    }
                  }}
                  title="Click to sort by Date"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">DATE</span>
                    {sortField === "createdAt" ? (
                      sortAsc ? (
                        <ArrowUp className="w-3 h-3 text-orange-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-orange-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </div>
                </th>

                {/* CUSTOMER NAME */}
                <th className="sticky top-0 z-20 py-2 px-1.5 w-[11.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">CUSTOMER NAME</span>
                    <ExcelColumnFilter
                      title="Customer Name"
                      columnKey="customerName"
                      isOpen={openFilterColumn === "customerName"}
                      onToggle={() => toggleFilterColumn("customerName")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={Boolean(customerFilter.trim())}
                      filterType="search"
                      searchValue={customerFilter}
                      onApplySearch={(val) => {
                        setCustomerFilter(val);
                        setPage(1);
                      }}
                      searchPlaceholder="Search Name or Mobile..."
                      onClearFilter={() => {
                        setCustomerFilter("");
                        setPage(1);
                      }}
                      align="left"
                    />
                  </div>
                </th>

                {/* SOURCE */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[6.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">SOURCE</span>
                    <ExcelColumnFilter
                      title="Source"
                      columnKey="source"
                      isOpen={openFilterColumn === "source"}
                      onToggle={() => toggleFilterColumn("source")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={sourceFilter.length > 0}
                      options={[
                        { value: "WEBSITE", label: "Website (WooCommerce)", count: sourceCounts.WEBSITE },
                        { value: "WHATSAPP", label: "WhatsApp Chat Box", count: sourceCounts.WHATSAPP },
                      ]}
                      selectedValues={sourceFilter}
                      onApplyFilter={(vals) => {
                        setSourceFilter(vals);
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setSourceFilter([]);
                        setPage(1);
                      }}
                      align="left"
                    />
                  </div>
                </th>

                {/* ITEMS */}
                <th 
                  className="sticky top-0 z-20 py-2 px-1 w-[5%] border-r border-b-2 border-slate-300 bg-slate-100 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                  onClick={() => {
                    if (sortField === "itemsCount") {
                      setSortAsc(!sortAsc);
                    } else {
                      setSortField("itemsCount");
                      setSortAsc(false);
                    }
                  }}
                  title="Click to sort by Items"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">ITEMS</span>
                    {sortField === "itemsCount" ? (
                      sortAsc ? (
                        <ArrowUp className="w-3 h-3 text-orange-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-orange-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </div>
                </th>

                {/* AMOUNT */}
                <th className="sticky top-0 z-20 py-2 px-1.5 w-[6.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">AMOUNT</span>
                    <ExcelColumnFilter
                      title="Amount"
                      columnKey="totalAmount"
                      isOpen={openFilterColumn === "totalAmount"}
                      onToggle={() => toggleFilterColumn("totalAmount")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={amountFilter.length > 0}
                      options={[
                        { value: "UNDER_500", label: "Under ₹500", count: amountCounts.UNDER_500 },
                        { value: "500_1000", label: "₹500 - ₹1,000", count: amountCounts["500_1000"] },
                        { value: "1000_2500", label: "₹1,000 - ₹2,500", count: amountCounts["1000_2500"] },
                        { value: "ABOVE_2500", label: "Above ₹2,500", count: amountCounts.ABOVE_2500 },
                      ]}
                      selectedValues={amountFilter}
                      onApplyFilter={(vals) => {
                        setAmountFilter(vals);
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setAmountFilter([]);
                        setPage(1);
                      }}
                      align="right"
                    />
                  </div>
                </th>

                {/* ORDER STATUS */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[8.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">ORDER STATUS</span>
                    <ExcelColumnFilter
                      title="Order Status"
                      columnKey="orderStatus"
                      isOpen={openFilterColumn === "orderStatus"}
                      onToggle={() => toggleFilterColumn("orderStatus")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={statusFilter.length > 0}
                      options={[
                        { value: "CONFIRMED", label: "Processing", count: statusCounts.CONFIRMED },
                        { value: "PACKING", label: "Packaging", count: statusCounts.PACKING },
                        { value: "PACKED", label: "Packed", count: statusCounts.PACKED },
                        { value: "DISPATCHED", label: "Dispatched", count: statusCounts.DISPATCHED },
                        { value: "COMPLETED", label: "Completed", count: statusCounts.COMPLETED },
                        { value: "RETURN", label: "↩ Return", count: statusCounts.RETURN },
                      ]}
                      selectedValues={statusFilter}
                      onApplyFilter={(vals) => {
                        setStatusFilter(vals);
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setStatusFilter([]);
                        setPage(1);
                      }}
                      align="right"
                    />
                  </div>
                </th>

                {/* COURIER */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[7.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">COURIER</span>
                    <ExcelColumnFilter
                      title="Courier"
                      columnKey="courierName"
                      isOpen={openFilterColumn === "courierName"}
                      onToggle={() => toggleFilterColumn("courierName")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={courierFilter.length > 0}
                      options={[
                        { value: "ST Courier", label: "ST Courier", count: courierCounts["ST Courier"] || 0 },
                        { value: "DTDC", label: "DTDC", count: courierCounts["DTDC"] || 0 },
                        { value: "India Post", label: "India Post", count: courierCounts["India Post"] || 0 },
                        { value: "Delhivery", label: "Delhivery", count: courierCounts["Delhivery"] || 0 },
                        { value: "Blue Dart", label: "Blue Dart", count: courierCounts["Blue Dart"] || 0 },
                        { value: "(Unassigned)", label: "Unassigned", count: courierCounts["(Unassigned)"] || 0 },
                      ]}
                      selectedValues={courierFilter}
                      onApplyFilter={(vals) => {
                        setCourierFilter(vals);
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setCourierFilter([]);
                        setPage(1);
                      }}
                      align="right"
                    />
                  </div>
                </th>

                {/* LLR */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[6.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">LLR</span>
                    <ExcelColumnFilter
                      title="LLR"
                      columnKey="llr"
                      isOpen={openFilterColumn === "llr"}
                      onToggle={() => toggleFilterColumn("llr")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={llrFilter !== "ALL"}
                      options={[
                        { value: "WITH_LLR", label: "With LLR Number", count: llrCounts.WITH_LLR },
                        { value: "WITHOUT_LLR", label: "Missing LLR", count: llrCounts.WITHOUT_LLR },
                      ]}
                      selectedValues={llrFilter === "ALL" ? [] : [llrFilter]}
                      onApplyFilter={(vals) => {
                        if (vals.length === 1) setLlrFilter(vals[0]);
                        else setLlrFilter("ALL");
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setLlrFilter("ALL");
                        setPage(1);
                      }}
                      align="right"
                    />
                  </div>
                </th>

                {/* COURIER STATUS */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[8%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">COURIER STATUS</span>
                    <ExcelColumnFilter
                      title="Courier Status"
                      columnKey="courierStatus"
                      isOpen={openFilterColumn === "courierStatus"}
                      onToggle={() => toggleFilterColumn("courierStatus")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={courierStatusFilter.length > 0}
                      options={[
                        { value: "PENDING", label: "Courier Pending", count: courierStatusCounts.PENDING },
                        { value: "SHIPPED", label: "Courier Shipped", count: courierStatusCounts.SHIPPED },
                        { value: "WAITING_FOR_PICKUP", label: "Waiting for Pickup", count: courierStatusCounts.WAITING_FOR_PICKUP },
                        { value: "PICKED_UP", label: "Picked Up", count: courierStatusCounts.PICKED_UP },
                        { value: "DELIVERED", label: "Delivered", count: courierStatusCounts.DELIVERED },
                      ]}
                      selectedValues={courierStatusFilter}
                      onApplyFilter={(vals) => {
                        setCourierStatusFilter(vals);
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setCourierStatusFilter([]);
                        setPage(1);
                      }}
                      align="right"
                    />
                  </div>
                </th>

                {/* SMS STATUS */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[8.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">SMS STATUS</span>
                    <ExcelColumnFilter
                      title="SMS Status"
                      columnKey="smsStatus"
                      isOpen={openFilterColumn === "smsStatus"}
                      onToggle={() => toggleFilterColumn("smsStatus")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={smsStatusFilter.length > 0}
                      options={[
                        { value: "SENT", label: "SMS Sent", count: smsStatusCounts.SENT },
                        { value: "PENDING", label: "SMS Pending", count: smsStatusCounts.PENDING },
                        { value: "FAILED", label: "SMS Failed", count: smsStatusCounts.FAILED },
                      ]}
                      selectedValues={smsStatusFilter}
                      onApplyFilter={(vals) => {
                        setSmsStatusFilter(vals);
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setSmsStatusFilter([]);
                        setPage(1);
                      }}
                      align="right"
                    />
                  </div>
                </th>

{/* RETURN */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[6%] border-r border-b-2 border-slate-300 bg-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">RETURN</span>
                    <ExcelColumnFilter
                      title="Return"
                      columnKey="return"
                      isOpen={openFilterColumn === "return"}
                      onToggle={() => toggleFilterColumn("return")}
                      onClose={() => setOpenFilterColumn(null)}
                      isActive={returnFilter !== "ALL"}
                      options={[
                        { value: "HAS_RETURN", label: "Has Return", count: returnCounts.HAS_RETURN },
                        { value: "NO_RETURN", label: "No Return", count: returnCounts.NO_RETURN },
                      ]}
                      selectedValues={returnFilter === "ALL" ? [] : [returnFilter]}
                      onApplyFilter={(vals) => {
                        if (vals.length === 1) setReturnFilter(vals[0]);
                        else setReturnFilter("ALL");
                        setPage(1);
                      }}
                      onClearFilter={() => {
                        setReturnFilter("ALL");
                        setPage(1);
                      }}
                      align="right"
                    />
                  </div>
                </th>

                {/* TRACKING */}
                <th className="sticky top-0 z-20 py-2 px-1 w-[5%] text-center border-b-2 border-slate-300 bg-slate-200/70 text-slate-800 whitespace-nowrap">
                  TRACKING
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400 border-b border-slate-300">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No matching orders found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {orders.length === 0 
                        ? "No orders imported yet from WooCommerce." 
                        : "Try adjusting your filters or search query."}
                    </p>
                    {orders.length === 0 && (
                      <div className="mt-3.5 flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSyncDialogOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Sync Website Orders</span>
                        </button>
                        <button
                          onClick={() => setWhatsappSyncDialogOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Sync WhatsApp Orders</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  const isSelected = selectedIds.includes(order.id);
                  const serialNo = (page - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={cn(
                        "hover:bg-orange-50/40 transition-colors cursor-pointer group",
                        isSelected && "bg-orange-50/70"
                      )}
                    >
                      <td className="py-2 px-1 text-center border-r border-b border-slate-300 bg-slate-50" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(order.id)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>

                      {/* S.No column */}
                      <td className="py-2 px-1 text-center font-mono font-bold text-slate-600 bg-slate-50 border-r border-b border-slate-300">
                        {serialNo}
                      </td>

                      {/* Order ID */}
                      <td className="py-2 px-1.5 font-mono font-semibold text-slate-900 truncate border-r border-b border-slate-300 text-[11px]" title={order.orderNumber}>
                        {order.orderNumber}
                      </td>

                      {/* Order Created Date */}
                      <td className="py-2 px-1.5 text-slate-600 truncate border-r border-b border-slate-300 font-medium text-[11px]" title={formatDate(order.createdAt)}>
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Customer Name */}
                      <td className="py-2 px-1.5 truncate border-r border-b border-slate-300" title={`${order.customer.name} (${order.customer.mobile})`}>
                        <span className="font-semibold text-slate-800 block truncate text-xs">
                          {order.customer.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          {order.customer.mobile}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-2 px-1 text-center truncate border-r border-b border-slate-300">
                        <SourceBadge source={order.source} className="justify-center text-[11px]" />
                      </td>

                      {/* Items */}
                      <td className="py-2 px-1 text-center text-slate-600 truncate border-r border-b border-slate-300 font-medium text-[11px]">
                        {order.items.length} {order.items.length === 1 ? "Item" : "Items"}
                      </td>

                      {/* Amount */}
                      <td className="py-2 px-1.5 text-right font-semibold text-slate-900 whitespace-nowrap border-r border-b border-slate-300 text-xs">
                        {formatINR(order.totalAmount)}
                      </td>

                      {/* Order Status */}
                      <td className="py-2 px-1 text-center truncate border-r border-b border-slate-300">
                        <OrderStatusBadge status={order.orderStatus} className="justify-center text-[11px]" />
                      </td>

                      {/* Courier */}
                      <td className="py-2 px-1 text-center text-slate-700 font-medium truncate border-r border-b border-slate-300 text-[11px]" title={order.dispatch.courierName || "Unassigned"}>
                        {order.dispatch.courierName ? (
                          <span className="font-semibold text-slate-800">{order.dispatch.courierName}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      {/* LLR */}
                      <td className="py-2 px-1 text-center font-mono text-slate-700 truncate border-r border-b border-slate-300 text-[11px]">
                        {order.dispatch.llrNumber ? (
                          <span className="truncate block" title={order.dispatch.llrNumber}>{order.dispatch.llrNumber}</span>
                        ) : order.dispatch.courierName ? (
                          <span className="text-amber-600 text-[10px] italic font-normal truncate block">
                            {order.dispatch.courierName === "ST Courier" ? "LLR Required" : "-"}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      {/* Courier Status */}
                      <td className="py-2 px-1 text-center truncate border-r border-b border-slate-300">
                        <CourierStatusBadge status={order.dispatch.courierStatus} className="justify-center text-[11px]" />
                      </td>

                      {/* SMS Status */}
                      <td className="py-2 px-1 text-center whitespace-nowrap border-r border-b border-slate-300">
                        <SmsStatusBadge status={order.sms.status} className="justify-center" />
                      </td>

{/* Return Column */}
                      <td className="py-2 px-1 text-center truncate border-r border-b border-slate-300" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const orderReturns = returns.filter((r) => r.orderId === order.id || r.orderNumber === order.orderNumber);
                          if (orderReturns.length === 0) {
                            return <span className="text-slate-400 text-[10.5px]">No Return</span>;
                          }
                          const latestReturn = orderReturns[0];
                          return (
                            <ReturnCompactIndicator
                              status={latestReturn.status}
                              returnId={latestReturn.returnId}
                              onClick={() => setSelectedReturn(latestReturn)}
                            />
                          );
                        })()}
                      </td>

                      {/* Order Tracking */}
                      <td className="py-2 px-1 text-center border-b border-slate-300 bg-slate-50/50" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 text-orange-700 hover:bg-orange-100/70 border border-orange-200 rounded transition-colors inline-flex items-center justify-center shadow-2xs"
                          title="View order tracking details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="p-4 hover:bg-slate-50 cursor-pointer space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {order.orderNumber}
                  </span>
                  <SourceBadge source={order.source} />
                </div>
                <OrderStatusBadge status={order.orderStatus} />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-slate-800">{order.customer.name}</span>
                  <span className="text-slate-400 block text-[11px]">{order.customer.mobile}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900">{formatINR(order.totalAmount)}</span>
                  <span className="text-slate-400 block text-[11px]">
                    {order.items.length} items
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                <span>
                  Courier: <strong>{order.dispatch.courierName || "-"}</strong>
                </span>
                <SmsStatusBadge status={order.sms.status} />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing {filteredOrders.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
            </span>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none ml-2"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Order Drawer */}
      <OrderDetailsDrawer
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={updateOrderStatus}
        onUpdateCourier={updateCourierDetails}
        userRole={user.role}
      />

      {/* Return Details Drawer */}
      <ReturnDetailsDrawer
        returnCase={selectedReturn}
        isOpen={Boolean(selectedReturn)}
        onClose={() => setSelectedReturn(null)}
      />

      {/* Sync WooCommerce Dialog */}
      <SyncWooCommerceDialog
        isOpen={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
      />

      {/* Sync WhatsApp Dialog */}
      <SyncWhatsAppDialog
        isOpen={whatsappSyncDialogOpen}
        onClose={() => setWhatsappSyncDialogOpen(false)}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <OrdersContent />
    </Suspense>
  );
}
