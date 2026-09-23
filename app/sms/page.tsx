"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  ShieldAlert, 
  Info, 
  Eye, 
  Phone,
  FileSpreadsheet,
  FileText,
  CheckCheck
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { SmsStatusBadge, SourceBadge } from "@/components/ui/status-badge";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { BulkToolbar } from "@/components/bulk-actions/bulk-toolbar";
import { formatDate, cn, matchesDateFilter } from "@/lib/utils";
import { Order, SmsStatus } from "@/types/orderflow";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

function SmsMonitoringContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "ALL";

  const { orders, user, syncPing4SmsStatus, bulkSyncPing4SmsStatus, updateOrderStatus, updateCourierDetails, dateFilter, customDate } = useOrderFlow();
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRefreshing, setIsBulkRefreshing] = useState(false);

  // ONLY orders that have been marked as "SHIPPED" in Courier Hub (after being dispatched from packing)
  // Filtered by global TopBar date filter / calendar picker
  const shippedOrders = useMemo(() => {
    return orders.filter((o) => 
      matchesDateFilter(o.sms.sentAt || o.createdAt, dateFilter, customDate) &&
      (o.dispatch.courierStatus === "SHIPPED" || (o.dispatch.courierStatus as string) === "DELIVERED") &&
      (Boolean(o.dispatchedAt) || Boolean(o.dispatch.dispatchedAt))
    );
  }, [orders, dateFilter, customDate]);

  // Orders that have SMS logged (shipped orders)
  const smsOrders = useMemo(() => {
    return shippedOrders.filter((o) => {
      // Filter by SMS status
      if (statusFilter !== "ALL" && o.sms.status !== statusFilter) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.mobile.toLowerCase().includes(q) ||
          (o.dispatch.llrNumber && o.dispatch.llrNumber.toLowerCase().includes(q)) ||
          (o.sms.providerMessageId && o.sms.providerMessageId.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [shippedOrders, statusFilter, searchQuery]);

  // Overall counts across shipped orders
  const totalSms = shippedOrders.length;
  const sentCount = shippedOrders.filter((o) => o.sms.status === "SENT").length;
  const pendingCount = shippedOrders.filter((o) => o.sms.status === "PENDING").length;
  const failedCount = shippedOrders.filter((o) => o.sms.status === "FAILED").length;
  const deliveryRate = totalSms > 0 ? Math.round((sentCount / totalSms) * 100) : 0;

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

  const handleBulkRefreshSms = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkRefreshing(true);
    try {
      const res = bulkSyncPing4SmsStatus(selectedIds);
      triggerToast(`Polled Ping4SMS gateway. ${res.updatedCount} delivery receipts updated for ${selectedIds.length} orders.`);
      setSelectedIds([]);
    } finally {
      setIsBulkRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshBanner(null);
    try {
      const res = syncPing4SmsStatus();
      setRefreshBanner(`Polled Ping4SMS gateway. ${res.updatedCount} delivery receipts updated.`);
      setTimeout(() => setRefreshBanner(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Export handlers for Excel and PDF
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Order ID",
      "Customer Name",
      "City",
      "Customer Phone Number",
      "LLR Number",
      "SMS Status",
      "Last SMS Date",
    ];

    const rows = smsOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      order.customer.name,
      order.customer.city || "",
      order.customer.mobile,
      order.dispatch.llrNumber || "No LLR",
      order.sms.status,
      formatDate(order.sms.sentAt || order.createdAt),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(`SMS_Monitoring_Records_${dateStr}`, headers, rows);
    triggerToast(`Exported ${rows.length} SMS records to Excel successfully`);
  };

  const handleExportPdf = () => {
    const headers = [
      "S.No",
      "Order ID",
      "Customer Name",
      "Phone Number",
      "LLR Number",
      "SMS Status",
      "Date",
    ];

    const rows = smsOrders.map((order, index) => [
      index + 1,
      order.orderNumber,
      order.customer.name,
      order.customer.mobile,
      order.dispatch.llrNumber || "-",
      order.sms.status,
      formatDate(order.sms.sentAt || order.createdAt),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToPdf({
      title: "Ping4SMS Gateway - SMS Delivery Monitoring Report",
      subtitle: `Status Filter: ${statusFilter} | Total Records: ${smsOrders.length}`,
      filename: `SMS_Monitoring_Report_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-4 max-w-full pb-16">
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

        {/* Pending */}
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
            <span>Awaiting Carrier DLR</span>
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

      {/* Bulk Selection Toolbar */}
      <BulkToolbar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        customAction={
          <button
            onClick={handleBulkRefreshSms}
            disabled={isBulkRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isBulkRefreshing && "animate-spin")} />
            <span>{isBulkRefreshing ? "Polling Gateway..." : `Refresh Selected (${selectedIds.length})`}</span>
          </button>
        }
      />

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs w-full md:w-auto overflow-x-auto">
            {[
              { key: "ALL", label: "All Statuses" },
              { key: "SENT", label: `Sent (${sentCount})` },
              { key: "PENDING", label: `Pending (${pendingCount})` },
              { key: "FAILED", label: `Failed (${failedCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium transition-all text-xs whitespace-nowrap",
                  statusFilter === tab.key
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end w-full md:w-auto">
            {toastMessage && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold animate-in fade-in">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{toastMessage}</span>
              </div>
            )}

            {refreshBanner && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-in fade-in">
                {refreshBanner}
              </span>
            )}

            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Mobile, Order #, LLR..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-orange-500"
              />
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-700 hover:bg-orange-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
              <span>{isRefreshing ? "Checking..." : "Refresh Status"}</span>
            </button>

            {/* Export Actions (Last/Rightmost) */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                title="Download SMS logs as Excel Spreadsheet (.csv)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportPdf}
                title="Print or Save PDF Report"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* SMS Excel Spreadsheet Table */}
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-300">
            <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[11px] uppercase tracking-tight">
              <tr>
                <th className="py-2.5 px-2 w-[4%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
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
                <th className="py-2.5 px-2 w-[5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">S.No</th>
                <th className="py-2.5 px-3 w-[16%] border-r border-b-2 border-slate-300 bg-slate-100">Order ID</th>
                <th className="py-2.5 px-3 w-[23%] border-r border-b-2 border-slate-300 bg-slate-100">Customer Name</th>
                <th className="py-2.5 px-3 w-[18%] border-r border-b-2 border-slate-300 bg-slate-100">Customer Phone Number</th>
                <th className="py-2.5 px-3 w-[17%] border-r border-b-2 border-slate-300 bg-slate-100">LLR Number</th>
                <th className="py-2.5 px-2 w-[17%] text-center border-b-2 border-slate-300 bg-slate-200/70 text-slate-800">SMS Status</th>
              </tr>
            </thead>
            <tbody>
              {smsOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 border-b border-slate-300">
                    <Send className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No Shipped Orders for SMS Tracking</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {shippedOrders.length === 0
                        ? "Orders will appear here automatically once marked as 'Shipped' in the Courier Hub."
                        : "Try switching status filters or clearing the search query."}
                    </p>
                  </td>
                </tr>
              ) : (
                smsOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    onClick={() => setInspectOrder(order)}
                    className={cn(
                      "hover:bg-orange-50/40 transition-colors cursor-pointer group",
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

                    {/* 5. LLR Number */}
                    <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300 font-mono text-xs">
                      {order.dispatch.llrNumber ? (
                        <span className="font-semibold text-slate-800 font-mono">
                          {order.dispatch.llrNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No LLR</span>
                      )}
                    </td>

                    {/* 6. SMS Status */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap border-b border-slate-300 bg-slate-50/50">
                      <SmsStatusBadge status={order.sms.status} />
                    </td>
                  </tr>
                ))
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


