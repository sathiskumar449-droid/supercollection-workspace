"use client";

import React, { useState, useMemo } from "react";
import { Order, CourierStatus, Role, ReturnCase } from "@/types/orderflow";
import { 
  X, 
  Phone, 
  ChevronRight, 
  Save, 
  Truck,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  RotateCcw,
  Eye
} from "lucide-react";
import { OrderStatusBadge, SmsStatusBadge } from "@/components/ui/status-badge";
import { formatINR, cn, formatTimelineDateTime } from "@/lib/utils";
import { useOrderFlow } from "@/lib/hooks";
import { normalizeOrderTimeline } from "@/lib/store";
import { ReturnStatusBadge } from "@/components/returns/return-status-badge";
import { ReturnDetailsDrawer } from "@/components/returns/return-details-drawer";

interface OrderDetailsDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (orderId: string, status: any, reason?: string) => void;
  onUpdateCourier: (
    orderId: string,
    params: { 
      llrNumber?: string; 
      pickupPhone?: string; 
      courierStatus?: CourierStatus;
      courierPartnerId?: string;
      courierName?: string;
    }
  ) => void;
  userRole?: Role;
  courierPartnerId?: string;
}

/**
 * Format timestamp into clean owner-friendly format, e.g. "22 Sept, 1:26 PM"
 */
function formatDateTime(dateString?: string): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    const day = d.getDate();
    const month = d.toLocaleString("en-IN", { month: "short" });
    const time = d.toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${day} ${month}, ${time}`;
  } catch {
    return dateString;
  }
}

/**
 * Format display label for courier status
 */
function getCourierStatusLabel(status?: string): string {
  if (!status) return "Waiting for Pickup";
  if (status === "WAITING_FOR_PICKUP" || status === "PENDING") return "Waiting for Pickup";
  if (status === "PICKED_UP" || status === "SHIPPED") return "Picked Up";
  if (status === "DELIVERED") return "Delivered";
  return status;
}

function getCourierStatusColor(status?: string): string {
  if (status === "DELIVERED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "PICKED_UP" || status === "SHIPPED") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function OrderDetailsDrawer({
  order,
  isOpen,
  onClose,
  onUpdateCourier,
  userRole = "ADMIN",
  courierPartnerId,
}: OrderDetailsDrawerProps) {
  const [llrInput, setLlrInput] = useState("");
  const [pickupPhoneInput, setPickupPhoneInput] = useState("");
  const [courierPartnerInput, setCourierPartnerInput] = useState("");
  const [courierNameInput, setCourierNameInput] = useState("");
  const [courierStatusInput, setCourierStatusInput] = useState<CourierStatus>("WAITING_FOR_PICKUP");
  const [isEditingCourier, setIsEditingCourier] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Return Management Integration (VIEW ONLY for return history)
  const { getReturnsByOrderId, returns } = useOrderFlow();
  const [selectedReturnCase, setSelectedReturnCase] = useState<ReturnCase | null>(null);

  const orderReturns = useMemo(() => {
    if (!order) return [];
    return getReturnsByOrderId(order.id);
  }, [order, getReturnsByOrderId, returns]);

  // Sync inputs when order opens
  React.useEffect(() => {
    if (order) {
      setLlrInput(order.dispatch.llrNumber || "");
      setPickupPhoneInput(order.dispatch.pickupPhone || "");
      setCourierPartnerInput(order.dispatch.courierPartnerId || "");
      setCourierNameInput(order.dispatch.courierName || "");
      
      const currentCStatus = order.dispatch.courierStatus;
      if (currentCStatus === "SHIPPED" || currentCStatus === "PICKED_UP") {
        setCourierStatusInput("PICKED_UP");
      } else if (currentCStatus === "DELIVERED") {
        setCourierStatusInput("DELIVERED");
      } else {
        setCourierStatusInput("WAITING_FOR_PICKUP");
      }

      setIsEditingCourier(false);
      setSaveSuccessNotice(false);
      setShowTechDetails(false);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  // Strict backend / UI data isolation:
  // If a courier partner attempts to inspect an order belonging to another courier partner
  const isCourierUser = userRole === "COURIER";
  const isUnauthorizedCourier = 
    isCourierUser && 
    courierPartnerId && 
    order.dispatch?.courierPartnerId && 
    order.dispatch.courierPartnerId !== courierPartnerId;

  if (isUnauthorizedCourier) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose} />
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col items-center justify-center p-8 text-center animate-in slide-in-from-right duration-200">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">403 - Order Not Available</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            You do not have permission to view or manage this shipment. It is assigned to a different courier partner.
          </p>
          <button
            onClick={onClose}
            className="mt-5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Back to Courier Hub
          </button>
        </aside>
      </>
    );
  }

  const handleSaveCourierDetails = () => {
    onUpdateCourier(order.id, {
      llrNumber: llrInput.trim() || undefined,
      pickupPhone: pickupPhoneInput.trim() || undefined,
      courierStatus: courierStatusInput,
      courierPartnerId: courierPartnerInput || undefined,
      courierName: courierNameInput || undefined,
    });
    setIsEditingCourier(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const canEditCourier = ["ADMIN", "MANAGER", "DISPATCH_STAFF", "COURIER"].includes(userRole);
  const displayOrderNum = order.externalOrderId || order.orderNumber.replace(/^(SC-WC-|OF-)/, "");

  // Build strictly deduplicated chronological order history with all unified stages populated
  const chronologicalHistory = (() => {
    const normalized = normalizeOrderTimeline(order);
    if (!normalized || !Array.isArray(normalized)) return [];

    const seen = new Set<string>();
    const sorted = [...normalized].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const filtered: typeof sorted = [];
    for (const entry of sorted) {
      const key = `${(entry.action || "").toLowerCase()}__${(entry.details || "").toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(entry);
      }
    }
    return filtered;
  })();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-150" 
        onClick={onClose} 
      />

      {/* Side Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* 1. ORDER HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                Order #{displayOrderNum}
              </h2>
              {order.dispatch.dispatchId && (
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                  {order.dispatch.dispatchId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {order.source === "WEBSITE" ? "Website" : "WhatsApp"} · {formatDateTime(order.createdAt)} · <span className="font-semibold text-slate-900">{formatINR(order.totalAmount)}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.orderStatus} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* 2. CUSTOMER DETAILS */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customer Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Customer Name</span>
                <span className="font-semibold text-slate-900 text-sm block">
                  {order.customer.name}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono font-medium">{order.customer.mobile}</span>
                  <span className="text-[10px] text-slate-400">(Customer Phone)</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Delivery Address</span>
                <p className="text-slate-700 leading-relaxed">
                  {order.customer.address}, {order.customer.city}, {order.customer.state} - <span className="font-mono font-medium">{order.customer.pincode}</span>
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 rounded text-slate-700 border border-slate-200 text-[11px] font-medium">
                    Payment Status: <strong className="ml-1 text-slate-900">{order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus === "COD" ? "Cash on Delivery (COD)" : "Pending"}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. ITEMS */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Items ({order.items.length})
              </h3>
              <span className="text-xs font-semibold text-slate-900">
                Total: {formatINR(order.totalAmount)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between text-xs bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300">
                      {item.size}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900 block">{item.productName}</span>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                        <span>Size: <strong className="text-slate-700">{item.size}</strong></span>
                        {item.color && (
                          <>
                            <span>•</span>
                            <span>Color: <strong className="text-slate-700">{item.color}</strong></span>
                          </>
                        )}
                        <span>•</span>
                        <span>Quantity: <strong className="text-slate-700">{item.quantity}</strong></span>
                        <span>•</span>
                        <span>Price: <strong className="text-slate-700">{formatINR(item.unitPrice)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block">{formatINR(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. COURIER SECTION (Requirement 21) */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Courier & Delivery
                </h3>
              </div>
              {saveSuccessNotice && (
                <span className="text-xs text-emerald-600 font-semibold animate-in fade-in">
                  ✓ Saved successfully!
                </span>
              )}
            </div>

            <div className="p-4 bg-slate-50/80 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Courier Partner */}
                <div>
                  <span className="text-slate-400 block mb-1">Courier Partner</span>
                  {isEditingCourier ? (
                    <select
                      value={courierPartnerInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCourierPartnerInput(val);
                        if (val === "PROFESSIONAL") setCourierNameInput("Professional Courier");
                        else if (val === "DTDC") setCourierNameInput("DTDC");
                        else if (val === "ST_COURIER") setCourierNameInput("ST Courier");
                        else setCourierNameInput("");
                      }}
                      className="w-full text-xs font-semibold px-2 py-1 bg-white border border-slate-300 rounded outline-none focus:border-orange-500 text-slate-800"
                    >
                      <option value="">Unassigned (-)</option>
                      <option value="ST_COURIER">ST Courier</option>
                      <option value="PROFESSIONAL">Professional Courier</option>
                      <option value="DTDC">DTDC</option>
                    </select>
                  ) : (
                    <span className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      {order.dispatch.courierName ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          {order.dispatch.courierName}
                        </>
                      ) : (
                        <span className="text-slate-400 font-normal italic">Unassigned (-)</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Dispatch ID */}
                <div>
                  <span className="text-slate-400 block mb-1">Dispatch ID</span>
                  <span className="font-mono font-bold text-slate-900 text-xs px-2 py-0.5 bg-white border border-slate-200 rounded inline-block">
                    {order.dispatch.dispatchId || "Pending Dispatch"}
                  </span>
                </div>

                {/* Courier Status */}
                <div>
                  <span className="text-slate-400 block mb-1">Courier Status</span>
                  {isEditingCourier ? (
                    <select
                      value={courierStatusInput}
                      onChange={(e) => setCourierStatusInput(e.target.value as CourierStatus)}
                      className="w-full text-xs font-semibold px-2 py-1 bg-white border border-slate-300 rounded outline-none focus:border-orange-500 text-slate-800"
                    >
                      <option value="WAITING_FOR_PICKUP">Waiting for Pickup</option>
                      <option value="PICKED_UP">Picked Up</option>
                      <option value="DELIVERED">Delivered</option>
                    </select>
                  ) : (
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border",
                      getCourierStatusColor(order.dispatch.courierStatus)
                    )}>
                      {getCourierStatusLabel(order.dispatch.courierStatus)}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                {/* Pickup Phone (Strictly separate from Customer Phone) */}
                <div>
                  <span className="text-slate-400 block mb-1">
                    Pickup Phone <span className="text-[10px] text-orange-600 font-normal">(Courier Person)</span>
                  </span>
                  {isEditingCourier ? (
                    <input
                      type="text"
                      value={pickupPhoneInput}
                      onChange={(e) => setPickupPhoneInput(e.target.value)}
                      placeholder="Enter pickup phone"
                      className="w-full text-xs font-mono px-2 py-1 bg-white border border-slate-300 rounded outline-none focus:border-orange-500 text-slate-800"
                    />
                  ) : (
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {order.dispatch.pickupPhone || (
                        <span className="text-slate-400 font-normal italic">Enter on pickup</span>
                      )}
                    </span>
                  )}
                </div>

                {/* LLR / Tracking Number */}
                <div>
                  <span className="text-slate-400 block mb-1">LLR / Tracking Number</span>
                  {isEditingCourier ? (
                    <input
                      type="text"
                      value={llrInput}
                      onChange={(e) => setLlrInput(e.target.value)}
                      placeholder="Enter LLR Number"
                      className="w-full text-xs font-mono px-2 py-1 bg-white border border-slate-300 rounded outline-none focus:border-orange-500 text-slate-800"
                    />
                  ) : (
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {order.dispatch.llrNumber || (
                        <span className="text-amber-600 font-normal">Missing LLR</span>
                      )}
                    </span>
                  )}
                </div>

                {/* SMS Status */}
                <div>
                  <span className="text-slate-400 block mb-1">SMS Notification</span>
                  <SmsStatusBadge status={order.sms.status} />
                </div>
              </div>

              {/* Edit Controls */}
              {canEditCourier && (
                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-end gap-2">
                  {isEditingCourier ? (
                    <>
                      <button
                        onClick={() => {
                          setLlrInput(order.dispatch.llrNumber || "");
                          setPickupPhoneInput(order.dispatch.pickupPhone || "");
                          setIsEditingCourier(false);
                        }}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveCourierDetails}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save Details</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingCourier(true)}
                      className="px-3 py-1 text-xs text-orange-700 hover:bg-orange-100/60 border border-orange-200 rounded font-semibold transition-colors cursor-pointer"
                    >
                      Edit Courier & Pickup Info
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 5. RETURN & REPLACEMENT HISTORY */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Return & Replacement History
                </h3>
                {orderReturns.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    {orderReturns.length} {orderReturns.length === 1 ? "case" : "cases"}
                  </span>
                )}
              </div>
            </div>

            {orderReturns.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                <p>No return or replacement cases for this order.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Returns can be initiated from the Packing station when updating order status.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                {orderReturns.map((rc) => {
                  const totalItemsReturning = rc.items.reduce((s, it) => s + it.requestedQuantity, 0);
                  return (
                    <div key={rc.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{rc.returnId}</span>
                          <span className={cn(
                            "px-1.5 py-0.2 rounded text-[10px] font-bold border",
                            rc.returnType === "Replacement"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            {rc.returnType}
                          </span>
                          <ReturnStatusBadge status={rc.status} className="text-[10px] px-1.5 py-0.5" />
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>Reason: <strong className="text-slate-700">{rc.reason}</strong></span>
                          <span>•</span>
                          <span>Qty: <strong className="text-slate-700">{totalItemsReturning} pcs</strong></span>
                          {rc.returnType === "Refund" && rc.refund && (
                            <>
                              <span>•</span>
                              <span>Refund: <strong className="text-slate-700">{formatINR(rc.refund.refundAmount)}</strong> ({rc.refund.refundStatus})</span>
                            </>
                          )}
                          {rc.returnType === "Replacement" && rc.replacement && (
                            <>
                              <span>•</span>
                              <span>Task: <strong className="text-indigo-700 font-mono">{rc.replacement.replacementId}</strong> ({rc.replacement.status})</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedReturnCase(rc)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded shadow-2xs inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>View</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. MASTER ORDER TIMELINE (Section 18, 20, 27) */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Master Order Timeline
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                {chronologicalHistory.length} chronological events
              </span>
            </div>

            {chronologicalHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No order history recorded.</p>
            ) : (
              <div className="relative pl-6 space-y-5 ml-1 mt-3">
                {chronologicalHistory.map((item, idx) => {
                  const isLast = idx === chronologicalHistory.length - 1;
                  const isWaitingEvent = item.action?.toLowerCase().includes("waiting");
                  const isCurrentWaiting = isWaitingEvent && isLast;

                  return (
                    <div key={item.id || idx} className="relative group">
                      {/* Vertical line connecting events */}
                      {!isLast && (
                        <div className="absolute -left-[17px] top-4 w-0.5 h-[calc(100%+16px)] bg-slate-200" />
                      )}

                      {/* Status Dot */}
                      <div className={cn(
                        "absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full flex items-center justify-center ring-4 shadow-2xs",
                        isCurrentWaiting 
                          ? "bg-amber-500 text-white ring-amber-100 animate-pulse" 
                          : "bg-emerald-600 text-white ring-emerald-50"
                      )}>
                        <span className="text-[8px]">{isCurrentWaiting ? "⏳" : "✓"}</span>
                      </div>

                      {/* Content Block */}
                      <div className="text-xs">
                        {/* Timestamp: exact unified format "24 Sep 08:44 AM" */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-500 font-semibold">
                            {formatTimelineDateTime(item.timestamp)}
                          </span>
                        </div>

                        {/* Title */}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn(
                            "font-bold text-xs",
                            isCurrentWaiting ? "text-amber-800" : "text-slate-900"
                          )}>
                            {item.action}
                          </span>
                          {isCurrentWaiting && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                              Active Stage
                            </span>
                          )}
                        </div>

                        {/* Dispatch number change transparency (Rule 20) */}
                        {item.oldDispatchNo && item.newDispatchNo && (
                          <div className="mt-1 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
                            <div>Old Dispatch No: <code className="font-mono font-bold">{item.oldDispatchNo}</code></div>
                            <div>New Dispatch No: <code className="font-mono font-bold">{item.newDispatchNo}</code></div>
                            {item.reason && <div>Reason: <span className="font-medium">{item.reason}</span></div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Order ID: <code className="font-mono font-semibold text-slate-700">{order.orderNumber}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </aside>

      {/* Return Details Slide-Over Drawer (View Only) */}
      <ReturnDetailsDrawer
        returnCase={selectedReturnCase}
        isOpen={Boolean(selectedReturnCase)}
        onClose={() => setSelectedReturnCase(null)}
      />
    </>
  );
}
