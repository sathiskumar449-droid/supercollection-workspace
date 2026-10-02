"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Calendar, 
  X, 
  Globe, 
  MessageSquare,
  Bell,
  CheckCircle2,
  Check,
  Clock,
  ExternalLink
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { formatINR, formatDate } from "@/lib/utils";
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
  user,
  dateFilter = "All",
  onDateFilterChange,
  customDate = "",
  onCustomDateChange,
}: TopBarProps) {
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [whatsappSyncDialogOpen, setWhatsappSyncDialogOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [approvedNotice, setApprovedNotice] = useState<string | null>(null);

  const { returns, approveReturnCase } = useOrderFlow();

  const pendingReturns = returns.filter(
    (r) => r.status === "Waiting for Confirmation" || r.approvalStatus === "PENDING"
  );

  const handleApproveFromNotification = (returnId: string, orderNumber: string) => {
    approveReturnCase(returnId);
    setApprovedNotice(`Return for ${orderNumber} approved successfully!`);
    setTimeout(() => setApprovedNotice(null), 3000);
  };

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

        {/* Notification Bell Icon for Owner/Admin */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className={cn(
              "relative p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center",
              pendingReturns.length > 0
                ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/30"
                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
            )}
            title={pendingReturns.length > 0 ? `${pendingReturns.length} return(s) waiting for confirmation` : "Notifications"}
          >
            <Bell className={cn("w-4 h-4", pendingReturns.length > 0 && "text-amber-700 animate-pulse")} />
            {pendingReturns.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
                {pendingReturns.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {notificationsOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setNotificationsOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Popover Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Waiting for Return Confirmation</span>
                    {pendingReturns.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {pendingReturns.length} Pending
                      </span>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Popover Body */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {approvedNotice && (
                    <div className="p-2.5 bg-emerald-50 text-emerald-800 border-b border-emerald-200 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{approvedNotice}</span>
                    </div>
                  )}

                  {pendingReturns.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      <p className="text-xs font-semibold text-slate-700">All returns confirmed!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No pending returns waiting for approval.</p>
                    </div>
                  ) : (
                    pendingReturns.map((ret) => (
                      <div key={ret.id} className="p-3 hover:bg-slate-50/70 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900">{ret.orderNumber}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                {ret.returnType}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                              {ret.customerName} {ret.customerPhone ? `(${ret.customerPhone})` : ""}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-xs text-rose-700">
                            {formatINR(ret.refundAmount || ret.expectedAmount || 0)}
                          </span>
                        </div>

                        <div className="p-2 rounded bg-slate-50 text-[11px] text-slate-600 border border-slate-100 space-y-0.5">
                          <div>Reason: <span className="font-medium text-slate-800">{ret.reason}</span></div>
                          {ret.customerNote && <div>Note: <span className="italic text-slate-700">"{ret.customerNote}"</span></div>}
                          <div className="text-[10.5px] text-slate-400 pt-0.5 flex items-center justify-between">
                            <span>Submitted by: <strong className="text-slate-700">{ret.submittedForApprovalBy || ret.createdBy || "Staff"}</strong></span>
                            <span>{formatDate(ret.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <Link 
                            href={`/returns?tab=Waiting for Confirmation`} 
                            onClick={() => setNotificationsOpen(false)}
                            className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-0.5"
                          >
                            <span>Inspect Case</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleApproveFromNotification(ret.id, ret.orderNumber)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Return</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Popover Footer */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center">
                  <Link
                    href="/returns"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    View All Returns in Returns Page →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {user?.role !== "COURIER" && (
          <>
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
          </>
        )}
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
