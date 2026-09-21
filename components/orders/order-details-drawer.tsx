"use client";

import React, { useState } from "react";
import { Order, OrderStatus, CourierStatus, Role } from "@/types/orderflow";
import { 
  X, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Package, 
  Box, 
  MapPin, 
  Phone, 
  Mail, 
  Tag, 
  AlertCircle, 
  ChevronRight, 
  FileText, 
  User, 
  Save, 
  RotateCcw,
  ExternalLink
} from "lucide-react";
import { OrderStatusBadge, CourierStatusBadge, SmsStatusBadge, SourceBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { STATUS_FLOW_ORDER, isBackwardTransition } from "@/lib/store";

interface OrderDetailsDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, reason?: string) => void;
  onUpdateCourier: (
    orderId: string,
    params: { llrNumber?: string; courierStatus?: CourierStatus }
  ) => void;
  userRole?: Role;
}

export function OrderDetailsDrawer({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onUpdateCourier,
  userRole = "ADMIN",
}: OrderDetailsDrawerProps) {
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [showBackwardConfirm, setShowBackwardConfirm] = useState(false);
  const [llrInput, setLlrInput] = useState("");
  const [courierStatusInput, setCourierStatusInput] = useState<CourierStatus>("PENDING");
  const [isEditingCourier, setIsEditingCourier] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Sync inputs when order opens
  React.useEffect(() => {
    if (order) {
      setLlrInput(order.dispatch.llrNumber || "");
      setCourierStatusInput(order.dispatch.courierStatus);
      setIsEditingCourier(false);
      setSaveSuccessNotice(false);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleStatusChangeRequest = (newStatus: OrderStatus) => {
    if (newStatus === order.orderStatus) return;

    if (isBackwardTransition(order.orderStatus, newStatus)) {
      setPendingStatus(newStatus);
      setShowBackwardConfirm(true);
    } else {
      onUpdateStatus(order.id, newStatus);
    }
  };

  const confirmBackwardTransition = () => {
    if (pendingStatus) {
      onUpdateStatus(
        order.id,
        pendingStatus,
        `Reverted from ${order.orderStatus} to ${pendingStatus} via manual administrative override`
      );
    }
    setShowBackwardConfirm(false);
    setPendingStatus(null);
  };

  const handleSaveCourierDetails = () => {
    onUpdateCourier(order.id, {
      llrNumber: llrInput.trim() || undefined,
      courierStatus: courierStatusInput,
    });
    setIsEditingCourier(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const canEditStatus = ["ADMIN", "MANAGER", "ORDER_STAFF", "PACKING_STAFF", "DISPATCH_STAFF"].includes(userRole);
  const canEditCourier = ["ADMIN", "MANAGER", "DISPATCH_STAFF"].includes(userRole);

  const steps: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
    { key: "NEW", label: "New", icon: <Clock className="w-4 h-4" /> },
    { key: "CONFIRMED", label: "Confirmed", icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: "PACKING", label: "Packing", icon: <Box className="w-4 h-4" /> },
    { key: "PACKED", label: "Packed", icon: <Package className="w-4 h-4" /> },
    { key: "DISPATCHED", label: "Dispatched", icon: <Truck className="w-4 h-4" /> },
  ];

  const currentStepIndex = STATUS_FLOW_ORDER.indexOf(order.orderStatus);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose} />

      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                  {order.orderNumber}
                </h2>
                <SourceBadge source={order.source} />
                <span className="text-xs text-slate-400 font-mono">
                  ({order.externalOrderId})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Placed on {formatDate(order.createdAt)} • Total: <span className="font-semibold text-slate-900">{formatINR(order.totalAmount)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.orderStatus} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Interactive Stepper */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fulfillment Stepper
              </span>
              <span className="text-xs text-slate-400">
                Current: <strong className="text-slate-800">{order.orderStatus}</strong>
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 relative">
              {steps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <button
                    key={step.key}
                    disabled={!canEditStatus}
                    onClick={() => handleStatusChangeRequest(step.key)}
                    className={cn(
                      "flex flex-col items-center text-center p-2 rounded-lg border text-xs font-medium transition-all group",
                      isCurrent
                        ? "bg-orange-50 border-orange-500 text-orange-800 ring-2 ring-orange-500/20 shadow-xs"
                        : isCompleted
                        ? "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                        : "bg-white border-dashed border-slate-200 text-slate-400 hover:border-slate-300",
                      canEditStatus ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center mb-1 text-xs",
                        isCurrent
                          ? "bg-orange-600 text-white"
                          : isCompleted
                          ? "bg-slate-200 text-slate-700"
                          : "bg-slate-100 text-slate-400"
                      )}
                    >
                      {step.icon}
                    </div>
                    <span className="text-[11px] truncate w-full">{step.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick transition action buttons */}
            {canEditStatus && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Quick advance:</span>
                <div className="flex items-center gap-1.5">
                  {order.orderStatus === "NEW" && (
                    <button
                      onClick={() => handleStatusChangeRequest("CONFIRMED")}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-medium transition-colors"
                    >
                      Confirm Order
                    </button>
                  )}
                  {order.orderStatus === "CONFIRMED" && (
                    <button
                      onClick={() => handleStatusChangeRequest("PACKING")}
                      className="px-2.5 py-1 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded font-medium transition-colors"
                    >
                      Start Packing
                    </button>
                  )}
                  {order.orderStatus === "PACKING" && (
                    <button
                      onClick={() => handleStatusChangeRequest("PACKED")}
                      className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded font-medium transition-colors"
                    >
                      Mark as Packed
                    </button>
                  )}
                  {order.orderStatus === "PACKED" && (
                    <button
                      onClick={() => handleStatusChangeRequest("DISPATCHED")}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded font-medium transition-colors"
                    >
                      Dispatch Order
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Customer & Shipping Details */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Customer & Shipping Details
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Customer Name</span>
                <span className="font-semibold text-slate-900 text-sm">{order.customer.name}</span>
                <div className="mt-1 flex items-center gap-1.5 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.customer.mobile}</span>
                </div>
                {order.customer.email && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{order.customer.email}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Delivery Address</span>
                <p className="text-slate-700 leading-relaxed">
                  {order.customer.address}, {order.customer.city}, {order.customer.state} - <span className="font-mono font-medium">{order.customer.pincode}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200 text-[11px]">
                    Payment: <strong>{order.paymentStatus}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200 text-[11px]">
                    Orders: <strong>{order.customer.totalOrders}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                Items ({order.items.length})
              </h3>
              <span className="text-xs font-semibold text-slate-900">
                Total: {formatINR(order.totalAmount)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between text-xs bg-slate-50/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-slate-200 text-slate-600 font-bold flex items-center justify-center shrink-0 border border-slate-300">
                      {item.size}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900 block">{item.productName}</span>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                        <span className="font-mono text-slate-400">{item.sku}</span>
                        <span>•</span>
                        <span>Size: <strong className="text-slate-700">{item.size}</strong></span>
                        <span>•</span>
                        <span>Qty: <strong className="text-slate-700">{item.quantity}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block">{formatINR(item.subtotal)}</span>
                    <span className="text-[11px] text-slate-400">@ {formatINR(item.unitPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Courier & Dispatch Section (Independent Status System) */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                Courier & Logistics (Independent Status)
              </h3>
              {saveSuccessNotice && (
                <span className="text-xs text-emerald-600 font-medium animate-in fade-in">
                  Saved successfully!
                </span>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Assigned Courier</span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {order.dispatch.courierName}
                  </span>
                  {order.dispatch.courierName === "ST Courier" && (
                    <span className="mt-0.5 block text-[11px] text-orange-700 font-medium">
                      ★ ST Courier Partner
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Courier Status</span>
                  {isEditingCourier ? (
                    <select
                      value={courierStatusInput === "SHIPPED" || (courierStatusInput as string) === "DELIVERED" ? "SHIPPED" : "PENDING"}
                      onChange={(e) => setCourierStatusInput(e.target.value as CourierStatus)}
                      className={cn(
                        "w-full text-xs font-semibold px-2 py-1 bg-white border border-slate-300 rounded outline-none",
                        courierStatusInput === "SHIPPED" || (courierStatusInput as string) === "DELIVERED" ? "text-emerald-600" : "text-amber-600"
                      )}
                    >
                      <option value="PENDING" className="text-amber-600 font-semibold">Pending</option>
                      <option value="SHIPPED" className="text-emerald-600 font-semibold">Shipped</option>
                    </select>
                  ) : (
                    <CourierStatusBadge status={order.dispatch.courierStatus} />
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">LLR / Tracking #</span>
                  {isEditingCourier ? (
                    <input
                      type="text"
                      value={llrInput}
                      onChange={(e) => setLlrInput(e.target.value)}
                      placeholder="e.g. STC123456"
                      className="w-full text-xs font-mono px-2 py-1 bg-white border border-slate-300 rounded outline-none"
                    />
                  ) : (
                    <span className="font-mono text-sm font-semibold text-slate-800">
                      {order.dispatch.llrNumber || (
                        <span className="text-amber-600 text-xs font-normal">Not Assigned</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Courier Edit Actions */}
              {canEditCourier && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2">
                  {isEditingCourier ? (
                    <>
                      <button
                        onClick={() => {
                          setLlrInput(order.dispatch.llrNumber || "");
                          setCourierStatusInput(order.dispatch.courierStatus);
                          setIsEditingCourier(false);
                        }}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveCourierDetails}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-700 hover:bg-orange-800 text-white rounded text-xs font-medium shadow-xs"
                      >
                        <Save className="w-3 h-3" />
                        Save LLR & Status
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingCourier(true)}
                      className="px-2.5 py-1 text-xs text-orange-700 hover:bg-orange-50 border border-orange-200 rounded font-medium"
                    >
                      Edit LLR / Status
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ping4SMS Telemetry (Strictly Read-Only, No Send Button) */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Ping4SMS Delivery Telemetry (Read-Only)
              </h3>
              <SmsStatusBadge status={order.sms.status} />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block">Gateway Provider</span>
                  <span className="font-semibold text-slate-800">Ping4SMS External API</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Message ID</span>
                  <span className="font-mono text-slate-700">{order.sms.providerMessageId || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Sent Timestamp</span>
                  <span className="text-slate-700">{formatDate(order.sms.sentAt || "")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Delivery Timestamp</span>
                  <span className="text-slate-700">{formatDate(order.sms.deliveredAt || "")}</span>
                </div>
              </div>

              {order.sms.responseSnippet && (
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block mb-0.5">Provider Response</span>
                  <p className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                    {order.sms.responseSnippet}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Activity Timeline */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Complete Activity Audit Timeline
            </h3>

            <div className="relative pl-5 space-y-4 border-l-2 border-slate-200 ml-2">
              {order.timeline.map((entry) => (
                <div key={entry.id} className="relative group">
                  <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-600" />
                  <div className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{entry.action}</span>
                      <span className="text-slate-400 text-[11px]">{formatDate(entry.timestamp)}</span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{entry.details}</p>
                    <span className="text-[11px] text-slate-400">By {entry.user} ({entry.role})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Order ID: <code className="font-mono">{order.id}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </aside>

      {/* Backward Transition Confirmation Modal */}
      <ConfirmDialog
        isOpen={showBackwardConfirm}
        title="Confirm Backward Status Transition"
        description={`Are you sure you want to revert order ${order.orderNumber} from "${order.orderStatus}" back to "${pendingStatus}"? This may invalidate existing packaging or dispatch manifests.`}
        confirmLabel="Yes, Revert Status"
        cancelLabel="Keep Current Status"
        variant="warning"
        onConfirm={confirmBackwardTransition}
        onCancel={() => {
          setShowBackwardConfirm(false);
          setPendingStatus(null);
        }}
      />
    </>
  );
}

