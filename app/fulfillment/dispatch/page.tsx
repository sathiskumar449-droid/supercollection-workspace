"use client";

import React, { useState } from "react";
import { 
  Package, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  Tag, 
  Save, 
  Send, 
  Check, 
  ChevronRight,
  User,
  ArrowRight
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { SourceBadge, SmsStatusBadge, OrderStatusBadge } from "@/components/ui/status-badge";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { Order } from "@/types/orderflow";
import { INITIAL_COURIERS } from "@/lib/mock-data";

export default function DispatchPage() {
  const { orders, user, markAsDispatched, updateCourierDetails, updateOrderStatus } = useOrderFlow();
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Packed orders ready to dispatch
  const packedOrders = orders.filter((o) => o.orderStatus === "PACKED");

  // Inline edit state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [llrInput, setLlrInput] = useState<string>("");

  const canDispatch = ["ADMIN", "MANAGER", "DISPATCH_STAFF"].includes(user.role);

  const handleStartDispatchEdit = (order: Order) => {
    setEditingOrderId(order.id);
    setSelectedCourierId(order.dispatch.courierId || "cour-1");
    setLlrInput(order.dispatch.llrNumber || "");
  };

  const handleSaveAndDispatch = (orderId: string) => {
    const courierObj = INITIAL_COURIERS.find((c) => c.id === selectedCourierId);
    
    // If ST Courier, prompt if LLR is missing
    if (courierObj?.isStCourier && !llrInput.trim()) {
      alert("ST Courier orders require an LLR Number before dispatch handover.");
      return;
    }

    markAsDispatched(orderId, selectedCourierId, llrInput.trim() || undefined);
    setEditingOrderId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Ready to Dispatch</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              {packedOrders.length} Parcels Packed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            All packed orders waiting for carrier assignment, LLR generation, and final physical dispatch handoff.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Authorized Role:</span>
          <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded">
            {user.role}
          </span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        {packedOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-800">No Packed Orders Waiting Dispatch</h3>
            <p className="text-xs text-slate-500 mt-1">
              All packed parcels have been handed over to couriers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Courier Partner</th>
                  <th className="py-3 px-4">LLR Number</th>
                  <th className="py-3 px-4">SMS Status</th>
                  <th className="py-3 px-4 text-right">Dispatch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packedOrders.map((order) => {
                  const isEditing = editingOrderId === order.id;
                  const isStCourier = order.dispatch.courierName === "ST Courier";
                  const isLlrMissing = !order.dispatch.llrNumber || !order.dispatch.llrNumber.trim();
                  const isCourierMissing = !order.dispatch.courierName;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setInspectOrder(order)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{order.orderNumber}</span>
                          <SourceBadge source={order.source} />
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {order.customer.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {order.customer.city} ({order.customer.mobile})
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {order.items.length} items
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {formatINR(order.totalAmount)}
                      </td>

                      {/* Courier Column */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <select
                            value={selectedCourierId}
                            onChange={(e) => setSelectedCourierId(e.target.value)}
                            className="text-xs px-2 py-1 bg-white border border-slate-300 rounded outline-none font-medium"
                          >
                            {INITIAL_COURIERS.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        ) : isCourierMissing ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            Courier Not Assigned
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Truck className="w-3.5 h-3.5 text-orange-700" />
                            <span>{order.dispatch.courierName}</span>
                          </div>
                        )}
                      </td>

                      {/* LLR Column */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={llrInput}
                            onChange={(e) => setLlrInput(e.target.value)}
                            placeholder={selectedCourierId === "cour-1" ? "e.g. STC800101" : "Tracking #"}
                            className="text-xs font-mono px-2 py-1 bg-white border border-slate-300 rounded outline-none w-32"
                          />
                        ) : isStCourier && isLlrMissing ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            LLR Required
                          </span>
                        ) : (
                          <span className="font-mono text-slate-700 font-semibold">
                            {order.dispatch.llrNumber || "-"}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <SmsStatusBadge status={order.sms.status} />
                      </td>

                      {/* Action Column */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {canDispatch && (
                          isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingOrderId(null)}
                                className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveAndDispatch(order.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium shadow-xs text-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Dispatch</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartDispatchEdit(order)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-medium shadow-xs transition-colors"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch Handoff</span>
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

