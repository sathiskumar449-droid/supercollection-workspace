"use client";

import React, { useState } from "react";
import { ReturnCase, ReturnStatus, RefundStatus, RefundMethod } from "@/types/orderflow";
import { useOrderFlow } from "@/lib/hooks";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { ReturnStatusBadge, RefundStatusBadge } from "./return-status-badge";
import { 
  X, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  IndianRupee, 
  ArrowRightLeft,
  User,
  Phone,
  ArrowRight,
  Package,
  Layers,
  Check,
  Calendar,
  AlertCircle
} from "lucide-react";

interface ReturnDetailsDrawerProps {
  returnCase: ReturnCase | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenOrder?: (orderId: string) => void;
}

export function ReturnDetailsDrawer({
  returnCase,
  isOpen,
  onClose,
  onOpenOrder,
}: ReturnDetailsDrawerProps) {
  const { 
    orders,
    user, 
    updateReturnStatus, 
    processRefund, 
    createReplacementTask 
  } = useOrderFlow();

  // Refund Form State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundStatusInput, setRefundStatusInput] = useState<RefundStatus>("Refunded");
  const [refundAmountInput, setRefundAmountInput] = useState<string>("");
  const [refundMethodInput, setRefundMethodInput] = useState<RefundMethod>("UPI");
  const [utrReferenceInput, setUtrReferenceInput] = useState("");
  const [refundNoteInput, setRefundNoteInput] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);

  // Replacement Form State
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [repItemInput, setRepItemInput] = useState("");
  const [repSizeInput, setRepSizeInput] = useState("");
  const [repQtyInput, setRepQtyInput] = useState(1);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  if (!isOpen || !returnCase) return null;

  // Find customer's original order
  const originalOrder = orders.find(
    (o) => o.id === returnCase.orderId || o.orderNumber === returnCase.orderNumber
  );

  const totalOrderedItemsCount = originalOrder
    ? originalOrder.items.reduce((sum, it) => sum + it.quantity, 0)
    : returnCase.requestedQuantity;

  // Handlers
  const handleOpenRefund = () => {
    setRefundStatusInput("Refunded");
    setRefundAmountInput(String(returnCase.refundAmount || returnCase.expectedAmount));
    setRefundMethodInput(returnCase.refund?.refundMethod || "UPI");
    setUtrReferenceInput(returnCase.refund?.utrReference || "");
    setRefundNoteInput(returnCase.refund?.refundNotes || "");
    setRefundError(null);
    setIsRefundModalOpen(true);
  };

  const handleOpenReplace = () => {
    const firstItem = returnCase.items[0];
    setRepItemInput(firstItem?.productName || "Replacement Item");
    setRepSizeInput(firstItem?.size || "M");
    setRepQtyInput(returnCase.requestedQuantity || 1);
    setReplaceError(null);
    setIsReplaceModalOpen(true);
  };

  const handleSubmitRefund = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(refundAmountInput);
    if (isNaN(amount) || amount < 0) {
      setRefundError("Please enter a valid refund amount.");
      return;
    }

    const res = processRefund(returnCase.returnId, {
      refundStatus: refundStatusInput,
      refundAmount: amount,
      refundMethod: refundMethodInput,
      utrReference: utrReferenceInput.trim() || undefined,
      refundNotes: refundNoteInput.trim() || undefined,
      processedBy: user.name,
    });

    if (res.success) {
      setIsRefundModalOpen(false);
    } else {
      setRefundError(res.error || "Failed to process refund.");
    }
  };

  const handleSubmitReplace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repItemInput.trim()) {
      setReplaceError("Please enter replacement item name.");
      return;
    }

    const res = createReplacementTask(returnCase.returnId, {
      replacementItem: repItemInput.trim(),
      size: repSizeInput.trim() || "Standard",
      quantity: repQtyInput > 0 ? repQtyInput : 1,
    });

    if (res.success) {
      setIsReplaceModalOpen(false);
    } else {
      setReplaceError(res.error || "Failed to create replacement task.");
    }
  };

  const handleApprove = () => {
    updateReturnStatus(returnCase.returnId, "Return Approved", "Return request approved by staff");
  };

  const handleMarkCompleted = () => {
    updateReturnStatus(returnCase.returnId, "Completed", "Case marked as completed");
  };

  const handleReject = () => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      updateReturnStatus(returnCase.returnId, "Rejected", `Return rejected: ${reason}`);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200 shadow-2xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-mono tracking-tight">
                  {returnCase.returnId}
                </h2>
                <ReturnStatusBadge status={returnCase.status} />
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Original Order: <strong className="font-mono text-slate-800">{returnCase.orderNumber}</strong></span>
                <span>•</span>
                <span className={cn(
                  "font-bold px-1.5 py-0.2 rounded text-[10.5px]",
                  returnCase.returnType === "Refund" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                )}>
                  {returnCase.returnType}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Bar */}
        <div className="px-6 py-2.5 bg-rose-50/60 border-b border-rose-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Status:</span>
            <span className="font-bold text-rose-900">{returnCase.status}</span>
          </div>

          <div className="flex items-center gap-2">
            {returnCase.status === "Return Requested" && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-2.5 py-1 text-red-700 hover:bg-red-100 rounded-md border border-red-200 font-medium transition-colors cursor-pointer"
                >
                  Reject
                </button>
              </>
            )}

            {returnCase.returnType === "Refund" && (
              <button
                type="button"
                onClick={handleOpenRefund}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>{returnCase.refund?.refundStatus === "Refunded" ? "Update Refund" : "Process Refund"}</span>
              </button>
            )}

            {(returnCase.returnType === "Replacement" || returnCase.returnType === "Exchange") && (
              <button
                type="button"
                onClick={handleOpenReplace}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{returnCase.replacement ? "Update Exchange" : "Create Exchange Task"}</span>
              </button>
            )}

            {returnCase.status !== "Completed" && returnCase.status !== "Rejected" && (
              <button
                type="button"
                onClick={handleMarkCompleted}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                Mark Completed
              </button>
            )}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">

          {/* Inline Refund Modal */}
          {isRefundModalOpen && (
            <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                  <span>Process Customer Refund</span>
                </span>
                <button onClick={() => setIsRefundModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {refundError && <p className="text-xs text-red-600">{refundError}</p>}

              <form onSubmit={handleSubmitRefund} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Refund Status:</label>
                    <select
                      value={refundStatusInput}
                      onChange={(e) => setRefundStatusInput(e.target.value as RefundStatus)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium"
                    >
                      <option value="Refunded">Refunded (Completed)</option>
                      <option value="Pending">Pending (Processing)</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Refund Amount (₹):</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={refundAmountInput}
                      onChange={(e) => setRefundAmountInput(e.target.value)}
                      className="w-full bg-white border border-emerald-400 rounded px-2.5 py-1.5 font-bold font-mono text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Refund Method:</label>
                    <select
                      value={refundMethodInput}
                      onChange={(e) => setRefundMethodInput(e.target.value as RefundMethod)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium"
                    >
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Original Payment Method">Original Payment Gateway</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                      <option value="Store Credit">Store Credit / Coupon</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">UTR / Transaction Ref No:</label>
                    <input
                      type="text"
                      value={utrReferenceInput}
                      onChange={(e) => setUtrReferenceInput(e.target.value)}
                      placeholder="e.g. 423982479219"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Notes / Remarks:</label>
                  <textarea
                    rows={2}
                    value={refundNoteInput}
                    onChange={(e) => setRefundNoteInput(e.target.value)}
                    placeholder="e.g. Refund sent via Google Pay to customer mobile..."
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRefundModalOpen(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/50 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded shadow-xs"
                  >
                    Save Refund
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Inline Replacement Modal */}
          {isReplaceModalOpen && (
            <div className="p-4 bg-purple-50/90 border border-purple-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                <span className="font-bold text-purple-950 text-xs flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                  <span>Exchange / Replacement Task</span>
                </span>
                <button onClick={() => setIsReplaceModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {replaceError && <p className="text-xs text-red-600">{replaceError}</p>}

              <form onSubmit={handleSubmitReplace} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Replacement Product Name:</label>
                  <input
                    type="text"
                    value={repItemInput}
                    onChange={(e) => setRepItemInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Exchange Size:</label>
                    <input
                      type="text"
                      value={repSizeInput}
                      onChange={(e) => setRepSizeInput(e.target.value)}
                      placeholder="e.g. XL"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Quantity:</label>
                    <input
                      type="number"
                      min={1}
                      value={repQtyInput}
                      onChange={(e) => setRepQtyInput(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsReplaceModalOpen(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/50 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded shadow-xs"
                  >
                    Save Exchange Task
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 1. CUSTOMER & ORIGINAL ORDER SNAPSHOT */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Customer & Original Order Snapshot</span>
              </span>
              {originalOrder && (
                <button
                  type="button"
                  onClick={() => onOpenOrder?.(originalOrder.id)}
                  className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Order</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block text-[10.5px]">Customer Name</span>
                <span className="font-semibold text-slate-900 block truncate">{returnCase.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Phone Number</span>
                <span className="font-mono text-slate-800">{returnCase.customerPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Original Order ID</span>
                <span className="font-mono font-bold text-orange-700 text-sm">
                  {originalOrder?.orderNumber || returnCase.orderNumber}
                </span>
                {originalOrder?.externalOrderId && (
                  <span className="text-[10px] text-slate-400 font-mono block">
                    Ext: #{originalOrder.externalOrderId}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Total Items Ordered</span>
                <span className="font-bold text-slate-800">
                  {totalOrderedItemsCount} {totalOrderedItemsCount === 1 ? "item" : "items"}
                  {originalOrder && ` (${formatINR(originalOrder.totalAmount)})`}
                </span>
              </div>
            </div>
          </div>

          {/* 2. RETURN REQUEST & SUMMARY */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Return Request Summary</span>
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded font-bold text-xs flex items-center gap-1",
                returnCase.returnType === "Refund" 
                  ? "bg-rose-100 text-rose-800 border border-rose-200" 
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              )}>
                {returnCase.returnType === "Refund" ? (
                  <>
                    <IndianRupee className="w-3 h-3" />
                    <span>Refund Request</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Exchange Request</span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block text-[10.5px]">Return Type</span>
                <span className="font-bold text-slate-900 text-xs">{returnCase.returnType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Return Reason</span>
                <span className="font-semibold text-slate-800">{returnCase.reason}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Returned Quantity</span>
                <span className="font-bold text-rose-700 text-xs">
                  {returnCase.requestedQuantity} pcs returned
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">
                  {returnCase.returnType === "Refund" ? "Refund Amount" : "Exchange Value"}
                </span>
                <span className="font-mono font-bold text-rose-700 text-sm">
                  {formatINR(returnCase.refundAmount || returnCase.expectedAmount)}
                </span>
              </div>
            </div>

            {returnCase.customerNote && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[10.5px] mb-0.5">Customer Note / Details:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed font-medium">
                  "{returnCase.customerNote}"
                </p>
              </div>
            )}
          </div>

          {/* 3. ORDERED ITEMS VS RETURNED ITEMS TABLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span>Original Order Items & Return Status</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Returning <strong className="text-rose-700">{returnCase.requestedQuantity}</strong> of <strong>{totalOrderedItemsCount}</strong> items
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[10.5px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-2 text-center">Size</th>
                    <th className="py-2.5 px-2 text-center">Ordered Qty</th>
                    <th className="py-2.5 px-2 text-center">Returned Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Return Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11.5px]">
                  {/* If original order is available, list all customer's items to clearly show which were returned */}
                  {originalOrder ? (
                    originalOrder.items.map((it) => {
                      const retMatch = returnCase.items.find(
                        (ri) => (ri.orderItemId && ri.orderItemId === it.id) ||
                          (ri.productName.toLowerCase() === it.productName.toLowerCase() && ri.size === it.size)
                      );
                      const isReturned = Boolean(retMatch && retMatch.requestedQuantity > 0);
                      const returnedQty = retMatch ? retMatch.requestedQuantity : 0;
                      const returnLineAmount = returnedQty * it.unitPrice;

                      return (
                        <tr 
                          key={it.id} 
                          className={cn(
                            "transition-colors",
                            isReturned ? "bg-rose-50/30" : "bg-white opacity-75"
                          )}
                        >
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[180px] truncate" title={it.productName}>
                            <div>{it.productName}</div>
                            {it.sku && <div className="text-[10px] text-slate-400 font-mono">{it.sku}</div>}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-600 font-semibold">{it.size}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-800">{it.quantity}</td>
                          <td className="py-2.5 px-2 text-center">
                            {isReturned ? (
                              <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                                {returnedQty} pc{returnedQty > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium italic">0 (Kept)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{formatINR(it.unitPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {isReturned ? formatINR(returnLineAmount) : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isReturned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Returned</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                Not Returned
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    // Fallback to returnCase items
                    returnCase.items.map((it) => (
                      <tr key={it.id} className="bg-rose-50/30">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{it.productName}</td>
                        <td className="py-2.5 px-2 text-center font-mono">{it.size}</td>
                        <td className="py-2.5 px-2 text-center font-bold">{it.purchasedQuantity}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-rose-700">{it.requestedQuantity}</td>
                        <td className="py-2.5 px-3 text-right">{formatINR(it.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{formatINR(it.returnAmount)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Returned
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. REFUND / EXCHANGE DETAILS SECTION */}
          {returnCase.returnType === "Refund" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Refund Execution Details</span>
                </span>
                <RefundStatusBadge status={returnCase.refund?.refundStatus || "Pending"} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10.5px]">Refund Amount</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {formatINR(returnCase.refund?.refundAmount || returnCase.refundAmount || returnCase.expectedAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10.5px]">Refund Method</span>
                  <span className="font-semibold text-slate-800">{returnCase.refund?.refundMethod || "Pending (UPI/Bank)"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10.5px]">UTR / Reference</span>
                  <span className="font-mono text-slate-800">
                    {returnCase.refund?.utrReference || <span className="text-slate-400 italic">None yet</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10.5px]">Processed Date</span>
                  <span className="text-slate-700">
                    {returnCase.refund?.refundDate ? formatDate(returnCase.refund.refundDate) : "Pending"}
                  </span>
                </div>
              </div>

              {returnCase.refund?.refundNotes && (
                <div className="pt-2 border-t border-slate-100 text-slate-600">
                  <span className="text-slate-400 block text-[10.5px]">Refund Notes:</span>
                  <p className="mt-0.5 text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">{returnCase.refund.refundNotes}</p>
                </div>
              )}
            </div>
          )}

          {(returnCase.returnType === "Replacement" || returnCase.returnType === "Exchange") && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                  <span>Exchange / Replacement Details</span>
                </span>
                {returnCase.replacement ? (
                  <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {returnCase.replacement.status}
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs italic">Task pending</span>
                )}
              </div>

              {returnCase.replacement ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Replacement ID</span>
                    <span className="font-mono font-bold text-purple-700">{returnCase.replacement.replacementId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Item</span>
                    <span className="font-semibold text-slate-800">{returnCase.replacement.replacementItem}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Size</span>
                    <span className="font-semibold text-slate-800">{returnCase.replacement.size}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Quantity</span>
                    <span className="font-bold text-slate-900">{returnCase.replacement.quantity} pc</span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-xs py-1">
                  Exchange item task can be initiated using the "Create Exchange Task" button above.
                </p>
              )}
            </div>
          )}

          {/* 5. AUDIT TRAIL / TIMELINE */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Return History & Notes</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {returnCase.timeline?.length || 0} events
              </span>
            </div>

            <div className="space-y-2.5">
              {(returnCase.timeline || []).map((item, idx) => (
                <div key={item.id || idx} className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.action}</span>
                      <span className="text-slate-400 text-[10.5px]">•</span>
                      <span className="text-slate-500 text-[10.5px]">{item.user} ({item.role})</span>
                      <span className="text-slate-400 text-[10.5px]">•</span>
                      <span className="text-slate-400 font-mono text-[10px]">{formatDate(item.timestamp)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-slate-600 mt-0.5 bg-slate-50 p-1.5 rounded border border-slate-100 text-[11px]">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Case: <code className="font-mono font-semibold text-slate-700">{returnCase.returnId}</code></span>
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
