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
} from "lucide-react";
import { UserSession } from "@/types/orderflow";
import { cn } from "@/lib/utils";

interface SidebarProps {
  user: UserSession;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
        return ["ADMIN", "MANAGER", "ORDER_STAFF"].includes(user.role);
      case "packing":
        return ["ADMIN", "MANAGER", "PACKING_STAFF"].includes(user.role);
      case "returns":
        return ["ADMIN", "MANAGER", "ORDER_STAFF"].includes(user.role);
      case "courier":
        return ["ADMIN", "MANAGER", "DISPATCH_STAFF", "COURIER"].includes(user.role);
      case "sms":
        return ["ADMIN", "MANAGER", "DISPATCH_STAFF"].includes(user.role);
      case "reports":
        return ["ADMIN", "MANAGER"].includes(user.role);
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
      label: "Orders",
      href: "/orders",
      exact: true,
      icon: ShoppingCart,
      badge: undefined,
      badgeType: "default",
    },
    {
      id: "packing",
      label: "Packing",
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
      id: "reports",
      label: "Reports",
      href: "/reports",
      exact: false,
      icon: BarChart3,
      badge: undefined,
      badgeType: "default",
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
      className="relative flex flex-col w-[92px] sm:w-[100px] border-r border-slate-200 bg-white transition-all select-none z-40 shrink-0 shadow-subtle"
    >
      {/* Brand Header */}
      <div className="py-3.5 px-2 flex flex-col items-center justify-center border-b border-slate-100 bg-white text-center">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-black text-sm shadow-sm ring-2 ring-orange-100 mb-1">
          SC
        </div>
        <span className="font-bold text-slate-900 text-[11px] tracking-tight leading-none block">
          SuperCollection
        </span>
        <span className="text-[9px] font-bold text-orange-600 tracking-wider uppercase block mt-0.5">
          Work Desk
        </span>
      </div>

      {/* Navigation Links: Stacked Icon on Top, Name Below */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-2">
        {navItems.map((item) => {
          if (!canAccess(item.id)) return null;
          const active = isActive(item.href, item.exact);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center text-center py-2.5 px-1 rounded-xl transition-all relative group",
                active
                  ? "bg-orange-500 text-white font-semibold shadow-xs ring-1 ring-orange-400"
                  : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"
              )}
              title={item.label}
            >
              <div className="relative">
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-150 group-hover:scale-110",
                    active ? "text-white" : "text-slate-500 group-hover:text-orange-600"
                  )}
                />
                {mounted && item.badge !== undefined && (
                  <span
                    suppressHydrationWarning
                    className={cn(
                      "absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-xs",
                      active
                        ? "bg-white text-orange-600 ring-1 ring-orange-200"
                        : item.badgeType === "danger"
                        ? "bg-red-500 text-white"
                        : "bg-orange-100 text-orange-800 border border-orange-200"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium mt-1 leading-tight tracking-tight text-center w-full block truncate",
                  active ? "text-white font-semibold" : "text-slate-600 group-hover:text-orange-700"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer User Avatar */}
      <div className="p-2 border-t border-slate-100 bg-slate-50/70 flex flex-col items-center text-center">
        <div className="relative mb-1">
          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-800 font-bold text-xs flex items-center justify-center border border-orange-200 shadow-xs">
            {user.role === "ADMIN" ? "AD" : user.name.split(" ").map((n) => n[0]).join("")}
          </div>
          {user.online && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
          )}
        </div>
        <span className="text-[8px] font-bold text-orange-700 px-1 py-0.5 bg-orange-50 rounded border border-orange-200/60 inline-block uppercase tracking-wide">
          {user.role === "ADMIN" ? "Admin" : user.role === "MANAGER" ? "Mgr" : "Staff"}
        </span>
      </div>
    </aside>
  );
}
