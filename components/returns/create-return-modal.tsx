"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Order, ReturnReason, ReturnType } from "@/types/orderflow";
import { useOrderFlow } from "@/lib/hooks";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { 
  X, 
  Search, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Truck,
  Package,
  Calendar,
  Phone,
  User,
  ShieldAlert
} from "lucide-react";

interface CreateReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedOrderId?: string;
  onSuccess?: (returnId: string) => void;
}

const RETURN_REASONS: ReturnReason[] = [
  "Size Issue",
  "Color Issue",
  "Wrong Product",
  "Damaged Product",
  "Quality Issue",
  "Product Not as Expected",
  "Customer Changed Mind",
  "Duplicate Order",
  "Courier Damage",
  "Missing Item",
  "Other",
];

export function CreateReturnModal({
  isOpen,
  onClose,
  preselectedOrderId,
  onSuccess,
}: CreateReturnModalProps) {
  const { orders, returns, createReturnCase } = useOrderFlow();

  // Search & Order selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Return Form State
  const [returnType, setReturnType] = useState<ReturnType>("Refund");
  const [returnReason, setReturnReason] = useState<ReturnReason>("Size Issue");
  const [customerNote, setCustomerNote] = useState("");
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [discountAdjustment, setDiscountAdjustment] = useState<number>(0);
  const [shippingAdjustment, setShippingAdjustment] = useState<number>(0);
  const [customOverrideAmount, setCustomOverrideAmount] = useState<string>("");
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select when preselectedOrderId is provided
  useEffect(() => {
    if (preselectedOrderId && isOpen) {
      const found = orders.find((o) => o.id === preselectedOrderId || o.orderNumber === preselectedOrderId);
      if (found) {
        setSelectedOrder(found);
      }
    }
  }, [preselectedOrderId, isOpen, orders]);

  // Reset or initialize item quantities when an order is selected
  useEffect(() => {
    if (selectedOrder) {
      const initial: Record<string, number> = {};
      selectedOrder.items.forEach((it) => {
        // Compute available returnable quantity for each item
        const existingReturns = returns.filter(
          (r) => (r.orderId === selectedOrder.id || r.orderNumber === selectedOrder.orderNumber) &&
            r.status !== "Rejected" && r.status !== "Cancelled"
        );
        let previouslyReturned = 0;
        existingReturns.forEach((ret) => {
          ret.items.forEach((ri) => {
            if ((ri.orderItemId && ri.orderItemId === it.id) || (ri.productName === it.productName && ri.size === it.size)) {
              previouslyReturned += ri.requestedQuantity;
            }
          });
        });
        const available = Math.max(0, it.quantity - previouslyReturned);
        // Default to returning 1 if available, otherwise 0
        initial[it.id] = available > 0 ? 1 : 0;
      });
      setItemQuantities(initial);
      setErrorMsg(null);
    }
  }, [selectedOrder, returns]);

  // Autocomplete order list for search input
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return orders
      .filter((o) => {
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.externalOrderId.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.mobile.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))
        );
      })
      .slice(0, 8);
  }, [orders, searchQuery]);

  // Calculate return items and amounts
  const itemCalculations = useMemo(() => {
    if (!selectedOrder) return { items: [], totalItemsAmount: 0, totalReturnQty: 0 };

    let totalItemsAmount = 0;
    let totalReturnQty = 0;

    const existingReturns = returns.filter(
      (r) => (r.orderId === selectedOrder.id || r.orderNumber === selectedOrder.orderNumber) &&
        r.status !== "Rejected" && r.status !== "Cancelled"
    );

    const items = selectedOrder.items.map((it) => {
      let previouslyReturned = 0;
      existingReturns.forEach((ret) => {
        ret.items.forEach((ri) => {
          if ((ri.orderItemId && ri.orderItemId === it.id) || (ri.productName === it.productName && ri.size === it.size)) {
            previouslyReturned += ri.requestedQuantity;
          }
        });
      });

      const maxReturnable = Math.max(0, it.quantity - previouslyReturned);
      const chosenQty = itemQuantities[it.id] || 0;
      const lineTotal = chosenQty * it.unitPrice;

      if (chosenQty > 0) {
        totalReturnQty += chosenQty;
        totalItemsAmount += lineTotal;
      }

      return {
        ...it,
        previouslyReturned,
        maxReturnable,
        chosenQty,
        lineTotal,
      };
    });

    return { items, totalItemsAmount, totalReturnQty };
  }, [selectedOrder, itemQuantities, returns]);

  const calculatedExpectedTotal = Math.max(
    0,
    itemCalculations.totalItemsAmount - (discountAdjustment || 0) + (shippingAdjustment || 0)
  );

  const finalExpectedAmount = isAdminOverride && customOverrideAmount !== ""
    ? parseFloat(customOverrideAmount) || 0
    : calculatedExpectedTotal;

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setSearchQuery("");
  };

  const handleQtyChange = (itemId: string, maxAvailable: number, newQty: number) => {
    const validQty = Math.max(0, Math.min(maxAvailable, newQty));
    setItemQuantities((prev) => ({
      ...prev,
      [itemId]: validQty,
    }));
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) {
      setErrorMsg("Please search and select an order first.");
      return;
    }

    if (itemCalculations.totalReturnQty <= 0) {
      setErrorMsg("Please specify a return quantity of at least 1 item.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const itemsToReturn = itemCalculations.items
      .filter((it) => it.chosenQty > 0)
      .map((it) => ({
        orderItemId: it.id,
        productName: it.productName,
        sku: it.sku,
        color: "Standard",
        size: it.size,
        purchasedQuantity: it.quantity,
        returnQuantity: it.chosenQty,
        unitPrice: it.unitPrice,
      }));

    const result = createReturnCase({
      orderId: selectedOrder.id,
      returnType,
      reason: returnReason,
      customerNote: customerNote.trim() || undefined,
      items: itemsToReturn,
      discountAdjustment: discountAdjustment || 0,
      shippingAdjustment: shippingAdjustment || 0,
      customAmountOverride: isAdminOverride ? finalExpectedAmount : undefined,
    });

    setIsSubmitting(false);

    if (result.success && result.returnCase) {
      onSuccess?.(result.returnCase.returnId);
      onClose();
    } else {
      setErrorMsg(result.error || "Failed to create return case. Please review inputs.");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in" 
        onClick={onClose} 
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center border border-orange-200">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Create Return Case</h2>
              <p className="text-xs text-slate-500">Initiate customer return or replacement request</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Search Order Step */}
          {!selectedOrder && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Search Order ID / Customer Phone
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. SC-WC-17776, OF-9035, or customer phone..."
                  className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-orange-500 focus:bg-white text-slate-800"
                  autoFocus
                />
              </div>

              {searchResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto shadow-sm bg-white">
                  {searchResults.map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => handleSelectOrder(ord)}
                      className="p-3 hover:bg-orange-50/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{ord.orderNumber}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            {ord.externalOrderId}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-0.5 flex items-center gap-2 text-[11px]">
                          <span>{ord.customer.name}</span>
                          <span>•</span>
                          <span>{ord.customer.mobile}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{formatINR(ord.totalAmount)}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(ord.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">No orders match "{searchQuery}"</p>
              )}
            </div>
          )}

          {/* If Order is Selected */}
          {selectedOrder && (
            <>
              {/* SECTION A - ORIGINAL ORDER */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    SECTION A — Original Order Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Change Order
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Order ID</span>
                    <span className="font-mono font-bold text-slate-800">{selectedOrder.orderNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Customer</span>
                    <span className="font-semibold text-slate-800 truncate block">{selectedOrder.customer.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Customer Phone</span>
                    <span className="font-mono text-slate-800">{selectedOrder.customer.mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Order Total</span>
                    <span className="font-semibold text-slate-900">{formatINR(selectedOrder.totalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Order Date</span>
                    <span className="text-slate-700">{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Courier</span>
                    <span className="text-slate-700">{selectedOrder.dispatch?.courierName || "Standard"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">LLR / Tracking</span>
                    <span className="font-mono text-slate-700">{selectedOrder.dispatch?.llrNumber || "None"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Order Status</span>
                    <span className="font-semibold text-slate-700">{selectedOrder.orderStatus}</span>
                  </div>
                </div>
              </div>

              {/* SECTION B - RETURN ITEMS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    SECTION B — Return Items & Quantities
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Selected Qty: <strong className="text-orange-600">{itemCalculations.totalReturnQty}</strong>
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-2 text-center">Size</th>
                        <th className="py-2.5 px-2 text-center">Purchased</th>
                        <th className="py-2.5 px-2 text-center">Returned</th>
                        <th className="py-2.5 px-2 text-center">Max Return</th>
                        <th className="py-2.5 px-2 text-center">Return Qty</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11.5px]">
                      {itemCalculations.items.map((it) => (
                        <tr key={it.id} className={it.chosenQty > 0 ? "bg-orange-50/30" : ""}>
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[160px] truncate" title={it.productName}>
                            {it.productName}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-600">{it.size}</td>
                          <td className="py-2.5 px-2 text-center text-slate-600 font-semibold">{it.quantity}</td>
                          <td className="py-2.5 px-2 text-center text-slate-400">{it.previouslyReturned}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold",
                              it.maxReturnable > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400"
                            )}>
                              {it.maxReturnable}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {it.maxReturnable > 0 ? (
                              <input
                                type="number"
                                min={0}
                                max={it.maxReturnable}
                                value={it.chosenQty}
                                onChange={(e) => handleQtyChange(it.id, it.maxReturnable, parseInt(e.target.value) || 0)}
                                className="w-14 text-center py-1 bg-white border border-slate-300 rounded font-semibold text-slate-900 outline-none focus:border-orange-500"
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Fully returned</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{formatINR(it.unitPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatINR(it.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION C - RETURN DETAILS */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  SECTION C — Return Details & Reason
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Return Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Return Type
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 p-1 rounded-lg">
                      {(["Refund", "Replacement", "Exchange"] as ReturnType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setReturnType(t)}
                          className={cn(
                            "py-1.5 text-xs font-semibold rounded transition-all text-center",
                            returnType === t
                              ? "bg-white text-orange-600 shadow-xs ring-1 ring-orange-200"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Return Reason */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Return Reason
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-orange-500 text-slate-800 font-medium"
                    >
                      {RETURN_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Customer Note */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Customer Note / Request Details
                  </label>
                  <textarea
                    rows={2}
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Enter customer feedback, reason specifics, or packaging notes..."
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-orange-500 text-slate-800"
                  />
                </div>

                {/* Calculation Summary Box */}
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Items Amount ({itemCalculations.totalReturnQty} pcs):</span>
                    <span className="font-semibold text-slate-900">{formatINR(itemCalculations.totalItemsAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>Discount Adjustment:</span>
                    <div className="flex items-center gap-1">
                      <span>-₹</span>
                      <input
                        type="number"
                        min={0}
                        value={discountAdjustment || ""}
                        onChange={(e) => setDiscountAdjustment(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-20 text-right px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>Shipping Fee Adjustment:</span>
                    <div className="flex items-center gap-1">
                      <span>+₹</span>
                      <input
                        type="number"
                        min={0}
                        value={shippingAdjustment || ""}
                        onChange={(e) => setShippingAdjustment(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-20 text-right px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-bold text-sm">
                    <span className="text-slate-900">
                      {returnType === "Refund" ? "Expected Refund Amount:" : "Return Goods Value:"}
                    </span>
                    <span className="text-orange-600 font-mono text-base">{formatINR(finalExpectedAmount)}</span>
                  </div>

                  {/* Admin Override Toggle */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAdminOverride}
                        onChange={(e) => setIsAdminOverride(e.target.checked)}
                        className="rounded border-slate-300 text-orange-600"
                      />
                      <span>Admin manual amount override</span>
                    </label>

                    {isAdminOverride && (
                      <input
                        type="number"
                        value={customOverrideAmount}
                        onChange={(e) => setCustomOverrideAmount(e.target.value)}
                        placeholder={String(calculatedExpectedTotal)}
                        className="w-24 text-right px-1.5 py-0.5 border border-orange-300 rounded font-semibold text-orange-700 bg-orange-50 text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Drawer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedOrder || itemCalculations.totalReturnQty <= 0}
              className={cn(
                "px-5 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5",
                isSubmitting || !selectedOrder || itemCalculations.totalReturnQty <= 0
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Creating..." : "Create Return Case"}</span>
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
