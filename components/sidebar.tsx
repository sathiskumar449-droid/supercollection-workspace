"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Box, 
  RotateCcw,
  Truck, 
  Send, 
  BarChart3, 
  Settings,
  LogOut,
} from "lucide-react";
import { UserSession } from "@/types/orderflow";
import { cn } from "@/lib/utils";

interface SidebarProps {
  user: UserSession;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
  badgeCounts?: {
    packingCount?: number;
    dispatchCount?: number;
    stMissingLlr?: number;
    courierCount?: number;
    smsFailed?: number;
    returnsCount?: number;
  };
}

export function Sidebar({
  user,
  badgeCounts = {},
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // RBAC Permission checks
  const canAccess = (item: string): boolean => {
    // Strict privacy & security: Courier users ONLY see Courier Hub
    if (user.role === "COURIER") {
      return item === "courier";
    }

    switch (item) {
      case "dashboard":
        return ["ADMIN", "MANAGER"].includes(user.role);
      case "orders":
        return ["ADMIN", "MANAGER", "ORDER_STAFF", "PACKING_STAFF", "DISPATCH_STAFF"].includes(user.role);
      case "packing":
        return ["ADMIN", "MANAGER", "PACKING_STAFF", "ORDER_STAFF"].includes(user.role);
      case "returns":
        return ["ADMIN", "MANAGER", "ORDER_STAFF", "PACKING_STAFF"].includes(user.role);
      case "courier":
        return ["ADMIN", "MANAGER", "DISPATCH_STAFF", "ORDER_STAFF", "PACKING_STAFF", "COURIER"].includes(user.role);
      case "sms":
        return ["ADMIN", "MANAGER", "DISPATCH_STAFF", "ORDER_STAFF", "PACKING_STAFF"].includes(user.role);
      case "settings":
        return user.role === "ADMIN";
      default:
        return false;
    }
  };

  const isActive = (path: string, exact = false) => {
    if (exact) return pathname === path;
    return pathname.startsWith(path);
  };

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/",
      exact: true,
      icon: LayoutDashboard,
      badge: undefined,
      badgeType: "default",
    },
    {
      id: "orders",
      label: "Tracking",
      href: "/orders",
      exact: true,
      icon: ShoppingCart,
      badge: undefined,
      badgeType: "default",
    },
    {
      id: "packing",
      label: "Orders",
      href: "/fulfillment/packing",
      exact: false,
      icon: Box,
      badge: badgeCounts.packingCount && badgeCounts.packingCount > 0 ? badgeCounts.packingCount : undefined,
      badgeType: "warning",
    },
    {
      id: "courier",
      label: "Courier",
      href: "/couriers",
      exact: false,
      icon: Truck,
      badge:
        badgeCounts.courierCount !== undefined
          ? (badgeCounts.courierCount > 0 ? badgeCounts.courierCount : undefined)
          : (user.role !== "COURIER" && badgeCounts.stMissingLlr && badgeCounts.stMissingLlr > 0
              ? badgeCounts.stMissingLlr
              : undefined),
      badgeType: "warning",
    },
    {
      id: "sms",
      label: "SMS",
      href: "/sms",
      exact: false,
      icon: Send,
      badge: badgeCounts.smsFailed && badgeCounts.smsFailed > 0 ? badgeCounts.smsFailed : undefined,
      badgeType: "danger",
    },
    {
      id: "returns",
      label: "Returns",
      href: "/returns",
      exact: false,
      icon: RotateCcw,
      badge: badgeCounts.returnsCount && badgeCounts.returnsCount > 0 ? badgeCounts.returnsCount : undefined,
      badgeType: "warning",
    },
    {
      id: "settings",
      label: "Settings",
      href: "/settings",
      exact: false,
      icon: Settings,
      badge: undefined,
      badgeType: "default",
    },
  ];

  return (
    <aside
      className="relative flex flex-col h-full w-[68px] sm:w-[74px] border-r border-orange-700 bg-orange-600 text-white transition-all select-none z-40 shrink-0 overflow-hidden"
    >
      {/* Brand Header */}
      <div className="py-2 px-1 flex flex-col items-center justify-center border-b border-white/15 text-center shrink-0">
        <div className="w-6 h-6 rounded-lg bg-white text-orange-600 flex items-center justify-center font-black text-[11px] mb-1">
          SC
        </div>
        <span className="font-bold text-white text-[8.5px] tracking-tight leading-none block truncate w-full">
          SuperCollection
        </span>
        <span className="text-[7px] font-bold text-orange-100 tracking-wider uppercase block mt-0.5">
          Work Desk
        </span>
      </div>

      {/* Navigation Links: Stacked Icon on Top, Name Below - Cleanly grouped at top */}
      <div className="flex-1 min-h-0 overflow-hidden py-2 px-1.5 gap-1.5 flex flex-col justify-start">
        {navItems
          .filter((item) => item.id !== "settings")
          .map((item) => {
            if (!canAccess(item.id)) return null;
            const active = isActive(item.href, item.exact);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center text-center py-2 px-1 rounded-xl transition-all relative group shrink-0",
                  active
                    ? "bg-white text-orange-700 font-bold shadow-sm"
                    : "text-white/90 hover:bg-white/15 hover:text-white"
                )}
                title={item.label}
              >
                <div className="relative">
                  <item.icon
                    className={cn(
                      "w-4 h-4 stroke-[2] transition-transform duration-150 group-hover:scale-110",
                      active ? "text-orange-600" : "text-white"
                    )}
                  />
                  {mounted && item.badge !== undefined && (
                    <span
                      suppressHydrationWarning
                      className={cn(
                        "absolute -top-1 -right-2.5 min-w-[15px] h-3.5 px-1 rounded-full text-[8.5px] font-bold flex items-center justify-center leading-none shadow-xs",
                        active
                          ? "bg-orange-600 text-white"
                          : item.badgeType === "danger"
                          ? "bg-rose-600 text-white"
                          : "bg-white text-orange-700"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold mt-0.5 leading-tight tracking-tight text-center w-full block truncate",
                    active ? "text-orange-700" : "text-white"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
      </div>

      {/* Bottom White Utility Card (Settings & Exit) */}
      {(canAccess("settings") || onLogout) && (
        <div className="mx-1.5 mb-1.5 p-1 rounded-xl bg-white text-slate-800 space-y-0.5 shrink-0">
          {canAccess("settings") && (
            <Link
              href="/settings"
              title="Settings"
              className={cn(
                "flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-all group",
                isActive("/settings", false)
                  ? "bg-orange-50 text-orange-700 font-bold"
                  : "text-slate-700 hover:bg-orange-50/70 hover:text-orange-700"
              )}
            >
              <Settings className={cn("w-3.5 h-3.5 stroke-[2]", isActive("/settings", false) ? "text-orange-600" : "text-slate-700")} />
              <span className="text-[9px] font-bold mt-0.5 leading-tight">Settings</span>
            </Link>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out / Exit"
              className="w-full flex flex-col items-center justify-center py-1 px-1 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 stroke-[2]" />
              <span className="text-[9px] font-bold mt-0.5 leading-tight">Exit</span>
            </button>
          )}
        </div>
      )}

      {/* Footer User Avatar */}
      <div className="py-1.5 px-1.5 border-t border-white/15 flex flex-col items-center text-center shrink-0">
        <div className="relative mb-1">
          <div className="w-7 h-7 rounded-full bg-white text-orange-700 font-bold text-[10px] flex items-center justify-center shadow-xs">
            {user.role === "ADMIN" ? "AD" : user.role === "COURIER" ? (user.courierPartnerId === "ST_COURIER" ? "ST" : user.courierPartnerId === "DTDC" ? "DT" : user.courierPartnerId === "INDIA_POST" ? "IP" : "CR") : (user.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2) : "ST")}
          </div>
          {user.online && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-orange-600" />
          )}
        </div>
        <span className="text-[7.5px] font-bold text-white px-1.5 py-0.5 bg-white/15 rounded border border-white/20 inline-block uppercase tracking-wide">
          {user.role === "ADMIN" ? "Admin" : user.role === "COURIER" ? (user.courierPartnerId === "ST_COURIER" ? "ST Courier" : user.courierPartnerId === "DTDC" ? "DTDC" : user.courierPartnerId === "INDIA_POST" ? "India Post" : "Courier") : "Staff"}
        </span>
      </div>
    </aside>
  );
}
