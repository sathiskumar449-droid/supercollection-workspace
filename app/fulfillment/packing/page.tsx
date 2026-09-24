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
  FileText,
  X
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { SourceBadge, OrderStatusBadge } from "@/components/ui/status-badge";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatINR, formatTimeAgo, formatDate, cn, matchesDateFilter } from "@/lib/utils";
import { Order, OrderStatus, ReturnCase, ReturnType } from "@/types/orderflow";
import { CreateReturnModal } from "@/components/returns/create-return-modal";
import { MarkAsReturnModal } from "@/components/returns/mark-as-return-modal";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";
import { BulkToolbar, StatusOption } from "@/components/bulk-actions/bulk-toolbar";
import { BulkConfirmDialog } from "@/components/bulk-actions/bulk-confirm-dialog";

// Status definitions mapping to workflow requirements:
// WooCommerce Processing -> Processing
// WooCommerce Completed -> Completed (Ready)
// Dispatch Number entered -> Dispatched
// Pending -> Pending + Reason/Note
const STATUS_OPTIONS: { key: OrderStatus; label: string; badgeColor: string }[] = [
  { key: "NEW", label: "Pending", badgeColor: "bg-amber-50 text-amber-800 border-amber-300" },
  { key: "CONFIRMED", label: "Processing", badgeColor: "bg-sky-50 text-sky-700 border-sky-200" },
  { key: "PACKING", label: "Packaging", badgeColor: "bg-orange-50 text-orange-700 border-orange-200" },
  { key: "PACKED", label: "Packed", badgeColor: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "DISPATCHED", label: "Dispatched", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "COMPLETED", label: "Completed (Ready)", badgeColor: "bg-blue-50 text-blue-800 border-blue-300" },
  { key: "RETURN", label: "↩ Return", badgeColor: "bg-rose-50 text-rose-700 border-rose-300" },
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
  const { 
    orders, 
    returns,
    user, 
    updateOrderStatus, 
    setOrderPending,
    resolveOrderPending,
    updateCourierDetails, 
    dateFilter, 
    customDate 
  } = useOrderFlow();
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);

  const toggleExpandOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Instant notification feedback when status or dispatch number is updated
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Create Return Modal State (Packing -> Return -> Create Return)
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);

  // Mark As Return Modal State (From Selection Toolbar)
  const [isMarkAsReturnOpen, setIsMarkAsReturnOpen] = useState(false);

  // Pending Reason / Note Modal State
  const [pendingModalOrder, setPendingModalOrder] = useState<Order | null>(null);
  const [pendingReason, setPendingReason] = useState<string>("Product unavailable");
  const [pendingCustomReason, setPendingCustomReason] = useState<string>("");
  const [pendingNote, setPendingNote] = useState<string>("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenPendingModal = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingModalOrder(order);
    const standardReasons = [
      "Product unavailable",
      "Stock mismatch",
      "Customer confirmation pending",
      "Address issue",
      "System issue",
    ];
    if (order.pendingReason && !standardReasons.includes(order.pendingReason)) {
      setPendingReason("Other");
      setPendingCustomReason(order.pendingReason);
    } else {
      setPendingReason(order.pendingReason || "Product unavailable");
      setPendingCustomReason("");
    }
    setPendingNote(order.pendingNote || "");
  };

  const handleSavePending = () => {
    if (!pendingModalOrder) return;
    if (pendingReason === "Other" && !pendingNote.trim() && !pendingCustomReason.trim()) {
      alert("Pending Note is mandatory when 'Other' is selected.");
      return;
    }
    const finalReason =
      pendingReason === "Other" && pendingCustomReason.trim()
        ? pendingCustomReason.trim()
        : pendingReason;

    if (selectedIds.length > 1 && selectedIds.includes(pendingModalOrder.id)) {
      selectedIds.forEach((id) => {
        setOrderPending(id, finalReason, pendingNote.trim());
      });
      triggerToast(`${selectedIds.length} orders marked as Pending (${finalReason})`);
      setSelectedIds([]);
    } else {
      setOrderPending(pendingModalOrder.id, finalReason, pendingNote.trim());
      triggerToast(`Order ${pendingModalOrder.orderNumber} marked as Pending (${finalReason})`);
      if (selectedIds.includes(pendingModalOrder.id)) {
        setSelectedIds((prev) => prev.filter((id) => id !== pendingModalOrder.id));
      }
    }
    setPendingModalOrder(null);
  };

  const handleReturnSuccess = (orderId: string, returnId: string, returnType: ReturnType, amount: number) => {
    const ord = orders.find((o) => o.id === orderId);
    updateOrderStatus(orderId, "RETURN", `Return case ${returnId} initiated from Packing Station (Type: ${returnType}, Amount: ${formatINR(amount)})`);
    triggerToast(`Order ${ord ? ord.orderNumber : orderId} marked as Return (${returnType} - ${formatINR(amount)})`);
    setSelectedIds((prev) => prev.filter((id) => id !== orderId));
  };

  const handleResolvePending = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    resolveOrderPending(order.id);
    triggerToast(`Order ${order.orderNumber} resolved and returned to active workflow`);
  };

  const handleInlineStatusChange = (order: Order, newStatus: OrderStatus) => {
    if (order.orderStatus === newStatus) return;
    if (newStatus === "RETURN") {
      // Sole entry point: Packing -> Update Status -> Return -> Create Return
      setReturnModalOrder(order);
      return;
    }
    const targetLabel = STATUS_OPTIONS.find((s) => s.key === newStatus)?.label || newStatus;
    updateOrderStatus(order.id, newStatus, `Status updated to ${targetLabel} from Packing Station Table`);
    triggerToast(`Order ${order.orderNumber} status updated to ${targetLabel}`);
  };

  const handleDispatchNoChange = (orderId: string, orderNumber: string, newLlr: string) => {
    const trimmed = (newLlr || "").trim();
    if (trimmed) {
      // 1. Atomically update order status to DISPATCHED with manual dispatchId ONLY (NOT llrNumber)
      // DO NOT create Courier Hub record, DO NOT assign courier, DO NOT set waiting for pickup
      updateOrderStatus(
        orderId, 
        "DISPATCHED", 
        `Status updated to Dispatched (Dispatch No: ${trimmed})`,
        { dispatchId: trimmed }
      );
      triggerToast(`Order ${orderNumber} dispatch no set to ${trimmed} & status changed to Dispatched!`);
    } else {
      // Revert status to WooCommerce status (COMPLETED if previously completed, or CONFIRMED if processing)
      const order = orders.find((o) => o.id === orderId);
      const fallbackStatus: OrderStatus = order?.packedAt ? "PACKED" : (order?.completedAt ? "COMPLETED" : "CONFIRMED");
      updateOrderStatus(
        orderId, 
        fallbackStatus, 
        `Dispatch number cleared, reverted to ${fallbackStatus}`,
        { dispatchId: undefined }
      );
      triggerToast(`Order ${orderNumber} dispatch no cleared`);
    }
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

  // Helper to determine if an order is in Return state
  const isOrderReturn = (o: Order) =>
    o.orderStatus === "RETURN" ||
    returns.some((r) => (r.orderId === o.id || r.orderNumber === o.orderNumber) && r.status !== "Rejected" && r.status !== "Cancelled");

  // Orders eligible for Packing Station (active fulfillment: Processing, Packaging, Packed, Dispatched, Completed)
  // Strictly excludes cancelled, pending, failed, and return orders
  const packingEligibleOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!matchesDateFilter(o.createdAt, dateFilter, customDate)) return false;
      // Never show pending, cancelled, failed, return orders in Packing Station
      if (o.orderStatus === "NEW" || o.orderStatus === "RETURN") return false;
      if (isOrderReturn(o)) return false;
      return true;
    });
  }, [orders, dateFilter, customDate, returns]);

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
    });

    setIsBulkUpdating(false);
    setIsConfirmDialogOpen(false);
    setSelectedIds([]);
    setBulkStatus("");
    triggerToast(`${validOrders.length} ${validOrders.length === 1 ? "order" : "orders"} updated to ${targetLabel} successfully.`);
  };

  // Stage counts for KPI pills (Packing Station)
  const processingCount = packingEligibleOrders.filter((o) => o.orderStatus === "CONFIRMED").length;
  const packagingCount = packingEligibleOrders.filter((o) => o.orderStatus === "PACKING").length;
  const packedCount = packingEligibleOrders.filter((o) => o.orderStatus === "PACKED").length;
  const dispatchedCount = packingEligibleOrders.filter((o) => o.orderStatus === "DISPATCHED").length;
  const completedCount = packingEligibleOrders.filter((o) => o.orderStatus === "COMPLETED").length;

  // Export handlers
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Date",
      "Order ID",
      "Phone Number",
      "Customer Name",
      "Items",
      "Size",
      "Qty",
      "Dispatch No",
      "Status",
    ];

    const rows = filteredOrders.map((order, index) => {
      const primaryItem = order.items[0];
      const allItems = order.items.map((it) => it.productName).join("; ");
      const allSizes = Array.from(new Set(order.items.map((it) => it.size))).join(", ");
      const totalQuantity = order.items.reduce((sum, it) => sum + it.quantity, 0);
      const statusLabel = isOrderReturn(order) ? "Return" : (STATUS_OPTIONS.find((s) => s.key === order.orderStatus)?.label || order.orderStatus);

      return [
        index + 1,
        formatDate(order.createdAt),
        order.orderNumber,
        order.customer.mobile,
        order.customer.name,
        allItems || primaryItem?.productName || "",
        allSizes,
        totalQuantity,
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
      "Phone",
      "Customer Name",
      "Items",
      "Size",
      "Qty",
      "Dispatch No",
      "Status",
    ];

    const rows = filteredOrders.map((order, index) => {
      const allSizes = Array.from(new Set(order.items.map((it) => it.size))).join(", ");
      const totalQuantity = order.items.reduce((sum, it) => sum + it.quantity, 0);
      const statusLabel = isOrderReturn(order) ? "Return" : (STATUS_OPTIONS.find((s) => s.key === order.orderStatus)?.label || order.orderStatus);

      return [
        index + 1,
        formatDate(order.createdAt),
        order.orderNumber,
        order.customer.mobile,
        order.customer.name,
        order.items[0]?.productName + (order.items.length > 1 ? ` (+${order.items.length - 1})` : ""),
        allSizes,
        totalQuantity,
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
      {/* KPI Status Filter Buttons Row (with matching border colors) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            statusFilter === "ALL"
              ? "border-orange-600 ring-2 ring-orange-500/20 bg-orange-50/10" 
              : "border-slate-300 hover:border-orange-400"
          )}
        >
          <span className="text-[11px] text-slate-500 block font-medium">All Packing Orders</span>
          <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">{packingEligibleOrders.length}</span>
        </button>

        <button
          onClick={() => setStatusFilter("CONFIRMED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            statusFilter === "CONFIRMED"
              ? "border-sky-600 ring-2 ring-sky-500/20 bg-sky-50/10" 
              : "border-sky-300 hover:border-sky-400"
          )}
        >
          <span className="text-[11px] text-sky-700 font-medium block">Processing</span>
          <span className="text-base font-bold text-sky-700 font-mono mt-0.5 block">{processingCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("PACKING")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            statusFilter === "PACKING"
              ? "border-orange-600 ring-2 ring-orange-500/20 bg-orange-50/10" 
              : "border-orange-300 hover:border-orange-400"
          )}
        >
          <span className="text-[11px] text-orange-700 font-medium block">Packaging</span>
          <span className="text-base font-bold text-orange-600 font-mono mt-0.5 block">{packagingCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("PACKED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            statusFilter === "PACKED"
              ? "border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/10" 
              : "border-purple-300 hover:border-purple-400"
          )}
        >
          <span className="text-[11px] text-purple-700 font-medium block">Packed</span>
          <span className="text-base font-bold text-purple-700 font-mono mt-0.5 block">{packedCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("DISPATCHED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            statusFilter === "DISPATCHED"
              ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/10" 
              : "border-emerald-300 hover:border-emerald-400"
          )}
        >
          <span className="text-[11px] text-emerald-700 font-medium block">Dispatched</span>
          <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">{dispatchedCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter("COMPLETED")}
          className={cn(
            "p-2 rounded-lg border text-left transition-all bg-white shadow-xs cursor-pointer",
            statusFilter === "COMPLETED"
              ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/10" 
              : "border-blue-300 hover:border-blue-400"
          )}
        >
          <span className="text-[11px] text-blue-800 font-medium block">Completed (Ready)</span>
          <span className="text-base font-bold text-blue-800 font-mono mt-0.5 block">{completedCount}</span>
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

          <span className="text-slate-500 font-medium whitespace-nowrap">
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

          {/* Export Actions (Excel & PDF) - Placed at the end */}
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            <button
              onClick={handleExportExcel}
              title="Export Excel"
              className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportPdf}
              title="Export PDF"
              className="inline-flex items-center justify-center p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      <BulkToolbar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        customAction={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === 0) return;
                const firstOrder = orders.find((o) => selectedIds.includes(o.id));
                if (firstOrder) handleOpenPendingModal(firstOrder);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs cursor-pointer active:scale-98 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Mark as Pending ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === 0) return;
                setIsMarkAsReturnOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs cursor-pointer active:scale-98 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mark as Return ({selectedIds.length})</span>
            </button>
          </div>
        }
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
          <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-300">
            <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[10.5px] uppercase tracking-tight">
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
                <th className="py-2 px-1.5 w-[8%] border-r border-b-2 border-slate-300 bg-slate-100">Date</th>
                <th className="py-2 px-1.5 w-[8%] border-r border-b-2 border-slate-300 bg-slate-100">Order ID</th>
                <th className="py-2 px-1.5 w-[9%] border-r border-b-2 border-slate-300 bg-slate-100">Phone Number</th>
                <th className="py-2 px-1.5 w-[12%] border-r border-b-2 border-slate-300 bg-slate-100">Name</th>
                <th className="py-2 px-1.5 w-[20%] border-r border-b-2 border-slate-300 bg-slate-100">Items</th>
                <th className="py-2 px-1 w-[6%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Size</th>
                <th className="py-2 px-1 w-[3.5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">Qty</th>
                <th className="py-2 px-1.5 w-[13%] border-r border-b-2 border-slate-300 bg-slate-100">Dispatch No</th>
                <th className="py-2 px-1 w-[14.5%] text-center border-b-2 border-slate-300 bg-slate-200/70 text-slate-800">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-14 text-center text-slate-400 border-b border-slate-300">
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
                  const isExpanded = expandedOrderIds.includes(order.id);
                  const hasMultipleItems = order.items.length > 1;
                  const visibleItems = isExpanded ? order.items : (order.items.length > 0 ? [order.items[0]] : []);

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
                        className="py-2 px-1 text-center bg-slate-50/70 border-r border-b border-slate-300 align-top"
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
                      <td className="py-2 px-1 text-center font-mono font-bold text-slate-600 bg-slate-50 border-r border-b border-slate-300 align-top">
                        {index + 1}
                      </td>

                      {/* 2. Date */}
                      <td className="py-2 px-1.5 whitespace-nowrap text-slate-600 border-r border-b border-slate-300 font-medium text-[11px] truncate align-top">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* 3. Order ID */}
                      <td className="py-2 px-1.5 whitespace-nowrap font-mono font-semibold text-slate-900 border-r border-b border-slate-300 text-[11px] align-top">
                        {order.orderNumber}
                      </td>

                      {/* 4. Phone Number */}
                      <td className="py-2 px-1.5 whitespace-nowrap font-mono text-slate-700 border-r border-b border-slate-300 text-[11px] truncate align-top">
                        {order.customer.mobile}
                      </td>

                      {/* 5. Name */}
                      <td className="py-2 px-1.5 border-r border-b border-slate-300 truncate align-top">
                        <span className="font-semibold text-slate-800 truncate block leading-tight" title={order.customer.name}>
                          {order.customer.name}
                        </span>
                        {order.customer.city && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {order.customer.city}
                          </span>
                        )}
                      </td>

                      {/* 6. Items (Clean Itemized Rows with Spreadsheet Border, SKU hidden) */}
                      <td className="py-2 px-2 border-r border-b border-slate-300 text-slate-700 align-top">
                        <div className="space-y-1">
                          {visibleItems.map((it, i) => (
                            <div
                              key={it.id || i}
                              className={cn(
                                "text-[11px] leading-tight",
                                i > 0 && "pt-1 border-t border-slate-200/80"
                              )}
                            >
                              <span className="font-semibold text-slate-800 block truncate" title={it.productName}>
                                {it.productName}
                              </span>
                              {it.color && it.color !== "Standard" && (
                                <span className="text-[10px] text-slate-500 font-medium block truncate">
                                  Color: {it.color}
                                </span>
                              )}
                            </div>
                          ))}
                          {hasMultipleItems && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={(e) => toggleExpandOrder(order.id, e)}
                                className={cn(
                                  "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                                  isExpanded
                                    ? "text-slate-600 bg-slate-100 border-slate-300 hover:bg-slate-200"
                                    : "text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100"
                                )}
                              >
                                {isExpanded ? "Show less ▴" : `+${order.items.length - 1} more items ▾`}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 7. Size (Itemized & Aligned with Items) */}
                      <td className="py-2 px-1 text-center border-r border-b border-slate-300 font-mono font-semibold text-[11px] text-slate-700 align-top">
                        <div className="space-y-1">
                          {visibleItems.map((it, i) => (
                            <div
                              key={it.id || i}
                              className={cn(
                                "leading-tight truncate",
                                i > 0 && "pt-1 border-t border-slate-200/80"
                              )}
                            >
                              {it.size || "-"}
                            </div>
                          ))}
                          {hasMultipleItems && (
                            <div className="pt-1">
                              <div className="h-[21px] opacity-0 select-none pointer-events-none text-[10px]">-</div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 8. Qty (Itemized & Aligned with Items) */}
                      <td className="py-2 px-1 text-center font-mono font-bold text-slate-800 border-r border-b border-slate-300 align-top">
                        <div className="space-y-1">
                          {visibleItems.map((it, i) => (
                            <div
                              key={it.id || i}
                              className={cn(
                                "leading-tight",
                                i > 0 && "pt-1 border-t border-slate-200/80"
                              )}
                            >
                              {it.quantity}
                            </div>
                          ))}
                          {hasMultipleItems && (
                            <div className="pt-1">
                              <div className="h-[21px] opacity-0 select-none pointer-events-none text-[10px]">-</div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 11. Dispatch No (Manually Editable) */}
                      <td className="py-1 px-1.5 whitespace-nowrap border-r border-b border-slate-300 align-top">
                        <InlineDispatchInput
                          orderId={order.id}
                          orderNumber={order.orderNumber}
                          initialValue={order.dispatch.dispatchId || ""}
                          onSave={handleDispatchNoChange}
                        />
                      </td>

                      {/* 12. Order Status & Action */}
                      <td className="py-1 px-1.5 text-center whitespace-normal border-b border-slate-300 bg-slate-50/40 align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center">
                          {(() => {
                            const linkedRtn = returns.find((r) => (r.orderId === order.id || r.orderNumber === order.orderNumber) && r.status !== "Rejected" && r.status !== "Cancelled");
                            const isReturn = order.orderStatus === "RETURN" || Boolean(linkedRtn);
                            const returnId = linkedRtn?.returnId || order.linkedReturnId;

                            if (isReturn) {
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs select-none"
                                  >
                                    <RotateCcw className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Return</span>
                                  </span>
                                  {returnId && (
                                    <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200">
                                      {returnId}
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            if (order.orderStatus === "CONFIRMED") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                  Processing
                                </span>
                              );
                            }

                            if (order.orderStatus === "COMPLETED") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-300 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                  Completed (Ready)
                                </span>
                              );
                            }

                            if (order.orderStatus === "DISPATCHED") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Dispatched
                                </span>
                              );
                            }

                            if (order.orderStatus === "PACKING" || order.orderStatus === "PACKED") {
                              return (
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shadow-2xs",
                                  order.orderStatus === "PACKED"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-orange-50 text-orange-700 border-orange-200"
                                )}>
                                  {order.orderStatus === "PACKED" ? "Packed" : "Packaging"}
                                </span>
                              );
                            }

                            if (order.orderStatus === "NEW") {
                              return (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                                  title={order.pendingReason ? `Pending: ${order.pendingReason}` : undefined}
                                >
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Pending</span>
                                </span>
                              );
                            }

                            return null;
                          })()}
                        </div>
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

      {/* Create Return Modal (Packing -> Return -> Create Return) */}
      {returnModalOrder && (
        <CreateReturnModal
          isOpen={Boolean(returnModalOrder)}
          onClose={() => setReturnModalOrder(null)}
          preselectedOrderId={returnModalOrder.id}
          onSuccess={(returnId) => {
            updateOrderStatus(returnModalOrder.id, "RETURN", `Return case ${returnId} initiated from Packing Station`);
            triggerToast(`Return case ${returnId} created for Order ${returnModalOrder.orderNumber}`);
            setReturnModalOrder(null);
          }}
        />
      )}

      {/* Mark As Return Modal (From Selection Toolbar) */}
      <MarkAsReturnModal
        isOpen={isMarkAsReturnOpen}
        onClose={() => setIsMarkAsReturnOpen(false)}
        selectedOrders={orders.filter((o) => selectedIds.includes(o.id))}
        onSuccess={handleReturnSuccess}
      />

      {/* Pending Reason & Note Modal */}
      {pendingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div 
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-amber-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {pendingModalOrder.orderStatus === "NEW"
                    ? `Pending Details — Order ${pendingModalOrder.orderNumber}`
                    : selectedIds.length > 1 && selectedIds.includes(pendingModalOrder.id)
                    ? `Mark ${selectedIds.length} Orders as Pending`
                    : `Mark Order ${pendingModalOrder.orderNumber} as Pending`}
                </h3>
              </div>
              <button
                onClick={() => setPendingModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pending Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pendingReason}
                  onChange={(e) => setPendingReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                >
                  <option value="Product unavailable">Product unavailable</option>
                  <option value="Stock mismatch">Stock mismatch</option>
                  <option value="Customer confirmation pending">Customer confirmation pending</option>
                  <option value="Address issue">Address issue</option>
                  <option value="System issue">System issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {pendingReason === "Other" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Custom Reason <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pendingCustomReason}
                    onChange={(e) => setPendingCustomReason(e.target.value)}
                    placeholder="Enter custom pending reason..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pending Note {pendingReason === "Other" ? <span className="text-rose-500 font-bold">* (Mandatory)</span> : <span className="text-slate-400 font-normal">(Optional context)</span>}
                </label>
                <textarea
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  rows={3}
                  placeholder={pendingReason === "Other" ? "Explain reason for delay (mandatory)..." : "e.g. Waiting for customer confirmation / ETA tomorrow..."}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              {pendingModalOrder.orderStatus === "NEW" ? (
                <button
                  type="button"
                  onClick={() => {
                    resolveOrderPending(pendingModalOrder.id);
                    triggerToast(`Order ${pendingModalOrder.orderNumber} resolved and resumed!`);
                    setPendingModalOrder(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Resolve pending status and resume order back to active workflow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Resume Order</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingModalOrder(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSavePending}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  {pendingModalOrder.orderStatus === "NEW" ? "Update Details" : "Save as Pending"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

