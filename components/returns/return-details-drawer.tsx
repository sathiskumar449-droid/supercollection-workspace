"use client";

import React, { useState } from "react";
import { ReturnCase, ReturnStatus, QcCondition, QcResult, InventoryDisposition, RefundStatus, RefundMethod } from "@/types/orderflow";
import { useOrderFlow } from "@/lib/hooks";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { ReturnStatusBadge, RefundStatusBadge } from "./return-status-badge";
import { 
  X, 
  RotateCcw, 
  Truck, 
  Package, 
  Box,
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  ShieldCheck, 
  DollarSign, 
  ArrowRightLeft,
  User,
  Phone,
  AlertTriangle,
  ArrowRight,
  Send,
  Boxes,
  ClipboardCheck
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
    user, 
    updateReturnStatus, 
    recordReturnReceived, 
    performQcCheck, 
    processRefund, 
    createReplacementTask 
  } = useOrderFlow();

  // Action Mode State
  const [activeActionModal, setActiveActionModal] = useState<"RECEIVE" | "QC" | "REFUND" | "REPLACE" | null>(null);

  // Receiving Form State
  const [receivedQtyInput, setReceivedQtyInput] = useState<number>(0);
  const [receivedNoteInput, setReceivedNoteInput] = useState("");

  // QC Form State
  const [qcConditionInput, setQcConditionInput] = useState<QcCondition>("Good");
  const [qcResultInput, setQcResultInput] = useState<QcResult>("Approved");
  const [qcDispositionInput, setQcDispositionInput] = useState<InventoryDisposition>("Restock");
  const [qcNoteInput, setQcNoteInput] = useState("");

  // Refund Form State
  const [refundStatusInput, setRefundStatusInput] = useState<RefundStatus>("Refunded");
  const [refundAmountInput, setRefundAmountInput] = useState<string>("");
  const [refundMethodInput, setRefundMethodInput] = useState<RefundMethod>("UPI");
  const [utrReferenceInput, setUtrReferenceInput] = useState("");
  const [refundNoteInput, setRefundNoteInput] = useState("");

  // Replacement Form State
  const [repSizeInput, setRepSizeInput] = useState("");
  const [repColorInput, setRepColorInput] = useState("");

  // Feedback Toast / Error
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync inputs when opening action modals
  const handleOpenReceive = () => {
    if (!returnCase) return;
    setReceivedQtyInput(returnCase.requestedQuantity);
    setReceivedNoteInput("");
    setActionError(null);
    setActiveActionModal("RECEIVE");
  };

  const handleOpenQc = () => {
    if (!returnCase) return;
    setQcConditionInput("Good");
    setQcResultInput("Approved");
    setQcDispositionInput("Restock");
    setQcNoteInput("");
    setActionError(null);
    setActiveActionModal("QC");
  };

  const handleOpenRefund = () => {
    if (!returnCase) return;
    setRefundStatusInput("Refunded");
    setRefundAmountInput(String(returnCase.refundAmount || returnCase.expectedAmount));
    setRefundMethodInput("UPI");
    setUtrReferenceInput("");
    setRefundNoteInput("");
    setActionError(null);
    setActiveActionModal("REFUND");
  };

  const handleOpenReplace = () => {
    if (!returnCase) return;
    const firstItem = returnCase.items[0];
    setRepSizeInput(firstItem?.size || "M");
    setRepColorInput(firstItem?.color || "Standard");
    setActionError(null);
    setActiveActionModal("REPLACE");
  };

  if (!isOpen || !returnCase) return null;

  // Permissions
  const isAdminOrManager = ["ADMIN", "MANAGER"].includes(user.role);
  const canReceive = ["ADMIN", "MANAGER", "DISPATCH_STAFF", "PACKING_STAFF"].includes(user.role);
  const canQc = ["ADMIN", "MANAGER"].includes(user.role);
  const canRefund = ["ADMIN"].includes(user.role);

  // Quick Action Handlers
  const handleApproveReturn = () => {
    updateReturnStatus(returnCase.returnId, "Return Approved", "Return request reviewed and approved by staff");
  };

  const handleMarkAwaiting = () => {
    updateReturnStatus(returnCase.returnId, "Awaiting Return", "Return shipping label/pickup booked with courier");
  };

  const handleRejectReturn = () => {
    const reason = prompt("Enter rejection reason for this return case:");
    if (reason) {
      updateReturnStatus(returnCase.returnId, "Rejected", `Return rejected: ${reason}`);
    }
  };

  const handleCloseReturn = () => {
    updateReturnStatus(returnCase.returnId, "Completed", "Case closed by administrator");
  };

  const handleSubmitReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (receivedQtyInput < 0) {
      setActionError("Received quantity cannot be negative.");
      return;
    }
    const res = recordReturnReceived(returnCase.returnId, {
      receivedQuantity: receivedQtyInput,
      receivedBy: user.name,
      receivingNote: receivedNoteInput.trim() || undefined,
    });
    if (res.success) {
      setActiveActionModal(null);
    } else {
      setActionError(res.error || "Failed to record receipt");
    }
  };

  const handleSubmitQc = (e: React.FormEvent) => {
    e.preventDefault();
    const res = performQcCheck(returnCase.returnId, {
      condition: qcConditionInput,
      qcResult: qcResultInput,
      inventoryDisposition: qcDispositionInput,
      qcNotes: qcNoteInput.trim() || undefined,
      checkedBy: user.name,
    });
    if (res.success) {
      setActiveActionModal(null);
    } else {
      setActionError(res.error || "Failed to submit QC result");
    }
  };

  const handleSubmitRefund = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(refundAmountInput);
    if (isNaN(amount) || amount <= 0) {
      setActionError("Please enter a valid refund amount.");
      return;
    }
    if (refundStatusInput === "Refunded" && !utrReferenceInput.trim()) {
      setActionError("UTR / Reference number is required to mark refund completed.");
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
      setActiveActionModal(null);
    } else {
      setActionError(res.error || "Failed to process refund");
    }
  };

  const handleSubmitReplace = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createReplacementTask(returnCase.returnId, {
      size: repSizeInput,
      color: repColorInput,
    });
    if (res.success) {
      setActiveActionModal(null);
    } else {
      setActionError(res.error || "Failed to create replacement task");
    }
  };

  // Short quantity calculation
  const shortQty = returnCase.receivedAt
    ? Math.max(0, returnCase.requestedQuantity - returnCase.receivedQuantity)
    : 0;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in" 
        onClick={onClose} 
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm border border-orange-200 shadow-2xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-base">{returnCase.returnId}</span>
                <ReturnStatusBadge status={returnCase.status} />
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Order:</span>
                <button
                  onClick={() => onOpenOrder?.(returnCase.orderId)}
                  className="font-mono font-semibold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                >
                  {returnCase.orderNumber}
                </button>
                <span>•</span>
                <span>Type: <strong className="text-slate-700">{returnCase.returnType}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Lifecycle Action Banner */}
        <div className="px-6 py-3 bg-orange-50/70 border-b border-orange-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-orange-950 font-medium">
            <span className="text-slate-500">Current Phase:</span>
            <span className="font-bold">{returnCase.status}</span>
          </div>

          <div className="flex items-center gap-2">
            {returnCase.status === "Return Requested" && (
              <>
                {isAdminOrManager && (
                  <>
                    <button
                      onClick={handleApproveReturn}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Return</span>
                    </button>
                    <button
                      onClick={handleRejectReturn}
                      className="px-2.5 py-1.5 text-red-700 hover:bg-red-100 rounded-lg border border-red-200 font-medium transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  </>
                )}
              </>
            )}

            {returnCase.status === "Return Approved" && (
              <button
                onClick={handleMarkAwaiting}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Mark Awaiting Return</span>
              </button>
            )}

            {(returnCase.status === "Awaiting Return" || returnCase.status === "Return Approved") && canReceive && (
              <button
                onClick={handleOpenReceive}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Box className="w-3.5 h-3.5" />
                <span>Record Return Received</span>
              </button>
            )}

            {(returnCase.status === "Return Received" || returnCase.status === "QC Pending") && canQc && (
              <button
                onClick={handleOpenQc}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Perform QC Check</span>
              </button>
            )}

            {returnCase.status === "Refund Pending" && canRefund && (
              <button
                onClick={handleOpenRefund}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Process Refund</span>
              </button>
            )}

            {returnCase.status === "Replacement Pending" && !returnCase.replacement && (
              <button
                onClick={handleOpenReplace}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Create Replacement Task</span>
              </button>
            )}

            {returnCase.status === "Replacement Dispatched" && isAdminOrManager && (
              <button
                onClick={handleCloseReturn}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* INLINE ACTION MODALS */}
          {activeActionModal === "RECEIVE" && (
            <div className="p-4 bg-orange-50/80 border border-orange-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                <span className="font-bold text-orange-950 text-xs flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-orange-600" />
                  <span>Record Physical Return Parcel Arrival</span>
                </span>
                <button onClick={() => setActiveActionModal(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {actionError && <p className="text-xs text-red-600">{actionError}</p>}

              <form onSubmit={handleSubmitReceive} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Expected Return Qty:</label>
                    <input
                      type="text"
                      disabled
                      value={returnCase.requestedQuantity}
                      className="w-full bg-slate-100 border border-slate-200 rounded px-2.5 py-1.5 font-bold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Received Return Qty:</label>
                    <input
                      type="number"
                      min={0}
                      value={receivedQtyInput}
                      onChange={(e) => setReceivedQtyInput(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-orange-400 rounded px-2.5 py-1.5 font-bold text-slate-900 outline-none focus:ring-1 focus:ring-orange-500"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Short Qty Warning if discrepancy */}
                {returnCase.requestedQuantity - receivedQtyInput > 0 && (
                  <div className="p-2 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-900 font-medium text-[11.5px] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Short Quantity Detected: <strong>{returnCase.requestedQuantity - receivedQtyInput} unit(s) missing</strong>.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-600 mb-1">Receiving Note / Parcel Condition:</label>
                  <textarea
                    rows={2}
                    value={receivedNoteInput}
                    onChange={(e) => setReceivedNoteInput(e.target.value)}
                    placeholder="Enter packaging status, outer courier bag condition, etc."
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal(null)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/50 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded shadow-xs"
                  >
                    Confirm Receipt → Move to QC
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeActionModal === "QC" && (
            <div className="p-4 bg-orange-50/80 border border-orange-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                <span className="font-bold text-orange-950 text-xs flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-orange-600" />
                  <span>Warehouse QC Inspection</span>
                </span>
                <button onClick={() => setActiveActionModal(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {actionError && <p className="text-xs text-red-600">{actionError}</p>}

              <form onSubmit={handleSubmitQc} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Physical Condition:</label>
                    <select
                      value={qcConditionInput}
                      onChange={(e) => setQcConditionInput(e.target.value as QcCondition)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium"
                    >
                      <option value="Good">Good (Unused & Tags Intact)</option>
                      <option value="Used">Used / Washed</option>
                      <option value="Damaged">Damaged / Defective</option>
                      <option value="Missing Item">Missing Item / Parts</option>
                      <option value="Wrong Item">Wrong Item Returned</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">QC Result:</label>
                    <select
                      value={qcResultInput}
                      onChange={(e) => setQcResultInput(e.target.value as QcResult)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium"
                    >
                      <option value="Approved">Approved (Eligible for refund/replacement)</option>
                      <option value="Partially Approved">Partially Approved</option>
                      <option value="Rejected">Rejected (Ineligible)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Inventory Stock Disposition:</label>
                  <select
                    value={qcDispositionInput}
                    onChange={(e) => setQcDispositionInput(e.target.value as InventoryDisposition)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium"
                  >
                    <option value="Restock">Restock to Sellable Inventory</option>
                    <option value="Damaged Stock">Damaged Stock (Do not restock)</option>
                    <option value="Hold">Hold for Secondary Review</option>
                    <option value="Other">Other / Write-off</option>
                  </select>
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    * Damaged/Used goods will strictly not be added to sellable stock.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">QC Inspector Note:</label>
                  <textarea
                    rows={2}
                    value={qcNoteInput}
                    onChange={(e) => setQcNoteInput(e.target.value)}
                    placeholder="Enter details on fabric inspection, tags, seam quality..."
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal(null)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/50 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded shadow-xs"
                  >
                    Submit QC Check
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeActionModal === "REFUND" && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Process Refund Disbursement</span>
                </span>
                <button onClick={() => setActiveActionModal(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {actionError && <p className="text-xs text-red-600">{actionError}</p>}

              <form onSubmit={handleSubmitRefund} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Refund Amount (₹):</label>
                    <input
                      type="number"
                      value={refundAmountInput}
                      onChange={(e) => setRefundAmountInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Refund Status:</label>
                    <select
                      value={refundStatusInput}
                      onChange={(e) => setRefundStatusInput(e.target.value as RefundStatus)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium"
                    >
                      <option value="Refunded">Refunded (Completed)</option>
                      <option value="Processing">Processing</option>
                      <option value="Pending">Pending</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Payment Method:</label>
                    <select
                      value={refundMethodInput}
                      onChange={(e) => setRefundMethodInput(e.target.value as RefundMethod)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium"
                    >
                      <option value="UPI">UPI Transfer (GPay / PhonePe / Paytm)</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                      <option value="Cash">Cash</option>
                      <option value="Original Payment Method">Original Payment Gateway (Razorpay/WooCommerce)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">UTR / Reference Number *:</label>
                    <input
                      type="text"
                      value={utrReferenceInput}
                      onChange={(e) => setUtrReferenceInput(e.target.value)}
                      placeholder="e.g. UTR-982348912"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Refund Note:</label>
                  <input
                    type="text"
                    value={refundNoteInput}
                    onChange={(e) => setRefundNoteInput(e.target.value)}
                    placeholder="Transaction remarks or approval notes"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal(null)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/50 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded shadow-xs"
                  >
                    Confirm & Complete Refund
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeActionModal === "REPLACE" && (
            <div className="p-4 bg-purple-50/80 border border-purple-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                <span className="font-bold text-purple-950 text-xs flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                  <span>Create Replacement Order Task</span>
                </span>
                <button onClick={() => setActiveActionModal(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {actionError && <p className="text-xs text-red-600">{actionError}</p>}

              <form onSubmit={handleSubmitReplace} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Replacement Size:</label>
                    <input
                      type="text"
                      value={repSizeInput}
                      onChange={(e) => setRepSizeInput(e.target.value)}
                      placeholder="e.g. L"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Replacement Color:</label>
                    <input
                      type="text"
                      value={repColorInput}
                      onChange={(e) => setRepColorInput(e.target.value)}
                      placeholder="e.g. Black"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal(null)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/50 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded shadow-xs"
                  >
                    Dispatch to Packing Station
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 1. CUSTOMER & ORDER INFO */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Customer & Order Snapshot
              </span>
              <button
                onClick={() => onOpenOrder?.(returnCase.orderId)}
                className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Order</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block text-[10.5px]">Customer Name</span>
                <span className="font-semibold text-slate-800 block truncate">{returnCase.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Phone Number</span>
                <span className="font-mono text-slate-800">{returnCase.customerPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Order Number</span>
                <span className="font-mono font-bold text-slate-800">{returnCase.orderNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Created Date</span>
                <span className="text-slate-700">{formatDate(returnCase.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* 2. RETURN REQUEST DETAILS */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block border-b border-slate-100 pb-2">
              Return Request
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block text-[10.5px]">Return Type</span>
                <span className="font-semibold text-slate-800">{returnCase.returnType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Return Reason</span>
                <span className="font-semibold text-slate-800">{returnCase.reason}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Requested Quantity</span>
                <span className="font-bold text-slate-900">{returnCase.requestedQuantity} pcs</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">Expected Amount</span>
                <span className="font-mono font-bold text-orange-600">{formatINR(returnCase.expectedAmount)}</span>
              </div>
            </div>

            {returnCase.customerNote && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[10.5px] mb-0.5">Customer Note:</span>
                <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200/60 leading-relaxed">
                  "{returnCase.customerNote}"
                </p>
              </div>
            )}
          </div>

          {/* 3. RETURN ITEMS */}
          <div className="space-y-2">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Return Items
            </span>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[10.5px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-2 text-center">Size</th>
                    <th className="py-2.5 px-2 text-center">Req Qty</th>
                    <th className="py-2.5 px-2 text-center">Rec Qty</th>
                    <th className="py-2.5 px-2 text-center">App Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11.5px]">
                  {returnCase.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div>{it.productName}</div>
                        {it.sku && <div className="text-[10px] text-slate-400 font-mono">{it.sku}</div>}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">{it.size}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-900">{it.requestedQuantity}</td>
                      <td className="py-2.5 px-2 text-center text-slate-700 font-semibold">{it.receivedQuantity || 0}</td>
                      <td className="py-2.5 px-2 text-center font-semibold text-emerald-700">{it.approvedQuantity || 0}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatINR(it.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatINR(it.returnAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. RETURN RECEIPT & WAREHOUSE INTAKE */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-slate-500" />
                <span>Return Receipt (Warehouse Loading Dock)</span>
              </span>
              {returnCase.receivedAt ? (
                <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Received
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Awaiting Delivery
                </span>
              )}
            </div>

            {returnCase.receivedAt ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Expected Qty</span>
                    <span className="font-bold text-slate-800">{returnCase.requestedQuantity} pcs</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Received Qty</span>
                    <span className="font-bold text-slate-900">{returnCase.receivedQuantity} pcs</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Short Qty</span>
                    <span className={cn(
                      "font-bold",
                      shortQty > 0 ? "text-red-600" : "text-emerald-700"
                    )}>
                      {shortQty} pcs
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Received By</span>
                    <span className="font-semibold text-slate-800">{returnCase.receivedBy || "Staff"}</span>
                  </div>
                </div>

                {shortQty > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Discrepancy recorded: Customer requested return of {returnCase.requestedQuantity} pcs, but only {returnCase.receivedQuantity} pcs were in parcel.
                    </span>
                  </div>
                )}

                {returnCase.receivingNote && (
                  <div className="pt-2 border-t border-slate-100 text-slate-600">
                    <span className="text-slate-400 block text-[10.5px]">Receiving Note:</span>
                    <p className="mt-0.5 text-slate-700">{returnCase.receivingNote}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-xs py-2 text-center">
                Parcel has not yet been checked in at warehouse.
              </p>
            )}
          </div>

          {/* 5. QC CHECK */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Quality Control (QC Check)</span>
              </span>
              {returnCase.qc ? (
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10.5px] font-bold border",
                  returnCase.qc.qcResult === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  returnCase.qc.qcResult === "Partially Approved" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-red-50 text-red-700 border-red-200"
                )}>
                  {returnCase.qc.qcResult}
                </span>
              ) : (
                <span className="text-slate-400 text-xs italic">Pending Inspection</span>
              )}
            </div>

            {returnCase.qc ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Condition</span>
                    <span className="font-semibold text-slate-800">{returnCase.qc.condition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Stock Disposition</span>
                    <span className="font-semibold text-slate-800">{returnCase.qc.inventoryDisposition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Approved Qty</span>
                    <span className="font-bold text-emerald-700">{returnCase.approvedQuantity} pcs</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Inspector</span>
                    <span className="font-semibold text-slate-800">{returnCase.qc.checkedBy}</span>
                  </div>
                </div>

                {returnCase.qc.qcNotes && (
                  <div className="pt-2 border-t border-slate-100 text-slate-600">
                    <span className="text-slate-400 block text-[10.5px]">QC Note:</span>
                    <p className="mt-0.5 text-slate-700">{returnCase.qc.qcNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-xs py-2 text-center">
                QC inspection pending physical parcel receipt.
              </p>
            )}
          </div>

          {/* 6. REFUND SECTION (when Return Type = Refund) */}
          {returnCase.returnType === "Refund" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                  <span>Refund Details</span>
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
                  <span className="font-semibold text-slate-800">{returnCase.refund?.refundMethod || "Pending"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10.5px]">UTR / Reference</span>
                  <span className="font-mono text-slate-800">
                    {returnCase.refund?.utrReference || <span className="text-slate-400 italic">None</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10.5px]">Processed At</span>
                  <span className="text-slate-700">
                    {returnCase.refund?.refundDate ? formatDate(returnCase.refund.refundDate) : "-"}
                  </span>
                </div>
              </div>

              {returnCase.refund?.refundNotes && (
                <div className="pt-2 border-t border-slate-100 text-slate-600">
                  <span className="text-slate-400 block text-[10.5px]">Notes:</span>
                  <p className="mt-0.5 text-slate-700">{returnCase.refund.refundNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* 7. REPLACEMENT SECTION (when Return Type = Replacement / Exchange) */}
          {(returnCase.returnType === "Replacement" || returnCase.returnType === "Exchange") && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                  <span>Replacement Task (Packing & Dispatch)</span>
                </span>
                {returnCase.replacement ? (
                  <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {returnCase.replacement.status}
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs italic">Awaiting QC approval</span>
                )}
              </div>

              {returnCase.replacement ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">Replacement ID</span>
                      <span className="font-mono font-bold text-purple-700">{returnCase.replacement.replacementId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">Replacement Item</span>
                      <span className="font-semibold text-slate-800">{returnCase.replacement.replacementItem}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">Color / Size</span>
                      <span className="font-medium text-slate-700">
                        {returnCase.replacement.color} • {returnCase.replacement.size}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">Quantity</span>
                      <span className="font-bold text-slate-900">{returnCase.replacement.quantity} pc</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">Dispatch ID</span>
                      <span className="font-mono text-slate-800">
                        {returnCase.replacement.dispatchId || <span className="text-slate-400 italic">In Packing</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">Courier Partner</span>
                      <span className="text-slate-700">{returnCase.replacement.courier || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">LLR Number</span>
                      <span className="font-mono text-slate-700">{returnCase.replacement.llr || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10.5px]">Dispatched At</span>
                      <span className="text-slate-700">
                        {returnCase.replacement.dispatchedAt ? formatDate(returnCase.replacement.dispatchedAt) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-xs py-2 text-center">
                  Replacement order task will be generated upon QC approval.
                </p>
              )}
            </div>
          )}

          {/* 8. AUDIT TRAIL / TIMELINE */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Return Audit Trail & History</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {returnCase.timeline?.length || 0} events recorded
              </span>
            </div>

            <div className="relative pl-6 space-y-4 ml-1">
              {(returnCase.timeline || []).map((item, idx) => {
                const isLast = idx === (returnCase.timeline?.length || 1) - 1;

                return (
                  <div key={item.id || idx} className="relative group">
                    {!isLast && (
                      <div className="absolute -left-[17px] top-4 w-0.5 h-[calc(100%+12px)] bg-slate-200" />
                    )}

                    <div className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-orange-600 text-white flex items-center justify-center ring-4 ring-orange-50 shadow-2xs">
                      <span className="text-[8px]">✓</span>
                    </div>

                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">
                          {formatDate(item.timestamp)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          {item.user} ({item.role})
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 text-xs mt-0.5">
                        {item.action}
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed bg-slate-50/60 p-1.5 rounded border border-slate-100">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Case ID: <code className="font-mono font-semibold text-slate-700">{returnCase.returnId}</code></span>
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
