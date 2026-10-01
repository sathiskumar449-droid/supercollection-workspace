"use client";

import React, { useState } from "react";
import { 
  Calendar, 
  X, 
  Globe, 
  MessageSquare 
} from "lucide-react";
import { Role, UserSession } from "@/types/orderflow";
import { cn } from "@/lib/utils";
import { SyncWooCommerceDialog } from "@/components/sync-woocommerce-dialog";
import { SyncWhatsAppDialog } from "@/components/sync-whatsapp-dialog";

interface TopBarProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  user?: UserSession;
  onRoleChange?: (role: Role, courierPartnerId?: string) => void;
  onOpenSearch?: () => void;
  onResetData?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  dateFilter?: string;
  onDateFilterChange?: (df: string) => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
  onLogout?: () => void;
}

export function TopBar({
  title,
  dateFilter = "All",
  onDateFilterChange,
  customDate = "",
  onCustomDateChange,
}: TopBarProps) {
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [whatsappSyncDialogOpen, setWhatsappSyncDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-subtle gap-4">
      {/* Left: Navigation Title */}
      <div className="flex items-center shrink-0 min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
          {title}
        </h1>
      </div>

      {/* Right Controls: Date Filter Presets + Date Picker + Sync Buttons */}
      <div className="flex items-center gap-2.5 min-w-0 justify-end">
        {/* Date Filter & Calendar Selector (On all pages) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Preset Buttons with Vibrant Distinct Colors */}
          <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs">
            {[
              { key: "All", label: "All", activeClass: "bg-slate-900 text-white shadow-xs font-semibold" },
              { key: "Today", label: "Today", activeClass: "bg-orange-600 text-white shadow-xs font-semibold" },
              { key: "Yesterday", label: "Yesterday", activeClass: "bg-amber-600 text-white shadow-xs font-semibold" },
              { key: "Last 7 Days", label: "Last 7 Days", activeClass: "bg-blue-600 text-white shadow-xs font-semibold" },
              { key: "This Month", label: "This Month", activeClass: "bg-emerald-600 text-white shadow-xs font-semibold" },
              { key: "Last Month", label: "Last Month", activeClass: "bg-purple-600 text-white shadow-xs font-semibold" },
            ].map((opt) => {
              const isSelected = (dateFilter === opt.key || (!dateFilter && opt.key === "All")) && !customDate;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    onDateFilterChange?.(opt.key);
                    onCustomDateChange?.("");
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-all text-xs whitespace-nowrap",
                    isSelected
                      ? opt.activeClass
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Calendar Date Picker right next to date filter */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all",
              customDate
                ? "bg-orange-600 text-white border-orange-600 font-semibold shadow-xs"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            )}
            title="Pick a specific date from calendar"
          >
            <Calendar className={cn("w-3.5 h-3.5 shrink-0", customDate ? "text-white" : "text-slate-500")} />
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                const picked = e.target.value;
                onCustomDateChange?.(picked);
                if (picked) {
                  onDateFilterChange?.("Custom");
                } else {
                  onDateFilterChange?.("All");
                }
              }}
              className={cn(
                "bg-transparent text-xs font-medium outline-none cursor-pointer w-[118px]",
                customDate ? "text-white" : "text-slate-700"
              )}
            />
            {customDate && (
              <button
                onClick={() => {
                  onCustomDateChange?.("");
                  onDateFilterChange?.("All");
                }}
                className="p-0.5 text-white/80 hover:text-white rounded transition-colors"
                title="Clear date"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sync Website Orders Button */}
        <button
          onClick={() => setSyncDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs shrink-0 cursor-pointer"
          title="Sync & Import Orders from supercollections.in"
        >
          <Globe className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span className="hidden sm:inline">Sync Website</span>
        </button>

        {/* Sync WhatsApp Orders Button */}
        <button
          onClick={() => setWhatsappSyncDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs shrink-0 cursor-pointer"
          title="Sync & Import Orders from WhatsApp Chat Box"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="hidden sm:inline">Sync WhatsApp</span>
        </button>
      </div>

      <SyncWooCommerceDialog
        isOpen={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
      />

      <SyncWhatsAppDialog
        isOpen={whatsappSyncDialogOpen}
        onClose={() => setWhatsappSyncDialogOpen(false)}
      />
    </header>
  );
}
