"use client";

import React, { useState } from "react";
import { Order, OrderStatus, CourierStatus, Role } from "@/types/orderflow";
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
  onUpdateStatus?: (orderId: string, status: OrderStatus, reason?: string) => void;
  onUpdateCourier: (
    orderId: string,
    params: { llrNumber?: string; courierStatus?: CourierStatus }
  ) => void;
  userRole?: Role;
}

interface OrderHistoryItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
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
 * Build real chronological journey of the order for business owner view.
 * Guarantees:
 * 1. First event is always the real order creation date/time (from WooCommerce).
 * 2. Removes technical noise (e.g. "Orders Synced", "WooCommerce REST API Sync").
 * 3. Removes contradictory flip-flops and duplicate entries.
 * 4. Human-readable titles and modules.
 */
function buildOrderHistory(order: Order): OrderHistoryItem[] {
  const items: OrderHistoryItem[] = [];

  // 1. Initial creation event - using original WooCommerce order creation date/time
  const createdDate = order.createdAt || new Date().toISOString();
  items.push({
    id: "initial-order-created",
    timestamp: createdDate,
    title: "Order created",
    description: order.source === "WEBSITE" ? "Order received from website" : "Order received from WhatsApp",
  });

  // 2. Real timeline logs from database
  if (order.timeline && Array.isArray(order.timeline)) {
    const sortedLogs = [...order.timeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let lastTitle = "Order created";

    for (const log of sortedLogs) {
      const act = log.action || "";
      const actLower = act.toLowerCase();
      const details = log.details || "";

      // Skip raw sync logs or telemetry checks (first item already represents creation)
      if (
        actLower.includes("orders synced") ||
        actLower.includes("order synced") ||
        actLower.includes("order ingested") ||
        actLower.includes("telemetry refreshed") ||
        log.user === "WooCommerce REST API Sync" ||
        log.user === "WooCommerce Webhook" ||
        log.user === "WhatsApp Chat Box"
      ) {
        continue;
      }

      // Skip identical old/new values (e.g. COMPLETED -> COMPLETED)
      if (log.oldValue && log.newValue && log.oldValue === log.newValue) {
        continue;
      }

      let title = "";
      let desc = "";

      if (actLower.includes("confirmed") || log.newValue === "CONFIRMED") {
        title = "Order confirmed";
        desc = "Updated from Orders";
      } else if (actLower.includes("packing started") || log.newValue === "PACKING") {
        title = "Packing started";
        desc = "Updated from Packing Station";
      } else if (actLower.includes("order packed") || log.newValue === "PACKED") {
        title = "Order packed";
        desc = "Updated from Packing Station";
      } else if (actLower.includes("dispatched") || log.newValue === "DISPATCHED") {
        title = "Order dispatched";
        desc = "Updated from Packing Station / Dispatch";
      } else if (actLower.includes("completed") || log.newValue === "COMPLETED") {
        title = "Order completed";
        desc = "Updated to completed";
      } else if (actLower.includes("llr")) {
        title = actLower.includes("added") ? "LLR added" : "LLR updated";
        const courier = order.dispatch.courierName || "ST Courier";
        const llr = log.newValue || order.dispatch.llrNumber || "";
        desc = llr ? `${courier} · LLR: ${llr}` : details || "LLR updated";
      } else if (actLower.includes("courier status") || actLower.includes("shipped")) {
        title = "Courier status updated";
        if (log.newValue === "SHIPPED" || log.newValue === "DISPATCHED" || actLower.includes("shipped")) {
          desc = "Status: Dispatched";
        } else if (log.newValue === "DELIVERED" || actLower.includes("delivered")) {
          desc = "Status: Delivered";
        } else {
          desc = `Status: ${log.newValue || "Pending"}`;
        }
      } else if (actLower.includes("sms sent")) {
        title = "SMS sent";
        desc = "Customer notification sent";
      } else if (actLower.includes("sms delivered")) {
        title = "SMS delivered";
        desc = "Customer notification delivered";
      } else if (actLower.includes("sms failed") || actLower.includes("delivery failed")) {
        title = "SMS delivery failed";
        desc = "Customer notification failed";
      } else {
        title = act;
        desc = details;
      }

      // Prevent duplicate consecutive entries
      if (title === lastTitle) {
        continue;
      }

      items.push({
        id: log.id || `hist-${new Date(log.timestamp).getTime()}-${items.length}`,
        timestamp: log.timestamp || new Date().toISOString(),
        title,
        description: desc,
      });

      lastTitle = title;
    }
  }

  // 3. Fallback for recorded order stages if missing from timeline
  const existingTitles = new Set(items.map((i) => i.title));

  if (order.confirmedAt && !existingTitles.has("Order confirmed")) {
    items.push({
      id: "stage-confirmed",
      timestamp: order.confirmedAt,
      title: "Order confirmed",
      description: "Updated from Orders",
    });
  }

  if (order.packingStartedAt && !existingTitles.has("Packing started")) {
    items.push({
      id: "stage-packing",
      timestamp: order.packingStartedAt,
      title: "Packing started",
      description: "Updated from Packing Station",
    });
  }

  if (order.packedAt && !existingTitles.has("Order packed")) {
    items.push({
      id: "stage-packed",
      timestamp: order.packedAt,
      title: "Order packed",
      description: "Updated from Packing Station",
    });
  }

  if (order.dispatchedAt && !existingTitles.has("Order dispatched")) {
    items.push({
      id: "stage-dispatched",
      timestamp: order.dispatchedAt,
      title: "Order dispatched",
      description: "Updated from Packing Station / Dispatch",
    });
  }

  if (order.dispatch.llrNumber && !existingTitles.has("LLR added") && !existingTitles.has("LLR updated")) {
    const courier = order.dispatch.courierName || "ST Courier";
    items.push({
      id: "stage-llr",
      timestamp: order.dispatch.dispatchedAt || order.dispatchedAt || order.updatedAt,
      title: "LLR added",
      description: `${courier} · LLR: ${order.dispatch.llrNumber}`,
    });
  }

  if (
    (order.dispatch.courierStatus === "SHIPPED" || (order.dispatch.courierStatus as string) === "DELIVERED") &&
    !existingTitles.has("Courier status updated")
  ) {
    items.push({
      id: "stage-courier-status",
      timestamp: order.dispatch.deliveredAt || order.dispatch.dispatchedAt || order.updatedAt,
      title: "Courier status updated",
      description: order.dispatch.courierStatus === "DELIVERED" ? "Status: Delivered" : "Status: Dispatched",
    });
  }

  if (order.sms.status === "SENT" && !existingTitles.has("SMS sent")) {
    items.push({
      id: "stage-sms-sent",
      timestamp: order.sms.sentAt || order.dispatch.deliveredAt || order.updatedAt,
      title: "SMS sent",
      description: "Customer notification sent",
    });
  }

  if (order.sms.deliveredAt && !existingTitles.has("SMS delivered")) {
    items.push({
      id: "stage-sms-delivered",
      timestamp: order.sms.deliveredAt,
      title: "SMS delivered",
      description: "Customer notification delivered",
    });
  }

  // 4. Sort chronologically
  items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // 5. Ensure "Order created" is always strictly the very first event
  const createdIndex = items.findIndex((i) => i.title === "Order created");
  if (createdIndex > 0) {
    const [createdItem] = items.splice(createdIndex, 1);
    items.unshift(createdItem);
  }

  // 6. Final deduplication of consecutive identical titles
  const cleanItems: OrderHistoryItem[] = [];
  for (const item of items) {
    if (cleanItems.length > 0 && cleanItems[cleanItems.length - 1].title === item.title) {
      continue;
    }
    cleanItems.push(item);
  }

  return cleanItems;
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
  const historyEntries = buildOrderHistory(order);

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
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveCourierDetails}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-700 hover:bg-orange-800 text-white rounded text-xs font-medium shadow-xs"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingCourier(true)}
                      className="px-3 py-1 text-xs text-orange-700 hover:bg-orange-50 border border-orange-200 rounded font-medium transition-colors"
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
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1"
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

          {/* 6. ORDER HISTORY */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Order History
            </h3>

            <div className="relative pl-5 space-y-4 border-l-2 border-slate-200 ml-2 mt-2">
              {historyEntries.map((entry) => (
                <div key={entry.id} className="relative group">
                  <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-600" />
                  <div className="text-xs">
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {formatDateTime(entry.timestamp)}
                    </span>
                    <span className="font-semibold text-slate-800 text-xs block mt-0.5">
                      {entry.title}
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {entry.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Order ID: <code className="font-mono text-slate-700">{order.orderNumber}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
