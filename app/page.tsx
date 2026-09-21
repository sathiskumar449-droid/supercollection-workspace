"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Clock,
  Package,
  Truck,
  Send,
  ArrowRight,
  ArrowUpRight,
  MessageSquare,
  Globe,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Box,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { OrderStatusBadge, SourceBadge, SmsStatusBadge } from "@/components/ui/status-badge";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { formatINR, cn } from "@/lib/utils";
import { Order } from "@/types/orderflow";

// --- Greeting helper ---
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTodayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// --- Primary KPI Card ---
interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentClass: string;
  href?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  subItems?: { label: string; count: number; href?: string }[];
  note?: string;
}

function KpiCard({ label, value, icon, accentClass, href, trend, subItems, note }: KpiCardProps) {
  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent) => {
    // If user clicked directly on a nested link or button, let that action proceed
    if ((e.target as HTMLElement).closest("a, button")) {
      return;
    }
    if (href) {
      router.push(href);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 h-full transition-all duration-150 select-none",
        href && "hover:border-slate-300 hover:shadow-sm cursor-pointer group"
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("p-2 rounded-lg", accentClass)}>{icon}</div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        )}
      </div>
      <div>
        <div suppressHydrationWarning className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-1">{label}</div>
      </div>
      {trend && (
        <div
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium",
            trend.direction === "up" && "text-emerald-600",
            trend.direction === "down" && "text-red-500",
            trend.direction === "flat" && "text-slate-400"
          )}
        >
          {trend.direction === "up" && <TrendingUp className="w-3 h-3" />}
          {trend.direction === "down" && <TrendingDown className="w-3 h-3" />}
          {trend.direction === "flat" && <Minus className="w-3 h-3" />}
          <span>{trend.label}</span>
        </div>
      )}
      {subItems && subItems.length > 0 && (
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          {subItems.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-orange-600 transition-colors"
              >
                <span suppressHydrationWarning className="font-semibold text-slate-700">{item.count}</span>
                <span>{item.label}</span>
              </Link>
            ) : (
              <span key={item.label} className="flex items-center gap-1 text-[11px] text-slate-500">
                <span suppressHydrationWarning className="font-semibold text-slate-700">{item.count}</span>
                <span>{item.label}</span>
              </span>
            )
          )}
        </div>
      )}
      {note && (
        <div className="mt-auto pt-3 border-t border-slate-100 text-[11px] text-slate-400 leading-snug">{note}</div>
      )}
    </div>
  );
}

// --- Order Flow Stage ---
interface FlowStageProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  dotClass: string;
  href: string;
  isLast?: boolean;
}

function FlowStage({ label, count, icon, dotClass, href, isLast }: FlowStageProps) {
  return (
    <div className="flex items-center flex-1 min-w-0">
      <Link
        href={href}
        className="flex-1 min-w-0 flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all duration-150 group text-center"
      >
        <div className={cn("p-2 rounded-lg transition-colors", dotClass)}>{icon}</div>
        <div suppressHydrationWarning className="text-2xl font-bold text-slate-900 leading-none tracking-tight">{count}</div>
        <div className="text-xs font-medium text-slate-500 group-hover:text-slate-800 transition-colors">{label}</div>
      </Link>
      {!isLast && (
        <div className="flex-shrink-0 px-1 text-slate-300">
          <ChevronRight className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

// --- Attention Row ---
interface AttentionRowProps {
  icon: React.ReactNode;
  badgeClass?: string;
  count: number;
  description: string;
  href: string;
  urgent?: boolean;
}

function AttentionRow({ icon, badgeClass, count, description, href, urgent }: AttentionRowProps) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-all duration-150 group",
        urgent
          ? "border-red-200 bg-red-50/50 hover:bg-red-50 hover:border-red-300"
          : "border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xs"
      )}
    >
      <div className={cn("p-1.5 rounded-md shrink-0 flex items-center justify-center", badgeClass || "bg-slate-100 text-slate-600")}>
        {icon}
      </div>
      <span suppressHydrationWarning className={cn("text-sm font-bold tabular-nums w-6 text-right shrink-0", urgent ? "text-red-600" : "text-slate-800")}>
        {count}
      </span>
      <span className="text-xs text-slate-600 flex-1 min-w-0 font-medium">{description}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}

// --- Main Dashboard ---
export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    orders,
    metrics,
    user,
    updateOrderStatus,
    updateCourierDetails,
  } = useOrderFlow();
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Recent 5 orders for the bottom table
  const recentOrders = orders.slice(0, 5);

  // Source breakdown
  const websiteCount = orders.filter((o) => o.source === "WEBSITE").length;
  const whatsappCount = orders.filter((o) => o.source === "WHATSAPP").length;
  const totalOrders = orders.length;

  // SMS counts
  const smsSent = orders.filter((o) => o.sms.status === "SENT").length;

  // Pending fulfillment = NEW + CONFIRMED + PACKING
  const pendingFulfillment = metrics.newOrders + metrics.confirmedOrders + metrics.packingOrders;

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 pb-8">
      {/* SECTION 1: HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 suppressHydrationWarning className="text-2xl font-bold text-slate-900 tracking-tight leading-tight flex items-center gap-2">
            <span>{mounted ? `${getGreeting()}, ${user.name.split(" ")[0]}` : `Welcome, ${user.name.split(" ")[0]}`}</span>
            <span className="inline-block text-xl">👋</span>
          </h1>
          <p suppressHydrationWarning className="text-sm text-slate-500 mt-0.5">
            Here&apos;s what&apos;s happening with your orders today.
            <span suppressHydrationWarning className="ml-2 text-xs text-slate-400 font-mono">({formatTodayLabel()})</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* SECTION 2: PRIMARY KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Orders"
          value={metrics.todayOrders}
          icon={<ShoppingBag className="w-4 h-4 text-slate-600" />}
          accentClass="bg-slate-100"
          href="/orders"
          trend={{ direction: "up", label: "+14% vs yesterday" }}
        />
        <KpiCard
          label="Pending Fulfillment"
          value={pendingFulfillment}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          accentClass="bg-amber-50"
          href="/orders?status=NEW"
          subItems={[
            { label: "New", count: metrics.newOrders, href: "/orders?status=NEW" },
            { label: "Confirmed", count: metrics.confirmedOrders, href: "/orders?status=CONFIRMED" },
            { label: "Packing", count: metrics.packingOrders, href: "/fulfillment/packing" },
          ]}
        />
        <KpiCard
          label="Ready to Dispatch"
          value={metrics.packedOrders}
          icon={<Package className="w-4 h-4 text-purple-600" />}
          accentClass="bg-purple-50"
          href="/fulfillment/dispatch"
          note={
            metrics.packedOrders > 0
              ? "Packed orders awaiting courier handover"
              : "No orders waiting for dispatch"
          }
        />
        <KpiCard
          label="Dispatched Today"
          value={metrics.dispatchedOrders}
          icon={<Truck className="w-4 h-4 text-emerald-600" />}
          accentClass="bg-emerald-50"
          href="/orders?status=DISPATCHED"
          subItems={[
            { label: "SMS Sent", count: smsSent },
            { label: "SMS Pending", count: metrics.smsPending, href: "/sms?status=PENDING" },
          ]}
        />
      </div>

      {/* SECTION 3: ORDER FLOW */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Order Flow</h2>
            <p className="text-xs text-slate-400 mt-0.5">Live pipeline — click any stage to view those orders</p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
          >
            <span suppressHydrationWarning>All {totalOrders} orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
          <FlowStage
            label="New"
            count={metrics.newOrders}
            icon={<Clock className="w-4 h-4 text-slate-500" />}
            dotClass="bg-slate-100 group-hover:bg-slate-200"
            href="/orders?status=NEW"
          />
          <FlowStage
            label="Confirmed"
            count={metrics.confirmedOrders}
            icon={<CheckCircle2 className="w-4 h-4 text-blue-500" />}
            dotClass="bg-blue-50 group-hover:bg-blue-100"
            href="/orders?status=CONFIRMED"
          />
          <FlowStage
            label="Packing"
            count={metrics.packingOrders}
            icon={<Box className="w-4 h-4 text-orange-500" />}
            dotClass="bg-orange-50 group-hover:bg-orange-100"
            href="/fulfillment/packing"
          />
          <FlowStage
            label="Packed"
            count={metrics.packedOrders}
            icon={<Package className="w-4 h-4 text-purple-500" />}
            dotClass="bg-purple-50 group-hover:bg-purple-100"
            href="/fulfillment/dispatch"
          />
          <FlowStage
            label="Dispatched"
            count={metrics.dispatchedOrders}
            icon={<Truck className="w-4 h-4 text-emerald-600" />}
            dotClass="bg-emerald-50 group-hover:bg-emerald-100"
            href="/orders?status=DISPATCHED"
            isLast
          />
        </div>
      </div>

      {/* SECTION 4 + 5: NEEDS ATTENTION + SUPPORTING INFO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Needs Attention — 4 cols */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-900">Needs Attention</h2>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <AttentionRow
              icon={<Package className="w-3.5 h-3.5 text-orange-600" />}
              badgeClass="bg-orange-50"
              count={metrics.confirmedOrders}
              description="Orders waiting for packing"
              href="/fulfillment/packing"
            />
            <AttentionRow
              icon={<Truck className="w-3.5 h-3.5 text-purple-600" />}
              badgeClass="bg-purple-50"
              count={metrics.packedOrders}
              description="Orders ready for dispatch"
              href="/fulfillment/dispatch"
            />
            <AttentionRow
              icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
              badgeClass="bg-amber-50"
              count={metrics.stCourierMissingLlr}
              description="ST Courier orders missing LLR"
              href="/couriers/st-courier?tab=missing-llr"
            />
            <AttentionRow
              icon={<Send className="w-3.5 h-3.5 text-sky-600" />}
              badgeClass="bg-sky-50"
              count={metrics.smsPending}
              description="SMS messages pending delivery"
              href="/sms?status=PENDING"
            />
            <AttentionRow
              icon={<AlertCircle className="w-3.5 h-3.5 text-red-600" />}
              badgeClass="bg-red-50"
              count={metrics.smsFailed}
              description="SMS delivery failures"
              href="/sms?status=FAILED"
              urgent
            />
            {metrics.confirmedOrders === 0 &&
              metrics.packedOrders === 0 &&
              metrics.stCourierMissingLlr === 0 &&
              metrics.smsPending === 0 &&
              metrics.smsFailed === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm font-medium text-slate-600">All clear</p>
                  <p className="text-xs text-slate-400">No operational issues right now</p>
                </div>
              )}
          </div>
        </div>

        {/* Supporting info — 8 cols, 3 columns inside */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Orders by Source */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Orders by Source</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    Website
                  </span>
                  <span suppressHydrationWarning className="text-xs font-bold text-slate-800 tabular-nums">{websiteCount}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: totalOrders > 0 ? `${(websiteCount / totalOrders) * 100}%` : "0%" }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {totalOrders > 0 ? Math.round((websiteCount / totalOrders) * 100) : 0}% of total
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                    WhatsApp
                  </span>
                  <span suppressHydrationWarning className="text-xs font-bold text-slate-800 tabular-nums">{whatsappCount}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: totalOrders > 0 ? `${(whatsappCount / totalOrders) * 100}%` : "0%" }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {totalOrders > 0 ? Math.round((whatsappCount / totalOrders) * 100) : 0}% of total
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span suppressHydrationWarning className="text-[11px] text-slate-400">{totalOrders} orders total</span>
            </div>
          </div>

          {/* ST Courier */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">ST Courier</h2>
              <Truck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  Missing LLR
                </span>
                <span suppressHydrationWarning className="text-sm font-bold text-amber-700 tabular-nums">{metrics.stCourierMissingLlr}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  Pending
                </span>
                <span suppressHydrationWarning className="text-sm font-bold text-slate-800 tabular-nums">{metrics.stCourierPendingDelivery}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  Shipped
                </span>
                <span suppressHydrationWarning className="text-sm font-bold text-emerald-700 tabular-nums">
                  {orders.filter((o) => o.dispatch.courierName === "ST Courier" && (o.dispatch.courierStatus === "SHIPPED" || (o.dispatch.courierStatus as string) === "DELIVERED")).length}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/couriers/st-courier"
                className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
              >
                View Courier Hub
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Ping4SMS */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Ping4SMS</h2>
              <Send className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  Sent
                </span>
                <span suppressHydrationWarning className="text-sm font-bold text-emerald-700 tabular-nums">{smsSent}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  Pending
                </span>
                <span suppressHydrationWarning className="text-sm font-bold text-amber-700 tabular-nums">{metrics.smsPending}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  Failed
                </span>
                <span suppressHydrationWarning className="text-sm font-bold text-red-600 tabular-nums">{metrics.smsFailed}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
              <p className="text-[11px] text-slate-400 leading-snug">
                Monitoring only — SMS sent externally by Ping4SMS
              </p>
              <Link
                href="/sms"
                className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
              >
                View SMS Monitoring
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: RECENT ORDERS */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent Orders</h2>
            <p className="text-xs text-slate-400 mt-0.5">Last 5 orders across all channels</p>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            View All Orders
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-4 font-medium">Order</th>
                <th className="py-2.5 px-4 font-medium">Customer</th>
                <th className="py-2.5 px-4 font-medium">Source</th>
                <th className="py-2.5 px-4 font-medium">Amount</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Courier</th>
                <th className="py-2.5 px-4 font-medium">SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                  onClick={() => setInspectOrder(order)}
                >
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800 text-[11px]">
                    {order.orderNumber}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{order.customer.name}</td>
                  <td className="py-3 px-4">
                    <SourceBadge source={order.source} />
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{formatINR(order.totalAmount)}</td>
                  <td className="py-3 px-4">
                    <OrderStatusBadge status={order.orderStatus} />
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {order.dispatch.courierName}
                    {order.dispatch.llrNumber && (
                      <span className="ml-1 font-mono text-slate-400 text-[10px]">#{order.dispatch.llrNumber}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <SmsStatusBadge status={order.sms.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Inspect Drawer */}
      <OrderDetailsDrawer
        order={inspectOrder}
        isOpen={Boolean(inspectOrder)}
        onClose={() => setInspectOrder(null)}
        onUpdateStatus={updateOrderStatus}
        onUpdateCourier={updateCourierDetails}
        userRole={user.role}
      />
    </div>
  );
}
