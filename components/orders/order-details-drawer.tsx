"use client";

import React, { useState, useMemo } from "react";
import { Order, CourierStatus, Role } from "@/types/orderflow";
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
  Send
} from "lucide-react";
import { OrderStatusBadge, SmsStatusBadge } from "@/components/ui/status-badge";
import { formatINR, cn } from "@/lib/utils";

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
  const [courierStatusInput, setCourierStatusInput] = useState<CourierStatus>("WAITING_FOR_PICKUP");
  const [isEditingCourier, setIsEditingCourier] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Sync inputs when order opens
  React.useEffect(() => {
    if (order) {
      setLlrInput(order.dispatch.llrNumber || "");
      setPickupPhoneInput(order.dispatch.pickupPhone || "");
      
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
    });
    setIsEditingCourier(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const canEditCourier = ["ADMIN", "MANAGER", "DISPATCH_STAFF", "COURIER"].includes(userRole);
  const displayOrderNum = order.externalOrderId || order.orderNumber.replace(/^(SC-WC-|OF-)/, "");

  // Build strictly deduplicated chronological order history
  const chronologicalHistory = (() => {
    if (!order.timeline || !Array.isArray(order.timeline)) return [];

    const seen = new Set<string>();
    const sorted = [...order.timeline].sort(
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
                  <span className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    {order.dispatch.courierName || "ST Courier"}
                  </span>
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

          {/* 5. SIMPLE CHRONOLOGICAL ORDER HISTORY (Flipkart / Amazon Style) */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Order History
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

                  return (
                    <div key={item.id || idx} className="relative group">
                      {/* Vertical line connecting events */}
                      {!isLast && (
                        <div className="absolute -left-[17px] top-4 w-0.5 h-[calc(100%+12px)] bg-slate-200" />
                      )}

                      {/* Status Dot */}
                      <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-emerald-50 shadow-2xs">
                        <span className="text-[8px]">✓</span>
                      </div>

                      {/* Content Block */}
                      <div className="text-xs">
                        {/* Timestamp */}
                        <span className="text-[11px] font-mono text-slate-400 block font-medium">
                          {formatDateTime(item.timestamp)}
                        </span>

                        {/* Title */}
                        <div className="font-semibold text-slate-900 text-xs mt-0.5">
                          {item.action}
                        </div>

                        {/* Details */}
                        {item.details && (
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                            {item.details}
                          </p>
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
    </>
  );
}
