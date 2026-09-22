"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { 
  Truck, 
  AlertTriangle, 
  Search, 
  Check, 
  CheckCheck,
  Package,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { Order, CourierStatus } from "@/types/orderflow";
import { SourceBadge } from "@/components/ui/status-badge";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatDate, cn } from "@/lib/utils";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

// Inline LLR editor component for quick manual entry and auto-save
function InlineCourierLlrInput({
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
        title={val ? `LLR No: ${val} (Press Enter or click away to save)` : "Enter LLR / Dispatch Number manually"}
      />
      {savedSuccess && (
        <Check className="w-3.5 h-3.5 text-emerald-600 absolute right-2 pointer-events-none" />
      )}
    </div>
  );
}

function StCourierContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "all";

  const { orders, user, updateCourierDetails, updateOrderStatus } = useOrderFlow();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ONLY orders that have been marked as "DISPATCHED" in Packing Station (or already SHIPPED by courier)
  const courierOrders = useMemo(() => {
    return orders.filter((o) => 
      o.orderStatus === "DISPATCHED" || 
      o.dispatch.courierStatus === "SHIPPED" || 
      (o.dispatch.courierStatus as string) === "DELIVERED" ||
      Boolean(o.dispatchedAt) ||
      Boolean(o.dispatch.dispatchedAt)
    );
  }, [orders]);

  // Metric counts across dispatched orders
  const totalOrders = courierOrders.length;
  const llrMissingCount = courierOrders.filter((o) => !o.dispatch.llrNumber || !o.dispatch.llrNumber.trim()).length;
  const llrAddedCount = totalOrders - llrMissingCount;
  const shippedCourierCount = courierOrders.filter((o) => o.dispatch.courierStatus === "SHIPPED" || (o.dispatch.courierStatus as string) === "DELIVERED").length;
  const pendingCourierStatusCount = totalOrders - shippedCourierCount;

  // Filter by active tab and search
  const displayedOrders = useMemo(() => {
    return courierOrders.filter((o) => {
      // Tab filter
      if (activeTab === "missing-llr") {
        if (o.dispatch.llrNumber && o.dispatch.llrNumber.trim()) return false;
      } else if (activeTab === "pending-status") {
        if (o.dispatch.courierStatus === "SHIPPED" || (o.dispatch.courierStatus as string) === "DELIVERED") return false;
      } else if (activeTab === "shipped" || activeTab === "delivered") {
        if (o.dispatch.courierStatus !== "SHIPPED" && (o.dispatch.courierStatus as string) !== "DELIVERED") return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.mobile.toLowerCase().includes(q) ||
          (o.dispatch.llrNumber && o.dispatch.llrNumber.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [courierOrders, activeTab, searchQuery]);

  // Handler for saving LLR number
  const handleLlrSave = (orderId: string, orderNumber: string, newLlr: string) => {
    updateCourierDetails(orderId, {
      llrNumber: newLlr || undefined,
    });
    triggerToast(
      newLlr 
        ? `Order ${orderNumber} LLR number saved: ${newLlr}` 
        : `Order ${orderNumber} LLR cleared`
    );
  };

  // Handler for updating courier status (ONLY Pending & Shipped)
  const handleCourierStatusChange = (order: Order, newStatus: CourierStatus) => {
    const isShipped = newStatus === "SHIPPED" || (newStatus as string) === "DELIVERED";
    const currentIsShipped = order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DELIVERED";
    if (isShipped === currentIsShipped) return;

    const targetStatus: CourierStatus = isShipped ? "SHIPPED" : "PENDING";

    updateCourierDetails(order.id, {
      courierStatus: targetStatus,
    });

    const label = isShipped ? "Shipped" : "Pending";
    triggerToast(`Order ${order.orderNumber} status updated to ${label}`);
  };

  // Export handlers for Excel and PDF
  const handleExportExcel = () => {
    const headers = [
      "S.No",
      "Date",
      "Order ID",
      "Customer Name",
      "City",
      "Phone Number",
      "LLR Number",
      "Status",
    ];

    const rows = displayedOrders.map((order, index) => {
      const statusLabel = order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DELIVERED" ? "Shipped" : "Pending";

      return [
        index + 1,
        formatDate(order.createdAt),
        order.orderNumber,
        order.customer.name,
        order.customer.city || "",
        order.customer.mobile,
        order.dispatch.llrNumber || "",
        statusLabel,
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToExcel(`Courier_Hub_Orders_${dateStr}`, headers, rows);
    triggerToast(`Exported ${rows.length} courier orders to Excel successfully`);
  };

  const handleExportPdf = () => {
    const headers = [
      "S.No",
      "Date",
      "Order ID",
      "Customer Name",
      "City",
      "Phone Number",
      "LLR Number",
      "Status",
    ];

    const rows = displayedOrders.map((order, index) => {
      const statusLabel = order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DELIVERED" ? "Shipped" : "Pending";

      return [
        index + 1,
        formatDate(order.createdAt),
        order.orderNumber,
        order.customer.name,
        order.customer.city || "-",
        order.customer.mobile,
        order.dispatch.llrNumber || "-",
        statusLabel,
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToPdf({
      title: "ST Courier Hub - Dispatch & Delivery Report",
      subtitle: `Filter Tab: ${activeTab.toUpperCase()} | Total Orders: ${displayedOrders.length}`,
      filename: `Courier_Hub_Report_${dateStr}`,
      headers,
      rows,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-4 max-w-full mx-auto">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Total Orders */}
        <div
          onClick={() => setActiveTab("all")}
          className={cn(
            "p-3 rounded-xl border cursor-pointer transition-all bg-white shadow-xs",
            activeTab === "all" ? "border-orange-600 ring-2 ring-orange-500/20" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] font-medium text-slate-500 block">Total Orders</span>
          <span suppressHydrationWarning className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">
            {totalOrders}
          </span>
        </div>

        {/* LLR Missing */}
        <div
          onClick={() => setActiveTab("missing-llr")}
          className={cn(
            "p-3 rounded-xl border cursor-pointer transition-all bg-white shadow-xs",
            activeTab === "missing-llr" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 hover:border-amber-300"
          )}
        >
          <div className="flex items-center justify-between text-amber-700 text-[11px] font-medium">
            <span>Missing LLR</span>
            <AlertTriangle className="w-3 h-3" />
          </div>
          <span suppressHydrationWarning className="text-xl font-bold text-amber-600 font-mono mt-0.5 block">
            {llrMissingCount}
          </span>
        </div>

        {/* LLR Assigned */}
        <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">LLR Assigned</span>
          <span suppressHydrationWarning className="text-xl font-bold text-orange-700 font-mono mt-0.5 block">
            {llrAddedCount}
          </span>
        </div>

        {/* Pending Status */}
        <div
          onClick={() => setActiveTab("pending-status")}
          className={cn(
            "p-3 rounded-xl border cursor-pointer transition-all bg-white shadow-xs",
            activeTab === "pending-status" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] font-medium text-amber-700 block">Pending</span>
          <span suppressHydrationWarning className="text-xl font-bold text-amber-600 font-mono mt-0.5 block">
            {pendingCourierStatusCount}
          </span>
        </div>

        {/* Shipped */}
        <div
          onClick={() => setActiveTab("shipped")}
          className={cn(
            "p-3 rounded-xl border cursor-pointer transition-all bg-white shadow-xs",
            activeTab === "shipped" || activeTab === "delivered" ? "border-emerald-600 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span className="text-[11px] font-medium text-emerald-700 block">Shipped</span>
          <span suppressHydrationWarning className="text-xl font-bold text-emerald-600 font-mono mt-0.5 block">
            {shippedCourierCount}
          </span>
        </div>
      </div>

      {/* Main Operations Table Box */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden w-full">
        {/* Controls Toolbar */}
        <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Tab Navigation (Only Pending and Shipped) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs w-full md:w-auto overflow-x-auto">
            {[
              { key: "all", label: `All Orders (${totalOrders})` },
              { key: "pending-status", label: `Pending (${pendingCourierStatusCount})` },
              { key: "shipped", label: `Shipped (${shippedCourierCount})` },
              { key: "missing-llr", label: `Missing LLR (${llrMissingCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                suppressHydrationWarning
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium transition-all text-xs whitespace-nowrap",
                  activeTab === tab.key
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Toast Feedback & Export Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end w-full md:w-auto">
            {toastMessage && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold animate-in fade-in">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                title="Download filtered courier orders as Excel Spreadsheet (.csv)"
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

            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order #, Name, Mobile, LLR..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-orange-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Courier Hub Excel Table (Exact Columns: S.No | Date | Order ID | Name | Phone Number | LLR Number | Status) */}
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left text-xs border-collapse border border-slate-300">
            <thead className="bg-slate-100 text-slate-700 select-none whitespace-nowrap font-bold text-[11px] uppercase tracking-tight">
              <tr>
                <th className="py-2.5 px-2 w-[5%] text-center border-r border-b-2 border-slate-300 bg-slate-100">S.No</th>
                <th className="py-2.5 px-3 w-[12%] border-r border-b-2 border-slate-300 bg-slate-100">Date</th>
                <th className="py-2.5 px-3 w-[14%] border-r border-b-2 border-slate-300 bg-slate-100">Order ID</th>
                <th className="py-2.5 px-3 w-[22%] border-r border-b-2 border-slate-300 bg-slate-100">Name</th>
                <th className="py-2.5 px-3 w-[15%] border-r border-b-2 border-slate-300 bg-slate-100">Phone Number</th>
                <th className="py-2.5 px-3 w-[16%] border-r border-b-2 border-slate-300 bg-slate-100">LLR Number</th>
                <th className="py-2.5 px-2 w-[16%] text-center border-b-2 border-slate-300 bg-slate-200/70 text-slate-800">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 border-b border-slate-300">
                    <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No Dispatched Orders for Courier</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {courierOrders.length === 0
                        ? "Orders will appear here automatically once you update their status to 'Dispatched' in the Packing Station."
                        : "Try checking other filter tabs or clearing search terms."}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order, index) => {
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setInspectOrder(order)}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer group"
                    >
                      {/* 1. S.No (Spreadsheet row index) */}
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-600 bg-slate-50 border-r border-b border-slate-300">
                        {index + 1}
                      </td>

                      {/* 2. Date */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-600 border-r border-b border-slate-300 text-xs truncate">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* 3. Order ID */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono font-semibold text-slate-900 border-r border-b border-slate-300 text-xs">
                        {order.orderNumber}
                      </td>

                      {/* 4. Name */}
                      <td className="py-2 px-3 border-r border-b border-slate-300 truncate">
                        <span className="font-semibold text-slate-800 truncate block text-xs" title={order.customer.name}>
                          {order.customer.name}
                        </span>
                        {order.customer.city && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {order.customer.city}
                          </span>
                        )}
                      </td>

                      {/* 5. Phone Number */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-700 border-r border-b border-slate-300 text-xs truncate">
                        {order.customer.mobile}
                      </td>

                      {/* 6. LLR Number (Directly enterable manually) */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap border-r border-b border-slate-300">
                        <InlineCourierLlrInput
                          orderId={order.id}
                          orderNumber={order.orderNumber}
                          initialValue={order.dispatch.llrNumber}
                          onSave={handleLlrSave}
                        />
                      </td>

                      {/* 7. Status (Only Pending and Shipped) */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap border-b border-slate-300" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DELIVERED" ? "SHIPPED" : "PENDING"}
                          onChange={(e) => handleCourierStatusChange(order, e.target.value as CourierStatus)}
                          className={cn(
                            "w-full text-xs font-semibold py-1 px-2 rounded-md border border-slate-200 bg-white shadow-2xs outline-none cursor-pointer transition-all",
                            (order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DELIVERED")
                              ? "text-emerald-600 focus:border-emerald-500"
                              : "text-amber-600 focus:border-amber-500"
                          )}
                        >
                          <option value="PENDING" className="text-amber-600 font-semibold">Pending</option>
                          <option value="SHIPPED" className="text-emerald-600 font-semibold">Shipped</option>
                        </select>
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
      />
    </div>
  );
}

export default function StCourierPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <StCourierContent />
    </Suspense>
  );
}

