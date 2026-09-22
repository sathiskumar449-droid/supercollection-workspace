"use client";

import React from "react";
import { CheckSquare, X, ChevronDown, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusOption {
  value: string;
  label: string;
}

interface BulkToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  statusOptions?: StatusOption[];
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
  onApplyAction?: () => void;
  actionButtonText?: string;
  isActionDisabled?: boolean;
  isLoading?: boolean;
  itemTypeLabel?: string; // "orders" or "records"
  customAction?: React.ReactNode;
}

export function BulkToolbar({
  selectedCount,
  onClearSelection,
  statusOptions,
  selectedStatus,
  onStatusChange,
  onApplyAction,
  actionButtonText,
  isActionDisabled = false,
  isLoading = false,
  itemTypeLabel = "orders",
  customAction,
}: BulkToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-orange-50/90 border border-orange-200/90 px-4 py-2.5 rounded-xl text-xs shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Left: Selected count & Clear */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-bold text-orange-900 bg-orange-100/80 px-2.5 py-1 rounded-md border border-orange-200">
          <CheckSquare className="w-3.5 h-3.5 text-orange-700" />
          <span>
            {selectedCount} {selectedCount === 1 ? itemTypeLabel.slice(0, -1) : itemTypeLabel} selected
          </span>
        </div>

        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 hover:bg-orange-100/60 px-2 py-1 rounded transition-colors cursor-pointer font-medium"
          title="Deselect all rows"
        >
          <X className="w-3 h-3" />
          <span>Clear Selection</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {customAction ? (
          customAction
        ) : (
          <>
            {statusOptions && onStatusChange && (
              <div className="relative">
                <select
                  value={selectedStatus || ""}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="appearance-none bg-white text-slate-800 font-semibold border border-orange-300 hover:border-orange-400 pl-3 pr-8 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/20 text-xs shadow-2xs cursor-pointer"
                >
                  <option value="" disabled>
                    Change Status ▾
                  </option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2 pointer-events-none" />
              </div>
            )}

            {onApplyAction && (
              <button
                type="button"
                onClick={onApplyAction}
                disabled={isActionDisabled || isLoading || !selectedStatus}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-xs cursor-pointer",
                  !selectedStatus || isActionDisabled || isLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                    : "bg-orange-700 hover:bg-orange-800 text-white active:scale-98"
                )}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {actionButtonText || `Update ${selectedCount} ${selectedCount === 1 ? itemTypeLabel.slice(0, -1) : itemTypeLabel}`}
                    </span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
