"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { GlobalSearchDialog } from "./global-search-dialog";
import { OrderDetailsDrawer } from "./orders/order-details-drawer";
import { useOrderFlow } from "@/lib/hooks";
import { Order } from "@/types/orderflow";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    orders,
    user,
    metrics,
    switchRole,
    updateOrderStatus,
    updateCourierDetails,
    resetData,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    customDate,
    setCustomDate,
  } = useOrderFlow();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Dynamic page title and breadcrumbs
  const getPageInfo = () => {
    if (!pathname || pathname === "/") {
      return {
        title: "Dashboard",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "Dashboard" }],
      };
    }
    if (pathname.startsWith("/orders")) {
      return {
        title: "All Orders",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "All Orders" }],
      };
    }
    if (pathname.startsWith("/fulfillment/packing")) {
      return {
        title: "Packing Station",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "Packing Station" }],
      };
    }
    if (pathname.startsWith("/couriers/st-courier")) {
      return {
        title: "Courier Hub",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "Courier Hub" }],
      };
    }
    if (pathname.startsWith("/sms")) {
      return {
        title: "SMS Monitoring",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "SMS Monitoring" }],
      };
    }
    if (pathname.startsWith("/reports")) {
      return {
        title: "Reports & KPIs",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "Reports & KPIs" }],
      };
    }
    if (pathname.startsWith("/settings")) {
      return {
        title: "Settings & Webhooks",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "Settings & Webhooks" }],
      };
    }
    return {
      title: "SuperCollection Work Desk",
      breadcrumbs: [{ label: "SuperCollection Work Desk" }],
    };
  };

  const pageInfo = getPageInfo();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc]">
      {/* Collapsible Sidebar */}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        badgeCounts={{
          packingCount: metrics.confirmedOrders,
          dispatchCount: metrics.packedOrders,
          stMissingLlr: metrics.stCourierMissingLlr,
          smsFailed: metrics.smsFailed,
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          title={pageInfo.title}
          breadcrumbs={pageInfo.breadcrumbs}
          user={user}
          onRoleChange={switchRole}
          onOpenSearch={() => setSearchOpen(true)}
          onResetData={resetData}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          customDate={customDate}
          onCustomDateChange={setCustomDate}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-6">
          {children}
        </main>
      </div>

      {/* Global Command Palette / Search Dialog */}
      <GlobalSearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        orders={orders}
        onSelectOrder={(order) => setActiveOrder(order)}
      />

      {/* Global Order Details Slide-over Drawer */}
      <OrderDetailsDrawer
        order={activeOrder}
        isOpen={Boolean(activeOrder)}
        onClose={() => setActiveOrder(null)}
        onUpdateStatus={updateOrderStatus}
        onUpdateCourier={updateCourierDetails}
        userRole={user.role}
      />
    </div>
  );
}
