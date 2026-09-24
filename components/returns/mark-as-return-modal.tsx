"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Order, ReturnReason, ReturnType } from "@/types/orderflow";
import { useOrderFlow } from "@/lib/hooks";
import { formatINR, cn } from "@/lib/utils";
import { 
  X, 
  RotateCcw, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Minus, 
  Plus, 
  ArrowRightLeft, 
  IndianRupee, 
  Package,
  Layers
} from "lucide-react";

interface MarkAsReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: Order[];
  onSuccess: (orderId: string, returnId: string, returnType: ReturnType, amount: number) => void;
}

const RETURN_REASONS: ReturnReason[] = [
  "Size Issue",
  "Color Issue",
  "Wrong Product",
  "Damaged Product",
  "Quality Issue",
  "Product Not as Expected",
  "Customer Changed Mind",
  "Courier Damage",
  "Other",
];

export function MarkAsReturnModal({
  isOpen,
  onClose,
  selectedOrders,
  onSuccess,
}: MarkAsReturnModalProps) {
  const { returns, createReturnCase } = useOrderFlow();

  // Active order being processed (defaults to first in list)
  const [activeOrderId, setActiveOrderId] = useState<string>("");

  useEffect(() => {
    if (selectedOrders.length > 0) {
      // If current activeOrderId not in selected, pick first
      if (!selectedOrders.some((o) => o.id === activeOrderId)) {
        setActiveOrderId(selectedOrders[0].id);
      }
    }
  }, [selectedOrders, activeOrderId]);

  const currentOrder = useMemo(() => {
    return selectedOrders.find((o) => o.id === activeOrderId) || selectedOrders[0] || null;
  }, [selectedOrders, activeOrderId]);

  // Form State
  const [returnType, setReturnType] = useState<ReturnType>("Refund");
  const [returnDate, setReturnDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<ReturnReason>("Customer Changed Mind");
  const [returnNote, setReturnNote] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // When active order changes, initialize item quantities and amounts
  useEffect(() => {
    if (!currentOrder) return;

    const initialQty: Record<string, number> = {};
    const existingReturns = returns.filter(
      (r) =>
        (r.orderId === currentOrder.id || r.orderNumber === currentOrder.orderNumber) &&
        r.status !== "Rejected" &&
        r.status !== "Cancelled"
    );

    let initialTotalAmount = 0;

    currentOrder.items.forEach((it) => {
      let previouslyReturned = 0;
      existingReturns.forEach((ret) => {
        ret.items.forEach((ri) => {
          if (
            (ri.orderItemId && ri.orderItemId === it.id) ||
            (ri.productName.toLowerCase() === it.productName.toLowerCase() && ri.size === it.size)
          ) {
            previouslyReturned += ri.requestedQuantity;
          }
        });
      });

      const maxReturnable = Math.max(0, it.quantity - previouslyReturned);
      // Default return quantity to maxReturnable (or 1 if available)
      const defaultQty = maxReturnable > 0 ? maxReturnable : 0;
      initialQty[it.id] = defaultQty;
      initialTotalAmount += defaultQty * it.unitPrice;
    });

    setItemQuantities(initialQty);
    setCustomAmount(String(initialTotalAmount));
    setIsAmountManuallyEdited(false);
    setErrorMsg(null);
  }, [currentOrder, returns]);

  // Calculate items info & summary
  const itemCalculations = useMemo(() => {
    if (!currentOrder) return { items: [], totalItemsAmount: 0, totalReturnQty: 0 };

    const existingReturns = returns.filter(
      (r) =>
        (r.orderId === currentOrder.id || r.orderNumber === currentOrder.orderNumber) &&
        r.status !== "Rejected" &&
        r.status !== "Cancelled"
    );

    let totalItemsAmount = 0;
    let totalReturnQty = 0;

    const items = currentOrder.items.map((it) => {
      let previouslyReturned = 0;
      existingReturns.forEach((ret) => {
        ret.items.forEach((ri) => {
          if (
            (ri.orderItemId && ri.orderItemId === it.id) ||
            (ri.productName.toLowerCase() === it.productName.toLowerCase() && ri.size === it.size)
          ) {
            previouslyReturned += ri.requestedQuantity;
          }
        });
      });

      const maxReturnable = Math.max(0, it.quantity - previouslyReturned);
      const chosenQty = itemQuantities[it.id] ?? (maxReturnable > 0 ? maxReturnable : 0);
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
  }, [currentOrder, itemQuantities, returns]);

  // Keep customAmount in sync with totalItemsAmount if user hasn't manually typed an override
  useEffect(() => {
    if (!isAmountManuallyEdited) {
      setCustomAmount(String(itemCalculations.totalItemsAmount));
    }
  }, [itemCalculations.totalItemsAmount, isAmountManuallyEdited]);

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
    if (!currentOrder) {
      setErrorMsg("No order selected.");
      return;
    }

    if (itemCalculations.totalReturnQty <= 0) {
      setErrorMsg("Please specify at least 1 product return quantity.");
      return;
    }

    const finalAmount = parseFloat(customAmount);
    if (isNaN(finalAmount) || finalAmount < 0) {
      setErrorMsg("Please enter a valid return amount (>= 0).");
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
      orderId: currentOrder.id,
      returnType,
      reason: returnReason,
      customerNote: returnNote.trim() || undefined,
      items: itemsToReturn,
      customAmountOverride: finalAmount,
      returnDate: returnDate || new Date().toISOString().split("T")[0],
    });

    setIsSubmitting(false);

    if (result.success && result.returnCase) {
      onSuccess(currentOrder.id, result.returnCase.returnId, returnType, finalAmount);
      onClose();
    } else {
      setErrorMsg(result.error || "Failed to create return case. Please review the details.");
    }
  };

  if (!isOpen || !currentOrder) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-rose-100 bg-gradient-to-r from-rose-50/80 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200 shadow-2xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Mark as Return</h3>
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                  {currentOrder.orderNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {currentOrder.customer.name} • {currentOrder.customer.mobile}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If multiple orders selected, show order switcher tab */}
        {selectedOrders.length > 1 && (
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Layers className="w-3.5 h-3.5 text-orange-600" />
              <span>Select order ({selectedOrders.length} selected):</span>
            </div>
            <select
              value={activeOrderId}
              onChange={(e) => setActiveOrderId(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 cursor-pointer"
            >
              {selectedOrders.map((ord, idx) => (
                <option key={ord.id} value={ord.id}>
                  #{idx + 1}: {ord.orderNumber} - {ord.customer.name} ({formatINR(ord.totalAmount)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Return Type & Return Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Return Type (Refund vs Exchange) */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Return Type <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReturnType("Refund")}
                  className={cn(
                    "flex flex-col items-center justify-center p-2.5 rounded-xl border font-semibold transition-all cursor-pointer",
                    returnType === "Refund"
                      ? "bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-500/20 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <IndianRupee className="w-3.5 h-3.5 text-rose-600" />
                    <span>Refund</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 font-normal">Amount to Customer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnType("Exchange")}
                  className={cn(
                    "flex flex-col items-center justify-center p-2.5 rounded-xl border font-semibold transition-all cursor-pointer",
                    returnType === "Exchange"
                      ? "bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-500/20 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                    <span>Exchange</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 font-normal">Replacement Product</span>
                </button>
              </div>
            </div>

            {/* Return Date */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Return Date</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-rose-500 focus:bg-white cursor-pointer shadow-2xs"
                required
              />
              <span className="text-[10.5px] text-slate-400 mt-1 block">Date when return was initiated or received</span>
            </div>
          </div>

          {/* 2. Products Returned & Quantity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span>Returned Products & Quantity</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="font-bold px-2 py-0.5 rounded-full text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                {itemCalculations.totalReturnQty} {itemCalculations.totalReturnQty === 1 ? "item" : "items"} returning
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs divide-y divide-slate-100">
              {itemCalculations.items.map((it) => (
                <div 
                  key={it.id} 
                  className={cn(
                    "p-3 flex items-center justify-between gap-3 transition-colors",
                    it.chosenQty > 0 ? "bg-rose-50/20" : "bg-white opacity-70"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-xs truncate" title={it.productName}>
                      {it.productName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-700 font-bold text-[10px]">
                        Size: {it.size}
                      </span>
                      <span>•</span>
                      <span>Purchased: {it.quantity}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">{formatINR(it.unitPrice)} each</span>
                      {it.previouslyReturned > 0 && (
                        <span className="text-amber-600 font-medium">({it.previouslyReturned} already returned)</span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-3 shrink-0">
                    {it.maxReturnable > 0 ? (
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(it.id, it.maxReturnable, it.chosenQty - 1)}
                          disabled={it.chosenQty <= 0}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white cursor-pointer transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={it.maxReturnable}
                          value={it.chosenQty}
                          onChange={(e) => handleQtyChange(it.id, it.maxReturnable, parseInt(e.target.value) || 0)}
                          className="w-10 text-center font-bold text-xs text-slate-900 border-x border-slate-200 py-1 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQtyChange(it.id, it.maxReturnable, it.chosenQty + 1)}
                          disabled={it.chosenQty >= it.maxReturnable}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Fully Returned</span>
                    )}

                    <div className="w-16 text-right font-mono font-bold text-slate-800 text-xs">
                      {formatINR(it.lineTotal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Return Amount */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">
                {returnType === "Refund" ? "Refund Amount (₹)" : "Exchange Value (₹)"}
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                Calculated from products: <strong>{formatINR(itemCalculations.totalItemsAmount)}</strong>
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-slate-500 text-sm">₹</span>
              <input
                type="number"
                min={0}
                step="any"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setIsAmountManuallyEdited(true);
                }}
                placeholder="0"
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 shadow-2xs"
                required
              />
            </div>
            {isAmountManuallyEdited && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-700 italic">Amount manually adjusted</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAmountManuallyEdited(false);
                    setCustomAmount(String(itemCalculations.totalItemsAmount));
                  }}
                  className="text-rose-600 hover:text-rose-800 font-semibold underline cursor-pointer"
                >
                  Reset to {formatINR(itemCalculations.totalItemsAmount)}
                </button>
              </div>
            )}
          </div>

          {/* 4. Reason & Optional Note */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Return Reason <span className="text-rose-500">*</span>
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-rose-500 cursor-pointer shadow-2xs"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Details / Notes <span className="text-slate-400 font-normal">(Optional context)</span>
              </label>
              <textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                rows={2}
                placeholder="e.g. Customer wants exchange for size 38, or refund UPI details / defect details..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:border-rose-500 focus:bg-white resize-none shadow-2xs"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Order status will be updated to <strong className="text-rose-700">↩ Return</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || itemCalculations.totalReturnQty <= 0}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98",
                  isSubmitting || itemCalculations.totalReturnQty <= 0
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting ? "Saving..." : `Confirm Return (${formatINR(parseFloat(customAmount) || 0)})`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
