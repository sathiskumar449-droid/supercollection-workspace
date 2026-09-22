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
  Globe
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { Order, OrderStatus, CourierStatus, SmsStatus, OrderSource } from "@/types/orderflow";
import { OrderStatusBadge, CourierStatusBadge, SmsStatusBadge, SourceBadge } from "@/components/ui/status-badge";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { SyncWooCommerceDialog } from "@/components/sync-woocommerce-dialog";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

function OrdersContent() {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("status") as OrderStatus) || "ALL";

  const { 
    orders, 
    user, 
    updateOrderStatus, 
    updateCourierDetails,
    searchQuery,
    setSearchQuery,
    dateFilter,
    customDate,
  } = useOrderFlow();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

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

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtered & Sorted orders calculation
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
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
      if (customDate) {
        if (order.createdAt.slice(0, 10) !== customDate) return false;
      } else if (dateFilter === "Today") {
        const orderDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(order.createdAt));
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
        if (orderDateStr !== todayStr) return false;
      } else if (dateFilter === "Last 7 Days") {
        const orderTime = new Date(order.createdAt).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
        if (orderTime < sevenDaysAgo) return false;
      } else if (dateFilter === "This Month") {
        const orderMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(order.createdAt)).slice(0, 7);
        const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).slice(0, 7);
        if (orderMonth !== thisMonth) return false;
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
  }, [orders, searchQuery, dateFilter, customDate, statusFilter, sourceFilter, courierFilter, courierStatusFilter, smsStatusFilter, sortField, sortAsc]);

  // Paginated orders
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  // Bulk actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedOrders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkConfirm = () => {
    selectedIds.forEach((id) => {
      const ord = orders.find((o) => o.id === id);
      if (ord && ord.orderStatus === "NEW") {
        updateOrderStatus(id, "CONFIRMED", "Bulk confirmed by staff");
      }
    });
    setSelectedIds([]);
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
      order.dispatch.courierName,
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
      order.dispatch.courierName,
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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Bulk Actions Banner */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 px-3.5 py-2 rounded-xl text-xs animate-in fade-in">
          <span className="font-semibold text-orange-900">
            {selectedIds.length} orders selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkConfirm}
              className="px-3 py-1 bg-orange-700 hover:bg-orange-800 text-white font-medium rounded-lg transition-colors"
            >
              Bulk Confirm
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-500 hover:text-slate-800 px-2 py-1"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar (Search is cleanly unified in TopBar) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-subtle flex flex-wrap items-center justify-between gap-3">
        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              title="Download filtered orders as Excel Spreadsheet (.csv)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPdf}
              title="Print or Save PDF Report"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>

          {/* Order Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="NEW">New</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PACKING">Packing</option>
            <option value="PACKED">Packed</option>
            <option value="DISPATCHED">Dispatched</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer"
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
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Couriers</option>
            <option value="ST Courier">ST Courier</option>
            <option value="Delhivery">Delhivery</option>
            <option value="DTDC">DTDC</option>
            <option value="Blue Dart">Blue Dart</option>
          </select>

          {/* Courier Status Filter */}
          <select
            value={courierStatusFilter}
            onChange={(e) => {
              setCourierStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer"
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
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium text-slate-700 cursor-pointer"
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
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1.5 rounded hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear ({activeFilterCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders Table (Excel Spreadsheet Grid Style with S.No) */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[11px] uppercase tracking-tight">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={paginatedOrders.length > 0 && selectedIds.length === paginatedOrders.length}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-2 w-12 text-center border-r border-b-2 border-slate-300 bg-slate-100">
                  S.No
                </th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 border-r border-b-2 border-slate-300 bg-slate-100"
                  onClick={() => {
                    setSortField("orderNumber");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Order ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 border-r border-b-2 border-slate-300 bg-slate-100"
                  onClick={() => {
                    setSortField("createdAt");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Order Created Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Customer Name</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Source</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Items</th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 border-r border-b-2 border-slate-300 bg-slate-100"
                  onClick={() => {
                    setSortField("totalAmount");
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Order Status</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Courier</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">LLR</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">Courier Status</th>
                <th className="py-2.5 px-3 border-r border-b-2 border-slate-300 bg-slate-100">SMS Status</th>
                <th className="py-2.5 px-3 text-right border-b-2 border-slate-300 bg-slate-200/70 text-slate-800">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 border-b border-slate-300">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No matching orders found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {orders.length === 0 
                        ? "No orders imported yet from WooCommerce." 
                        : "Try adjusting your filters or search query."}
                    </p>
                    {orders.length === 0 && (
                      <button
                        onClick={() => setSyncDialogOpen(true)}
                        className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Sync Orders from WooCommerce</span>
                      </button>
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
                      <td className="py-2.5 px-3 text-center border-r border-b border-slate-300 bg-slate-50" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(order.id)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>

                      {/* S.No column */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 bg-slate-50 border-r border-b border-slate-300">
                        {serialNo}
                      </td>

                      {/* Order ID */}
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap border-r border-b border-slate-300">
                        {order.orderNumber}
                      </td>

                      {/* Order Created Date */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap border-r border-b border-slate-300 font-medium">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Customer Name */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300">
                        <span className="font-semibold text-slate-800 block">
                          {order.customer.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {order.customer.mobile}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300">
                        <SourceBadge source={order.source} />
                      </td>

                      {/* Items */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap border-r border-b border-slate-300">
                        {order.items.length} {order.items.length === 1 ? "Item" : "Items"}
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap border-r border-b border-slate-300">
                        {formatINR(order.totalAmount)}
                      </td>

                      {/* Order Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300">
                        <OrderStatusBadge status={order.orderStatus} />
                      </td>

                      {/* Courier */}
                      <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap border-r border-b border-slate-300">
                        {order.dispatch.courierName}
                      </td>

                      {/* LLR */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap border-r border-b border-slate-300">
                        {order.dispatch.llrNumber || (
                          <span className="text-amber-600 text-[11px] italic font-normal">
                            {order.dispatch.courierName === "ST Courier" ? "LLR Required" : "-"}
                          </span>
                        )}
                      </td>

                      {/* Courier Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300">
                        <CourierStatusBadge status={order.dispatch.courierStatus} />
                      </td>

                      {/* SMS Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300">
                        <SmsStatusBadge status={order.sms.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap border-b border-slate-300 bg-slate-50/50" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 border border-orange-200 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
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

      {/* Sync WooCommerce Dialog */}
      <SyncWooCommerceDialog
        isOpen={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
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


