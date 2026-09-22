"use client";

import React, { useState } from "react";
import { 
  Bell, 
  Calendar, 
  ShieldCheck, 
  RotateCcw, 
  ChevronDown,
  Check,
  PackageCheck,
  X,
  RefreshCw,
  Globe
} from "lucide-react";
import { Role, UserSession } from "@/types/orderflow";
import { cn } from "@/lib/utils";
import { SyncWooCommerceDialog } from "@/components/sync-woocommerce-dialog";

interface TopBarProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  user: UserSession;
  onRoleChange: (role: Role, courierPartnerId?: string) => void;
  onOpenSearch: () => void;
  onResetData?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  dateFilter?: string;
  onDateFilterChange?: (df: string) => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
}

interface RoleOption {
  role: Role;
  courierPartnerId?: string;
  label: string;
  desc: string;
}

const ROLES_LIST: RoleOption[] = [
  { role: "ADMIN", label: "Admin", desc: "Full Unrestricted Access" },
  { role: "MANAGER", label: "Operations Manager", desc: "Fulfillment, Reports, Courier & SMS" },
  { role: "ORDER_STAFF", label: "Order Desk Staff", desc: "Orders & Confirmations" },
  { role: "PACKING_STAFF", label: "Packing Station", desc: "Dedicated Packing & Packed" },
  { role: "DISPATCH_STAFF", label: "Dispatch & Logistics", desc: "Dispatch, ST Courier, LLR, SMS" },
  { role: "COURIER", courierPartnerId: "ST_COURIER", label: "ST Courier Portal", desc: "Strict Privacy: ST Orders Only" },
  { role: "COURIER", courierPartnerId: "PROFESSIONAL_COURIER", label: "Professional Courier Portal", desc: "Strict Privacy: Professional Orders Only" },
  { role: "COURIER", courierPartnerId: "DTDC", label: "DTDC Hub Portal", desc: "Strict Privacy: DTDC Orders Only" },
];

export function TopBar({
  title,
  breadcrumbs = [{ label: "SuperCollection Work Desk" }],
  user,
  onRoleChange,
  onOpenSearch,
  onResetData,
  searchQuery = "",
  onSearchChange,
  dateFilter = "All",
  onDateFilterChange,
  customDate = "",
  onCustomDateChange,
}: TopBarProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-subtle gap-4">
      {/* Left: Breadcrumbs & Title */}
      <div className="flex flex-col shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span>/</span>}
              <span className={i === breadcrumbs.length - 1 ? "text-slate-600 font-semibold" : ""}>
                {b.label}
              </span>
            </React.Fragment>
          ))}
        </div>
        <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none mt-0.5">
          {title}
        </h1>
      </div>

      {/* Middle & Right Controls (Search bar removed as requested) */}
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs shrink-0"
          title="Sync & Import Orders from supercollections.in"
        >
          <Globe className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span className="hidden sm:inline">Sync Website</span>
        </button>

        {/* Refresh Live Data Button */}
        {onResetData && (
          <button
            onClick={() => onResetData()}
            title="Refresh orders from live database"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg relative transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-800">Operational Alerts</span>
                <span className="text-[11px] text-orange-600 font-medium">3 New</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200/60 text-amber-900">
                  <span className="font-semibold block">5 ST Courier Parcels Waiting LLR</span>
                  <span className="text-slate-600 text-[11px]">Enter LLR numbers before driver arrives.</span>
                </div>
                <div className="p-2 bg-red-50 rounded-lg border border-red-200/60 text-red-900">
                  <span className="font-semibold block">3 SMS Delivery Failures</span>
                  <span className="text-slate-600 text-[11px]">Ping4SMS reported DND or carrier reject.</span>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg border border-orange-200/60 text-orange-950">
                  <span className="font-semibold block">Packing Queue High</span>
                  <span className="text-slate-600 text-[11px]">8 confirmed orders ready for warehouse pick.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Role Switcher (RBAC Showcase) */}
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className="flex items-center gap-2 pl-2.5 pr-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
            <div className="text-left hidden sm:block">
              <span className="text-[10px] text-slate-400 block -mb-0.5 uppercase tracking-wide">Role</span>
              <span className="font-semibold text-slate-800 text-xs">
                {ROLES_LIST.find((r) => r.role === user.role && (!r.courierPartnerId || user.courierPartnerId === r.courierPartnerId))?.label ||
                  (user.role === "COURIER" ? `${user.name || "Courier Portal"}` : user.role)}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {roleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] overflow-y-auto">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Switch Role / Portal (Test RBAC)
              </div>
              <div className="space-y-0.5">
                {ROLES_LIST.map((r) => {
                  const isSelected =
                    user.role === r.role &&
                    (!r.courierPartnerId || user.courierPartnerId === r.courierPartnerId);
                  return (
                    <button
                      key={`${r.role}-${r.courierPartnerId || "default"}`}
                      onClick={() => {
                        onRoleChange(r.role, r.courierPartnerId);
                        setRoleDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors",
                        isSelected
                          ? "bg-orange-50 text-orange-950 font-semibold"
                          : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{r.desc}</div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-orange-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <SyncWooCommerceDialog
        isOpen={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
      />
    </header>
  );
}
