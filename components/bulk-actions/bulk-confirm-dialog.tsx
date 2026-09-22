"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkippedOrderInfo {
  orderNumber: string;
  reason: string;
}

interface BulkConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  targetStatusLabel: string;
  totalSelected: number;
  validCount: number;
  skippedOrders?: SkippedOrderInfo[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  itemTypeLabel?: string; // e.g. "orders" or "courier orders"
}

export function BulkConfirmDialog({
  isOpen,
  title,
  targetStatusLabel,
  totalSelected,
  validCount,
  skippedOrders = [],
  onConfirm,
  onCancel,
  isLoading = false,
  itemTypeLabel = "orders",
}: BulkConfirmDialogProps) {
  if (!isOpen) return null;

  const hasSkipped = skippedOrders.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {title || `Update ${validCount} ${validCount === 1 ? "Order" : "Orders"} to ${targetStatusLabel}?`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bulk status change confirmation
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 text-xs text-slate-600">
          <p className="leading-relaxed">
            This will update the status of{" "}
            <strong className="text-slate-900 font-bold">
              {validCount} {validCount === 1 ? itemTypeLabel.slice(0, -1) : itemTypeLabel}
            </strong>{" "}
            to{" "}
            <span className="inline-block font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
              {targetStatusLabel}
            </span>
            . An individual chronological timeline event will be recorded for each order.
          </p>

          {/* Skipped / Ineligible Orders Warning */}
          {hasSkipped && (
            <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {skippedOrders.length} {skippedOrders.length === 1 ? "order" : "orders"} cannot be moved to {targetStatusLabel} and will be skipped:
                </span>
              </div>
              <ul className="text-[11px] text-amber-900 list-disc list-inside max-h-24 overflow-y-auto space-y-0.5 pl-1 font-mono">
                {skippedOrders.map((so) => (
                  <li key={so.orderNumber}>
                    <span className="font-semibold">{so.orderNumber}</span>: {so.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || validCount === 0}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs transition-all cursor-pointer",
              validCount === 0
                ? "bg-slate-300 cursor-not-allowed text-slate-500"
                : "bg-orange-700 hover:bg-orange-800 active:scale-98"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Update {validCount} {validCount === 1 ? "Order" : "Orders"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
