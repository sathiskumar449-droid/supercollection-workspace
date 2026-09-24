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
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Layers, 
  X,
  FileSpreadsheet,
  FileText,
  Globe,
  MessageSquare
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
import { BulkToolbar, StatusOption } from "@/components/bulk-actions/bulk-toolbar";
import { BulkConfirmDialog } from "@/components/bulk-actions/bulk-confirm-dialog";

function OrdersContent() {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("status") as OrderStatus) || "ALL";

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

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [courierFilter, setCourierFilter] = useState<string>("ALL");
  const [courierStatusFilter, setCourierStatusFilter] = useState<string>("ALL");
  const [smsStatusFilter, setSmsStatusFilter] = useState<string>("ALL");
  
  // Sort state
  const [sortField, setSortField] = useState<"createdAt" | "totalAmount" | "orderNumber">("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // 21. All Orders remains the master overview: all orders stay visible across every lifecycle stage
  const baseOrders = orders;

  // Filtered & Sorted orders calculation
  const filteredOrders = useMemo(() => {
    return baseOrders.filter((order) => {
      // Search
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

      // Order Status
      if (statusFilter !== "ALL" && order.orderStatus !== statusFilter) {
        return false;
      }

      // Source
      if (sourceFilter !== "ALL" && order.source !== sourceFilter) {
        return false;
      }

      // Courier
      if (courierFilter !== "ALL" && order.dispatch.courierName !== courierFilter) {
        return false;
      }

      // Courier Status
      if (courierStatusFilter !== "ALL") {
        const isShippedFilter = courierStatusFilter === "SHIPPED";
        const orderIsShipped = order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DELIVERED";
        if (isShippedFilter && !orderIsShipped) return false;
        if (!isShippedFilter && order.dispatch.courierStatus !== courierStatusFilter) return false;
      }

      // SMS Status
      if (smsStatusFilter !== "ALL" && order.sms.status !== smsStatusFilter) {
        return false;
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
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [baseOrders, searchQuery, dateFilter, customDate, statusFilter, sourceFilter, courierFilter, courierStatusFilter, smsStatusFilter, sortField, sortAsc]);

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
    setStatusFilter("ALL");
    setSourceFilter("ALL");
    setCourierFilter("ALL");
    setCourierStatusFilter("ALL");
    setSmsStatusFilter("ALL");
    setPage(1);
  };

  const activeFilterCount = [
    statusFilter !== "ALL",
    sourceFilter !== "ALL",
    courierFilter !== "ALL",
    courierStatusFilter !== "ALL",
    smsStatusFilter !== "ALL",
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
      subtitle: `Filtered Orders: ${filteredOrders.length} | Status: ${statusFilter}`,
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

      {/* Bulk Actions Toolbar */}
      <BulkToolbar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        statusOptions={BULK_STATUS_OPTIONS}
        selectedStatus={bulkStatus}
        onStatusChange={setBulkStatus}
        onApplyAction={() => setIsConfirmDialogOpen(true)}
        isActionDisabled={!bulkStatus || validOrders.length === 0}
        isLoading={isBulkUpdating}
      />

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

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-subtle space-y-2.5">
        {/* Row 1: Search + Filters + Export */}
        <div className="flex items-center gap-2.5 flex-nowrap overflow-x-auto">
          {/* Search Input */}
          <div className="relative flex items-center shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Order ID, Customer, Phone..."
              className="text-xs pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-800 placeholder-slate-400 w-52 transition-all"
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

          {/* Order Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer shrink-0"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="CONFIRMED">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="RETURN">↩ Return</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer shrink-0"
          >
            <option value="ALL">All Sources</option>
            <option value="WEBSITE">Website (WooCommerce)</option>
            <option value="WHATSAPP">WhatsApp Chat Box</option>
          </select>

          {/* Courier Filter */}
          <select
            value={courierFilter}
            onChange={(e) => {
              setCourierFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer shrink-0"
          >
            <option value="ALL">All Couriers</option>
            <option value="ST Courier">ST Courier</option>
            <option value="Professional Courier">Professional Courier</option>
            <option value="DTDC">DTDC</option>
            <option value="India Post">India Post</option>
            <option value="Delhivery">Delhivery</option>
            <option value="Blue Dart">Blue Dart</option>
          </select>

          {/* Courier Status Filter */}
          <select
            value={courierStatusFilter}
            onChange={(e) => {
              setCourierStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer shrink-0"
          >
            <option value="ALL">All Courier Statuses</option>
            <option value="PENDING">Courier Pending</option>
            <option value="SHIPPED">Courier Shipped</option>
          </select>

          {/* SMS Status Filter */}
          <select
            value={smsStatusFilter}
            onChange={(e) => {
              setSmsStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer shrink-0"
          >
            <option value="ALL">All SMS Statuses</option>
            <option value="SENT">SMS Sent</option>
            <option value="PENDING">SMS Pending</option>
            <option value="FAILED">SMS Failed</option>
          </select>

          {/* Reset Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1.5 rounded hover:bg-red-50 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear ({activeFilterCount})</span>
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Export Actions (inline, rightmost) */}
          <button
            onClick={handleExportExcel}
            title="Download filtered orders as Excel Spreadsheet (.csv)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            title="Print or Save PDF Report"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Orders Table (Excel Spreadsheet Grid Style with S.No) */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto hidden md:block w-full">
          <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-300">
            <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[10.5px] uppercase tracking-tight">
              <tr>
                <th className="py-2 px-1 w-[2.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={isAllPageSelected}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                    title={isAllPageSelected ? "Deselect page" : "Select all orders on this page"}
                  />
                </th>
                <th className="py-2 px-1 w-[3%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  S.No
                </th>
                <th
                  className="py-2 px-1.5 w-[7.5%] cursor-pointer hover:text-slate-900 border-r border-b-2 border-slate-300 bg-slate-100"
                  onClick={() => {
                    setSortField("orderNumber");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1 truncate">
                    <span>Order ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </th>
                <th
                  className="py-2 px-1.5 w-[7.5%] cursor-pointer hover:text-slate-900 border-r border-b-2 border-slate-300 bg-slate-100"
                  onClick={() => {
                    setSortField("createdAt");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1 truncate">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </th>
                <th className="py-2 px-1.5 w-[11.5%] border-r border-b-2 border-slate-300 bg-slate-100">
                  Customer Name
                </th>
                <th className="py-2 px-1 w-[6%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Source</th>
                <th className="py-2 px-1 w-[4.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Items</th>
                <th
                  className="py-2 px-1.5 w-[6%] text-right cursor-pointer hover:text-slate-900 border-r border-b-2 border-slate-300 bg-slate-100"
                  onClick={() => {
                    setSortField("totalAmount");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </th>
                <th className="py-2 px-1 w-[7.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Order Status</th>
                <th className="py-2 px-1 w-[6%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Return</th>
                <th className="py-2 px-1 w-[7%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Courier</th>
                <th className="py-2 px-1 w-[6.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">LLR</th>
                <th className="py-2 px-1 w-[7.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Courier Status</th>
                <th className="py-2 px-1 w-[11%] text-center border-r border-b-2 border-slate-300 bg-slate-100">SMS Status</th>
                <th className="py-2 px-1 w-[4%] text-center border-b-2 border-slate-300 bg-slate-200/70 text-slate-800 whitespace-nowrap"></th>
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

                      {/* Customer Name (compact width, truncated name, phone below) */}
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

                      {/* Return Column (Requirement 19) */}
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
                  Courier: <strong>{order.dispatch.courierName}</strong>
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


