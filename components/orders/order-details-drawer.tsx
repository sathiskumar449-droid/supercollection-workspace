"use client";

import React, { useState, useMemo } from "react";
import { Order, CourierStatus, Role } from "@/types/orderflow";
import { 
  X, 
  Phone, 
  ChevronRight, 
  Save, 
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
    params: { llrNumber?: string; courierStatus?: CourierStatus }
  ) => void;
  userRole?: Role;
}

interface TrackingStage {
  key: string;
  title: string;
  description: string;
  timestamp?: string;
  completed: boolean;
}

/**
 * Format timestamp into clean owner-friendly format, e.g. "22 Sep, 08:14 AM" or "22 Sep, 1:26 PM"
 */
function formatDateTime(dateString?: string): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Build continuous chronological order tracking journey (Flipkart / Amazon style).
 * Strict 11-stage chronological lifecycle:
 * 1. Order placed
 * 2. Order processing
 * 3. Order confirmed
 * 4. Waiting for packing
 * 5. Packing started
 * 6. Order packed
 * 7. Order dispatched
 * 8. Waiting for shipment (Moved to Courier Hub)
 * 9. Shipped (Courier shipment)
 * 10. Waiting for SMS
 * 11. SMS sent (or SMS failed)
 */
function buildTrackingPipeline(order: Order): { stages: TrackingStage[]; currentIndex: number } {
  // Helper to extract recorded timestamp from timeline for a specific action
  const getTimelineTime = (actionName: string): string | undefined => {
    if (!order.timeline || !Array.isArray(order.timeline)) return undefined;
    const match = order.timeline.find(
      (t) => t.action?.toLowerCase() === actionName.toLowerCase()
    );
    return match?.timestamp;
  };

  const createdTime = order.createdAt || new Date().toISOString();

  // Order completed in WooCommerce
  // ONLY mark completed when WooCommerce has updated status to "completed" (or downstream fulfillment: PACKING, PACKED, DISPATCHED)
  const isOrderCompleted =
    order.orderStatus === "COMPLETED" ||
    order.orderStatus === "PACKING" ||
    order.orderStatus === "PACKED" ||
    order.orderStatus === "DISPATCHED";

  const completedTime =
    getTimelineTime("Order completed") ||
    getTimelineTime("Order confirmed") ||
    (isOrderCompleted ? order.updatedAt : undefined);

  const waitingPackingTime =
    getTimelineTime("Waiting for packing") ||
    (isOrderCompleted ? completedTime : undefined);

  // Determine packing stage completion
  const isPackingStarted =
    order.orderStatus === "PACKING" ||
    order.orderStatus === "PACKED" ||
    order.orderStatus === "DISPATCHED" ||
    Boolean(order.packingStartedAt) ||
    Boolean(getTimelineTime("Packing started"));
  const packingStartedTime = getTimelineTime("Packing started") || order.packingStartedAt;

  const isPacked =
    order.orderStatus === "PACKED" ||
    order.orderStatus === "DISPATCHED" ||
    Boolean(order.packedAt) ||
    Boolean(getTimelineTime("Order packed"));
  const packedTime = getTimelineTime("Order packed") || order.packedAt;

  // Determine dispatch stage completion
  const isDispatched =
    order.orderStatus === "DISPATCHED" ||
    Boolean(order.dispatchedAt) ||
    Boolean(getTimelineTime("Order dispatched"));
  const dispatchedTime = getTimelineTime("Order dispatched") || order.dispatchedAt;

  // Courier Hub stage
  const isMovedToCourier = isDispatched;
  const waitingShipmentTime =
    getTimelineTime("Waiting for shipment") ||
    order.dispatch.dispatchedAt ||
    dispatchedTime;

  // Shipped stage
  const isShipped =
    order.dispatch.courierStatus === "SHIPPED" ||
    (order.dispatch.courierStatus as string) === "DELIVERED" ||
    Boolean(getTimelineTime("Shipped"));
  const shippedTime =
    getTimelineTime("Shipped") ||
    order.dispatch.deliveredAt ||
    order.updatedAt;

  // SMS stages
  const isWaitingSms = isShipped;
  const waitingSmsTime = getTimelineTime("Waiting for SMS") || shippedTime;

  const isSmsSent =
    order.sms.status === "SENT" ||
    Boolean(getTimelineTime("SMS sent"));
  const isSmsFailed = order.sms.status === "FAILED";
  const smsTime = getTimelineTime("SMS sent") || order.sms.sentAt || order.updatedAt;

  const courierName = order.dispatch.courierName || "ST Courier";

  // Build the 11 sequential stages
  const stages: TrackingStage[] = [
    // 1. Order placed
    {
      key: "ORDER_PLACED",
      title: "Order placed",
      description: order.source === "WEBSITE" ? "Order received from website" : "Order received from WhatsApp",
      timestamp: createdTime,
      completed: true,
    },
    // 2. Order processing
    {
      key: "PROCESSING",
      title: "Order processing",
      description: "Order is being processed",
      timestamp: getTimelineTime("Order processing") || createdTime,
      completed: true,
    },
    // 3. Order completed (Updates when status is completed in WooCommerce)
    {
      key: "ORDER_COMPLETED",
      title: "Order completed",
      description: isOrderCompleted 
        ? "Order completed in WooCommerce" 
        : "Waiting for WooCommerce completion",
      timestamp: isOrderCompleted ? completedTime : undefined,
      completed: isOrderCompleted,
    },
    // 4. Waiting for packing
    {
      key: "WAITING_PACKING",
      title: "Waiting for packing",
      description: isOrderCompleted 
        ? "Order is ready for packing" 
        : "Pending order completion",
      timestamp: isOrderCompleted ? waitingPackingTime : undefined,
      completed: isOrderCompleted,
    },
    // 5. Packing started
    {
      key: "PACKING_STARTED",
      title: "Packing started",
      description: "Packing started",
      timestamp: isPackingStarted ? packingStartedTime : undefined,
      completed: Boolean(isPackingStarted),
    },
    // 6. Order packed
    {
      key: "ORDER_PACKED",
      title: "Order packed",
      description: "Order packed successfully",
      timestamp: isPacked ? packedTime : undefined,
      completed: Boolean(isPacked),
    },
    // 7. Order dispatched
    {
      key: "ORDER_DISPATCHED",
      title: "Order dispatched",
      description: "Order dispatched",
      timestamp: isDispatched ? dispatchedTime : undefined,
      completed: Boolean(isDispatched),
    },
    // 8. Waiting for shipment (Courier Hub)
    {
      key: "WAITING_SHIPMENT",
      title: "Waiting for shipment",
      description: `Order moved to ${courierName}${order.dispatch.llrNumber ? ` · LLR: ${order.dispatch.llrNumber}` : ""}`,
      timestamp: isMovedToCourier ? waitingShipmentTime : undefined,
      completed: Boolean(isMovedToCourier),
    },
    // 9. Shipped
    {
      key: "SHIPPED",
      title: "Shipped",
      description: `${courierName} marked the order as shipped`,
      timestamp: isShipped ? shippedTime : undefined,
      completed: Boolean(isShipped),
    },
    // 10. Waiting for SMS
    {
      key: "WAITING_SMS",
      title: "Waiting for SMS",
      description: "Customer notification pending",
      timestamp: isWaitingSms ? waitingSmsTime : undefined,
      completed: Boolean(isWaitingSms),
    },
    // 11. SMS notification
    {
      key: "SMS_SENT",
      title: isSmsFailed ? "SMS failed" : "SMS sent",
      description: isSmsFailed 
        ? "Customer notification could not be delivered" 
        : "Customer notification sent",
      timestamp: isSmsSent || isSmsFailed ? smsTime : undefined,
      completed: Boolean(isSmsSent || isSmsFailed),
    },
  ];

  // Current stage is the highest completed stage in sequential order
  let currentIndex = 0;
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].completed) {
      currentIndex = i;
    } else {
      break;
    }
  }

  return { stages, currentIndex };
}

export function OrderDetailsDrawer({
  order,
  isOpen,
  onClose,
  onUpdateCourier,
  userRole = "ADMIN",
}: OrderDetailsDrawerProps) {
  const [llrInput, setLlrInput] = useState("");
  const [courierStatusInput, setCourierStatusInput] = useState<CourierStatus>("PENDING");
  const [isEditingCourier, setIsEditingCourier] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Sync inputs when order opens
  React.useEffect(() => {
    if (order) {
      setLlrInput(order.dispatch.llrNumber || "");
      setCourierStatusInput(order.dispatch.courierStatus);
      setIsEditingCourier(false);
      setSaveSuccessNotice(false);
      setShowTechDetails(false);
    }
  }, [order]);

  const { stages, currentIndex } = useMemo(() => {
    if (!order) return { stages: [], currentIndex: 0 };
    return buildTrackingPipeline(order);
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSaveCourierDetails = () => {
    onUpdateCourier(order.id, {
      llrNumber: llrInput.trim() || undefined,
      courierStatus: courierStatusInput,
    });
    setIsEditingCourier(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const canEditCourier = ["ADMIN", "MANAGER", "DISPATCH_STAFF"].includes(userRole);

  // Clean Order ID for display (e.g. "17604")
  const displayOrderNum = order.externalOrderId || order.orderNumber.replace(/^(SC-WC-|OF-)/, "");

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
            <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
              Order #{displayOrderNum}
            </h2>
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

        {/* Drawer Body - Simple, Clean & Compact */}
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
                  <span className="font-mono">{order.customer.mobile}</span>
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

          {/* 4. COURIER DETAILS */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Courier Details
              </h3>
              {saveSuccessNotice && (
                <span className="text-xs text-emerald-600 font-medium animate-in fade-in">
                  Saved successfully!
                </span>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Courier</span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {order.dispatch.courierName || "ST Courier"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">LLR Number</span>
                  {isEditingCourier ? (
                    <input
                      type="text"
                      value={llrInput}
                      onChange={(e) => setLlrInput(e.target.value)}
                      placeholder="Enter LLR Number"
                      className="w-full text-xs font-mono px-2.5 py-1.5 bg-white border border-slate-300 rounded outline-none focus:border-orange-500"
                    />
                  ) : (
                    <span className="font-mono text-sm font-semibold text-slate-800">
                      {order.dispatch.llrNumber || (
                        <span className="text-amber-600 text-xs font-normal">Not Added</span>
                      )}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Delivery Status</span>
                  {isEditingCourier ? (
                    <select
                      value={courierStatusInput === "DELIVERED" ? "DELIVERED" : courierStatusInput === "SHIPPED" || (courierStatusInput as string) === "DISPATCHED" ? "SHIPPED" : "PENDING"}
                      onChange={(e) => setCourierStatusInput(e.target.value as CourierStatus)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded outline-none focus:border-orange-500 text-slate-800"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="SHIPPED">Dispatched</option>
                      <option value="DELIVERED">Delivered</option>
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          order.dispatch.courierStatus === "DELIVERED"
                            ? "bg-emerald-600"
                            : order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DISPATCHED"
                            ? "bg-blue-600"
                            : "bg-amber-500"
                        )}
                      />
                      <span
                        className={cn(
                          order.dispatch.courierStatus === "DELIVERED"
                            ? "text-emerald-700"
                            : order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DISPATCHED"
                            ? "text-blue-700"
                            : "text-amber-700"
                        )}
                      >
                        {order.dispatch.courierStatus === "DELIVERED"
                          ? "Delivered"
                          : order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DISPATCHED"
                          ? "Dispatched"
                          : "Pending"}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button: "Add LLR" when missing, "Update LLR" when exists */}
              {canEditCourier && (
                <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-end gap-2">
                  {isEditingCourier ? (
                    <>
                      <button
                        onClick={() => {
                          setLlrInput(order.dispatch.llrNumber || "");
                          setCourierStatusInput(order.dispatch.courierStatus);
                          setIsEditingCourier(false);
                        }}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveCourierDetails}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-700 hover:bg-orange-800 text-white rounded text-xs font-medium shadow-xs cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingCourier(true)}
                      className="px-3 py-1 text-xs text-orange-700 hover:bg-orange-50 border border-orange-200 rounded font-medium transition-colors cursor-pointer"
                    >
                      {order.dispatch.llrNumber ? "Update LLR" : "Add LLR"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 5. SMS STATUS */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                SMS Status
              </h3>
              <SmsStatusBadge status={order.sms.status} />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400 block mb-0.5">Status</span>
                  <span
                    className={cn(
                      "font-semibold",
                      order.sms.status === "SENT"
                        ? "text-emerald-700"
                        : order.sms.status === "FAILED"
                        ? "text-rose-700"
                        : "text-amber-700"
                    )}
                  >
                    {order.sms.status === "SENT"
                      ? "Sent"
                      : order.sms.status === "FAILED"
                      ? "Failed"
                      : "Pending"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Sent Time</span>
                  <span className="text-slate-700 font-medium">
                    {order.sms.sentAt ? formatDateTime(order.sms.sentAt) : "-"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Delivered Time</span>
                  <span className="text-slate-700 font-medium">
                    {order.sms.deliveredAt ? formatDateTime(order.sms.deliveredAt) : "-"}
                  </span>
                </div>
              </div>

              {/* Optional Technical Details for Admin */}
              {(order.sms.providerMessageId || order.sms.responseSnippet) && (
                <div className="pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showTechDetails && "rotate-90")} />
                    <span>{showTechDetails ? "Hide Technical Details" : "View Technical Details"}</span>
                  </button>

                  {showTechDetails && (
                    <div className="mt-2 p-2.5 bg-white rounded border border-slate-200 space-y-1.5 text-[11px] animate-in fade-in">
                      {order.sms.providerMessageId && (
                        <div>
                          <span className="text-slate-400">Message ID: </span>
                          <span className="font-mono text-slate-700">{order.sms.providerMessageId}</span>
                        </div>
                      )}
                      {order.sms.responseSnippet && (
                        <div>
                          <span className="text-slate-400">Gateway Response: </span>
                          <span className="font-mono text-slate-700">{order.sms.responseSnippet}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 6. ORDER TRACKING (Amazon / Flipkart Style Vertical Timeline) */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Order Tracking
              </h3>
              {(() => {
                const isAllCompleted = stages.length > 0 && stages.every((s) => s.completed);
                return (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {isAllCompleted ? "Completed" : stages[currentIndex]?.title || "In Progress"}
                  </span>
                );
              })()}
            </div>

            <div className="relative pl-6 space-y-4 ml-1 mt-3">
              {(() => {
                const isAllCompleted = stages.length > 0 && stages.every((s) => s.completed);
                return stages.map((stage, idx) => {
                  const isCompleted = isAllCompleted ? true : idx < currentIndex;
                  const isCurrent = !isAllCompleted && idx === currentIndex;
                  const isUpcoming = !isAllCompleted && idx > currentIndex;
                  const isLast = idx === stages.length - 1;

                  return (
                    <div key={stage.key} className="relative group">
                      {/* Vertical connecting line to next item */}
                      {!isLast && (
                        <div
                          className={cn(
                            "absolute -left-[17px] top-4 w-0.5 h-[calc(100%+8px)] transition-colors",
                            (isAllCompleted || idx < currentIndex) ? "bg-emerald-500" : "bg-slate-200"
                          )}
                        />
                      )}

                    {/* Status Dot */}
                    <div
                      className={cn(
                        "absolute -left-[24px] top-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all",
                        isCompleted && "bg-emerald-600 text-white shadow-2xs",
                        isCurrent && "bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-xs",
                        isUpcoming && "bg-white border-2 border-slate-300 text-transparent"
                      )}
                    >
                      {isCompleted ? "✓" : isCurrent ? "●" : ""}
                    </div>

                    {/* Content */}
                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-semibold text-xs",
                            isCompleted && "text-slate-900",
                            isCurrent && "text-emerald-700 font-bold",
                            isUpcoming && "text-slate-400 font-normal"
                          )}
                        >
                          {stage.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold uppercase tracking-tight">
                            Current
                          </span>
                        )}
                      </div>

                      {/* Timestamp (only for completed or current events) */}
                      {(isCompleted || isCurrent) && stage.timestamp && (
                        <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                          {formatDateTime(stage.timestamp)}
                        </span>
                      )}

                      {/* Description */}
                      <p
                        className={cn(
                          "text-[11px] mt-0.5 leading-snug",
                          isCompleted ? "text-slate-600" : isCurrent ? "text-slate-700 font-medium" : "text-slate-400"
                        )}
                      >
                        {stage.description}
                      </p>
                    </div>
                  </div>
                );
              });
            })()}
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Order ID: <code className="font-mono text-slate-700">{order.orderNumber}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
