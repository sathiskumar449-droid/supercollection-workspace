"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { GlobalSearchDialog } from "./global-search-dialog";
import { OrderDetailsDrawer } from "./orders/order-details-drawer";
import { useOrderFlow } from "@/lib/hooks";
import { Order } from "@/types/orderflow";
import { useAuth } from "@/lib/auth-context";
import { LoginScreen } from "./auth/login-screen";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, isAuthenticated, isLoading, logout } = useAuth();

  const {
    orders,
    activeReturnsCount,
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

  // Sync effective user session with authenticated account
  const effectiveUser = React.useMemo(() => {
    if (!authUser) return user;
    return {
      ...user,
      role: authUser.role,
      name: authUser.name || user.name,
      courierPartnerId: authUser.courierPartnerId,
    };
  }, [user, authUser]);

  // Strict route protection: Courier is strictly restricted to /couriers
  useEffect(() => {
    if (isAuthenticated && authUser?.role === "COURIER") {
      if (pathname && !pathname.startsWith("/couriers")) {
        router.replace("/couriers");
      }
    }
  }, [isAuthenticated, authUser, pathname, router]);

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
    if (pathname.startsWith("/returns")) {
      return {
        title: "Returns",
        breadcrumbs: [{ label: "SuperCollection Work Desk" }, { label: "Returns" }],
      };
    }
    if (pathname.startsWith("/couriers")) {
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

  // Verified / Picked-Up Courier Hub orders count
  const courierCount = React.useMemo(() => {
    return orders.filter((o) => {
      const cStatus = o.dispatch?.courierStatus;
      const isPickedUp =
        cStatus === "PICKED_UP" ||
        cStatus === "DELIVERED" ||
        cStatus === "SHIPPED" ||
        Boolean(o.dispatch?.pickedUpAt);

      if (!isPickedUp) return false;
      if (!o.dispatch?.courierPartnerId) return false;
      if (o.orderStatus !== "DISPATCHED" && !Boolean(o.dispatch?.pickedUpAt)) return false;

      if (user.role === "COURIER") {
        return o.dispatch?.courierPartnerId === user.courierPartnerId;
      }
      return true;
    }).length;
  }, [orders, user]);

  // 1. Loading session from storage
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold tracking-wide text-slate-300">
            Loading SuperCollection Work Desk...
          </p>
        </div>
      </div>
    );
  }

  // 2. If not authenticated, render Login Screen
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onSuccess={(role) => {
          if (role === "COURIER") {
            router.replace("/couriers");
          }
        }}
      />
    );
  }

  // 3. Strict privacy & route restriction: Courier user can ONLY access /couriers
  if (authUser?.role === "COURIER" && pathname && !pathname.startsWith("/couriers")) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-700">Redirecting to Courier Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc]">
      {/* Collapsible Sidebar */}
      <Sidebar
        user={effectiveUser}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={logout}
        badgeCounts={{
          packingCount: metrics.confirmedOrders,
          dispatchCount: metrics.packedOrders,
          courierCount,
          stMissingLlr: metrics.stCourierMissingLlr,
          smsFailed: metrics.smsFailed,
          returnsCount: activeReturnsCount,
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          title={pageInfo.title}
          breadcrumbs={pageInfo.breadcrumbs}
          user={effectiveUser}
          onRoleChange={switchRole}
          onOpenSearch={() => setSearchOpen(true)}
          onResetData={resetData}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          customDate={customDate}
          onCustomDateChange={setCustomDate}
          onLogout={logout}
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
        userRole={effectiveUser.role}
        courierPartnerId={effectiveUser.courierPartnerId}
      />
    </div>
  );
}
