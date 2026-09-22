"use client";

import React, { useState, useMemo } from "react";
import { 
  Box, 
  Package, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Play, 
  Check, 
  User, 
  Search, 
  Phone, 
  Truck, 
  RotateCcw, 
  AlertCircle, 
  Eye, 
  CheckCheck,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { SourceBadge, OrderStatusBadge } from "@/components/ui/status-badge";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatINR, formatTimeAgo, formatDate, cn } from "@/lib/utils";
import { Order, OrderStatus } from "@/types/orderflow";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";
import { BulkToolbar, StatusOption } from "@/components/bulk-actions/bulk-toolbar";
import { BulkConfirmDialog } from "@/components/bulk-actions/bulk-confirm-dialog";

// Status definitions mapping to the exact terms requested by user:
// "porcessing pending completed pacakaging packed dispatched nu"
const STATUS_OPTIONS: { key: OrderStatus; label: string; badgeColor: string }[] = [
  { key: "NEW", label: "Pending", badgeColor: "bg-slate-100 text-slate-700 border-slate-300" },
  { key: "CONFIRMED", label: "Processing", badgeColor: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "PACKING", label: "Packaging", badgeColor: "bg-orange-50 text-orange-700 border-orange-200" },
  { key: "PACKED", label: "Packed", badgeColor: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "DISPATCHED", label: "Dispatched", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "COMPLETED", label: "Completed", badgeColor: "bg-orange-50 text-orange-800 border-orange-300" },
];

function InlineDispatchInput({
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
        placeholder="Enter LLR / No..."
        className={cn(
          "w-full text-[10px] font-mono py-1 px-1.5 rounded border transition-all outline-none",
          savedSuccess
            ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300 font-semibold"
            : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20",
          !val && "placeholder:text-slate-300 text-slate-500"
        )}
        title={val ? `Dispatch No: ${val} (Press Enter or click away to save)` : "Enter Dispatch / LLR Number manually"}
      />
      {savedSuccess && (
        <Check className="w-3 h-3 text-emerald-600 absolute right-1.5 pointer-events-none" />
      )}
    </div>
  );
}

export default function PackingPage() {
  const { orders, user, updateOrderStatus, updateCourierDetails } = useOrderFlow();
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Instant notification feedback when status or dispatch number is updated
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInlineStatusChange = (order: Order, newStatus: OrderStatus) => {
    if (order.orderStatus === newStatus) return;
    const targetLabel = STATUS_OPTIONS.find((s) => s.key === newStatus)?.label || newStatus;
    updateOrderStatus(order.id, newStatus, `Status updated to ${targetLabel} from Packing Station Table`);
    if (newStatus === "DISPATCHED") {
      updateCourierDetails(order.id, {
        courierStatus: "PENDING",
        courierName: order.dispatch.courierName || "ST Courier",
      });
    }
    triggerToast(`Order ${order.orderNumber} status updated to ${targetLabel}`);
  };

  const handleDispatchNoChange = (orderId: string, orderNumber: string, newLlr: string) => {
    updateCourierDetails(orderId, {
      llrNumber: newLlr || undefined,
    });
    triggerToast(
      newLlr 
        ? `Order ${orderNumber} dispatch no set to ${newLlr}` 
        : `Order ${orderNumber} dispatch no cleared`
    );
  };

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const BULK_STATUS_OPTIONS: StatusOption[] = [
    { value: "CONFIRMED", label: "Processing" },
    { value: "PACKING", label: "Packaging" },
    { value: "PACKED", label: "Packed" },
    { value: "DISPATCHED", label: "Dispatched" },
  ];

  // Orders eligible for Packing Station (WooCommerce completed/processing or active packing flow)
  // Strictly excludes "NEW" (Pending) and "RETURN" (Failed/Cancelled)
  const packingEligibleOrders = useMemo(() => {
    return orders.filter((o) => o.orderStatus !== "NEW" && o.orderStatus !== "RETURN");
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return packingEligibleOrders.filter((order) => {
      // Status filter
      if (statusFilter !== "ALL" && order.orderStatus !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          order.orderNumber.toLowerCase().includes(q) ||
          order.customer.name.toLowerCase().includes(q) ||
          order.customer.mobile.toLowerCase().includes(q) ||
          (order.dispatch.llrNumber && order.dispatch.llrNumber.toLowerCase().includes(q)) ||
          order.items.some((it) => it.productName.toLowerCase().includes(q) || it.size.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [packingEligibleOrders, statusFilter, searchQuery]);

  // Validate selected orders against chosen bulk target status
  const { validOrders, skippedOrders } = useMemo(() => {
    if (!bulkStatus || selectedIds.length === 0) {
      return { validOrders: [], skippedOrders: [] };
    }
    const targetStatus = bulkStatus as OrderStatus;
    const targetLabel = STATUS_OPTIONS.find((s) => s.key === targetStatus)?.label || targetStatus;

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

  const isAllFilteredSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedIds.includes(o.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Filter-aware: select all currently filtered orders
      const newIds = Array.from(new Set([...selectedIds, ...filteredOrders.map((o) => o.id)]));
      setSelectedIds(newIds);
    } else {
      // Deselect currently filtered orders
      const filteredIdSet = new Set(filteredOrders.map((o) => o.id));
      setSelectedIds(selectedIds.filter((id) => !filteredIdSet.has(id)));
    }
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
    const targetLabel = STATUS_OPTIONS.find((s) => s.key === targetStatus)?.label || targetStatus;

    validOrders.forEach((order) => {
      updateOrderStatus(order.id, targetStatus, `Bulk status updated to ${targetLabel}`);
      if (targetStatus === "DISPATCHED") {
        updateCourierDetails(order.id, {
          courierStatus: "PENDING",
          courierName: order.dispatch.courierName || "ST Courier",
        });
      }
    });

    setIsBulkUpdating(false);
    setIsConfirmDialogOpen(false);
    setSelectedIds([]);
    setBulkStatus("");
    triggerToast(`${validOrders.length} ${validOrders.length === 1 ? "order" : "orders"} updated to ${targetLabel} successfully.`);
  };

  // Stage counts for KPI pills (Packing Station)
  const completedCount = packingEligibleOrders.filter((o) => o.orderStatus === "COMPLETED").length;
  const processingCount = packingEligibleOrders.filter((o) => o.orderStatus === "CONFIRMED").length;
  const packagingCount = packingEligibleOrders.filter((o) => o.orderStatus === "PACKING").length;
  const packedCount = packingEligibleOrders.filter((o) => o.orderStatus === "PACKED").length;
  const dispatchedCount = packingEligibleOrders.filter((o) => o.orderStatus === "DISPATCHED").length;

  // Export handlers
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Date",
      "Order ID",
      "Payment",
      "Phone Number",
      "Customer Name",
      "Amount (INR)",
      "Items",
      "Size",
      "Qty",
      "Order Taken",
      "Dispatch No",
      "Status",
    ];

    const rows = filteredOrders.map((order, index) => {
      const primaryItem = order.items[0];
      const allItems = order.items.map((it) => it.productName).join("; ");
      const allSizes = Array.from(new Set(order.items.map((it) => it.size))).join(", ");
      const totalQuantity = order.items.reduce((sum, it) => sum + it.quantity, 0);
      const orderTakenBy =
        order.orderTakenBy ||
        (order.source === "WHATSAPP" ? "WhatsApp" : "Website");
      const statusLabel = STATUS_OPTIONS.find((s) => s.key === order.orderStatus)?.label || order.orderStatus;

      return [
        index + 1,
        formatDate(order.createdAt),
        order.orderNumber,
        order.paymentStatus,
        order.customer.mobile,
        order.customer.name,
        order.totalAmount,
        allItems || primaryItem?.productName || "",
        allSizes,
        totalQuantity,
        orderTakenBy,
        order.dispatch.llrNumber || "",
        statusLabel,
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(`Packing_Station_Orders_${dateStr}`, headers, rows);
    triggerToast(`Exported ${rows.length} orders to Excel successfully`);
  };

  const handleExportPdf = () => {
    const headers = [
      "S.No",
      "Date",
      "Order ID",
      "Pay",
      "Phone",
      "Customer Name",
      "Amount",
      "Items",
      "Size",
      "Qty",
      "Source",
      "Dispatch No",
      "Status",
    ];

    const rows = filteredOrders.map((order, index) => {
      const allSizes = Array.from(new Set(order.items.map((it) => it.size))).join(", ");
      const totalQuantity = order.items.reduce((sum, it) => sum + it.quantity, 0);
      const orderTakenBy =
        order.orderTakenBy ||
        (order.source === "WHATSAPP" ? "WhatsApp" : "Website");
      const statusLabel = STATUS_OPTIONS.find((s) => s.key === order.orderStatus)?.label || order.orderStatus;

      return [
        index + 1,
        formatDate(order.createdAt),
        order.orderNumber,
        order.paymentStatus,
        order.customer.mobile,
        order.customer.name,
        formatINR(order.totalAmount),
        order.items[0]?.productName + (order.items.length > 1 ? ` (+${order.items.length - 1})` : ""),
        allSizes,
        totalQuantity,
        orderTakenBy,
        order.dispatch.llrNumber || "-",
        statusLabel,
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToPdf({
      title: "Packing Station - Orders Fulfillment Report",
      subtitle: `Status Filter: ${statusFilter} | Showing ${filteredOrders.length} orders`,
      filename: `Packing_Station_Report_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-3.5 max-w-full mx-auto">
      {/* KPI Status Filter Buttons Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs",
            statusFilter === "ALL" ? "border-orange-600 ring-2 ring-orange-500/20" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] text-slate-500 block">All Packing Orders</span>
          <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">{packingEligibleOrders.length}</span>
        </button>

        <button
          onClick={() => setStatusFilter("COMPLETED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs",
            statusFilter === "COMPLETED" ? "border-blue-600 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-blue-300"
          )}
        >
          <span className="text-[11px] text-blue-800 font-medium block">Completed (Ready)</span>
          <span className="text-base font-bold text-blue-800 font-mono mt-0.5 block">{completedCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("CONFIRMED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs",
            statusFilter === "CONFIRMED" ? "border-sky-600 ring-2 ring-sky-500/20" : "border-slate-200 hover:border-sky-300"
          )}
        >
          <span className="text-[11px] text-sky-700 font-medium block">Processing</span>
          <span className="text-base font-bold text-sky-700 font-mono mt-0.5 block">{processingCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("PACKING")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs",
            statusFilter === "PACKING" ? "border-orange-600 ring-2 ring-orange-500/20" : "border-slate-200 hover:border-orange-300"
          )}
        >
          <span className="text-[11px] text-orange-700 font-medium block">Packaging</span>
          <span className="text-base font-bold text-orange-600 font-mono mt-0.5 block">{packagingCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("PACKED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs",
            statusFilter === "PACKED" ? "border-purple-600 ring-2 ring-purple-500/20" : "border-slate-200 hover:border-purple-300"
          )}
        >
          <span className="text-[11px] text-purple-700 font-medium block">Packed</span>
          <span className="text-base font-bold text-purple-700 font-mono mt-0.5 block">{packedCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("DISPATCHED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs",
            statusFilter === "DISPATCHED" ? "border-emerald-600 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-emerald-300"
          )}
        >
          <span className="text-[11px] text-emerald-700 font-medium block">Dispatched</span>
          <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">{dispatchedCount}</span>
        </button>
      </div>

      {/* Filter, Search & Export Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Name, Phone, Items, Size, or Dispatch LLR..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-orange-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 text-xs flex-wrap justify-end w-full md:w-auto">
          {toastMessage && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold animate-in fade-in">
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Export Actions (Excel & PDF) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              title="Download filtered orders as Excel Spreadsheet (.csv)"
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

          <span className="text-slate-500 font-medium whitespace-nowrap pl-1 border-l border-slate-200">
            Showing <strong>{filteredOrders.length}</strong> orders
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-red-600 hover:text-red-700 font-medium px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
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

      {/* Bulk Confirmation Modal */}
      <BulkConfirmDialog
        isOpen={isConfirmDialogOpen}
        targetStatusLabel={STATUS_OPTIONS.find((s) => s.key === bulkStatus)?.label || bulkStatus}
        totalSelected={selectedIds.length}
        validCount={validOrders.length}
        skippedOrders={skippedOrders}
        onConfirm={handleConfirmBulkUpdate}
        onCancel={() => setIsConfirmDialogOpen(false)}
        isLoading={isBulkUpdating}
      />

      {/* EXCEL SPREADSHEET TABLE VIEW */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden w-full">
        <table className="w-full table-fixed text-left text-[11px] border-collapse border border-slate-300">
          <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[10px] uppercase tracking-tight">
            <tr>
              <th className="py-2 px-1 w-[2.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                  title={isAllFilteredSelected ? "Deselect all" : "Select all filtered orders"}
                />
              </th>
              <th className="py-2 px-1 w-[3%] text-center border-r border-b-2 border-slate-300 bg-slate-100">S.No</th>
              <th className="py-2 px-1.5 w-[7%] border-r border-b-2 border-slate-300 bg-slate-100">Date</th>
              <th className="py-2 px-1 w-[5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Payment</th>
              <th className="py-2 px-1.5 w-[9%] border-r border-b-2 border-slate-300 bg-slate-100">Phone Number</th>
              <th className="py-2 px-1.5 w-[11.5%] border-r border-b-2 border-slate-300 bg-slate-100">Name</th>
              <th className="py-2 px-1.5 w-[6%] border-r border-b-2 border-slate-300 bg-slate-100">Amount</th>
              <th className="py-2 px-1.5 w-[16%] border-r border-b-2 border-slate-300 bg-slate-100">Items</th>
              <th className="py-2 px-1 w-[6%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Size</th>
              <th className="py-2 px-1 w-[3%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Qty</th>
              <th className="py-2 px-1.5 w-[8%] border-r border-b-2 border-slate-300 bg-slate-100">Order Taken</th>
              <th className="py-2 px-1.5 w-[11%] border-r border-b-2 border-slate-300 bg-slate-100">Dispatch No</th>
              <th className="py-2 px-1 w-[12%] text-center border-b-2 border-slate-300 bg-slate-200/70 text-slate-800">Update Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-14 text-center text-slate-400 border-b border-slate-300">
                  <Box className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No orders match your filter criteria</p>
                  <p className="text-xs text-slate-400 mt-1">Try selecting "All Orders" or clearing the search query.</p>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order, index) => {
                const primaryItem = order.items[0];
                const allSizes = Array.from(new Set(order.items.map((it) => it.size))).join(", ");
                const totalQuantity = order.items.reduce((sum, it) => sum + it.quantity, 0);

                const orderTakenBy =
                  order.orderTakenBy ||
                  (order.source === "WHATSAPP" ? "WhatsApp" : "Website");

                return (
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
                      className="py-2 px-1 text-center bg-slate-50/70 border-r border-b border-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => handleToggleSelect(order.id)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                      />
                    </td>

                    {/* 1. S.No (Spreadsheet row index) */}
                    <td className="py-2 px-1 text-center font-mono font-bold text-slate-600 bg-slate-50 border-r border-b border-slate-300">
                      {index + 1}
                    </td>

                    {/* 2. Date */}
                    <td className="py-2 px-1.5 whitespace-nowrap text-slate-600 border-r border-b border-slate-300 font-mono text-[10px] truncate">
                      {formatDate(order.createdAt)}
                    </td>

                    {/* 3. Payment */}
                    <td className="py-2 px-1 text-center whitespace-nowrap border-r border-b border-slate-300">
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded text-[10px] font-bold inline-block",
                          order.paymentStatus === "PAID" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                          order.paymentStatus === "COD" && "bg-amber-50 text-amber-700 border border-amber-200",
                          order.paymentStatus === "PENDING" && "bg-slate-100 text-slate-600 border border-slate-200"
                        )}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>

                    {/* 4. Phone Number */}
                    <td className="py-2 px-1.5 whitespace-nowrap font-mono text-slate-700 border-r border-b border-slate-300 text-[10px] truncate">
                      {order.customer.mobile}
                    </td>

                    {/* 5. Name */}
                    <td className="py-2 px-1.5 border-r border-b border-slate-300 truncate">
                      <span className="font-semibold text-slate-800 truncate block leading-tight" title={order.customer.name}>
                        {order.customer.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono block">
                        {order.orderNumber}
                      </span>
                    </td>

                    {/* 6. Amount */}
                    <td className="py-2 px-1.5 whitespace-nowrap font-bold text-slate-900 border-r border-b border-slate-300 font-mono text-[10px]">
                      {formatINR(order.totalAmount)}
                    </td>

                    {/* 7. Items */}
                    <td className="py-2 px-1.5 border-r border-b border-slate-300 text-slate-700 truncate">
                      <span className="font-medium truncate block leading-tight" title={primaryItem?.productName}>
                        {primaryItem?.productName}
                      </span>
                      {order.items.length > 1 && (
                        <span className="text-[9px] text-orange-700 font-semibold block">
                          +{order.items.length - 1} item
                        </span>
                      )}
                    </td>

                    {/* 8. Size */}
                    <td className="py-2 px-1 text-center whitespace-nowrap border-r border-b border-slate-300 font-mono font-semibold text-[10px] text-slate-700 truncate">
                      {allSizes}
                    </td>

                    {/* 9. Qty */}
                    <td className="py-2 px-1 text-center font-mono font-bold text-slate-800 border-r border-b border-slate-300">
                      {totalQuantity}
                    </td>

                    {/* 10. Order Taken By */}
                    <td className="py-2 px-1.5 whitespace-nowrap border-r border-b border-slate-300 text-slate-600 truncate text-[10px]">
                      {orderTakenBy}
                    </td>

                    {/* 11. Dispatch No (Manually Editable) */}
                    <td className="py-1 px-1.5 whitespace-nowrap border-r border-b border-slate-300">
                      <InlineDispatchInput
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                        initialValue={order.dispatch.llrNumber}
                        onSave={handleDispatchNoChange}
                      />
                    </td>

                    {/* 12. Direct Order Status Updater */}
                    <td className="py-1 px-1 text-center whitespace-nowrap border-b border-slate-300 bg-slate-50/50" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={order.orderStatus}
                        onChange={(e) => handleInlineStatusChange(order, e.target.value as OrderStatus)}
                        className={cn(
                          "w-full text-[10px] font-semibold py-0.5 px-1 rounded border border-slate-200 bg-white shadow-xs outline-none cursor-pointer transition-all truncate",
                          order.orderStatus === "NEW" && "text-slate-700",
                          order.orderStatus === "CONFIRMED" && "text-blue-600",
                          order.orderStatus === "PACKING" && "text-orange-600",
                          order.orderStatus === "PACKED" && "text-purple-600",
                          order.orderStatus === "DISPATCHED" && "text-emerald-600",
                          order.orderStatus === "COMPLETED" && "text-emerald-600",
                          order.orderStatus === "RETURN" && "text-rose-600"
                        )}
                      >
                        <option value="NEW">Pending</option>
                        <option value="CONFIRMED">Processing</option>
                        <option value="PACKING">Packaging</option>
                        <option value="PACKED">Packed</option>
                        <option value="DISPATCHED">Dispatched</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="RETURN">Return</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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

