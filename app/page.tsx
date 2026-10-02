"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Box,
  Truck,
  Send,
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Package,
  Clock,
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { cn, matchesDateFilter } from "@/lib/utils";

// Greeting helper based on time of day
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// User-friendly display label for date filter badge
function getFilterDisplayLabel(dateFilter: string, customDate?: string): string {
  if (customDate && customDate.trim()) {
    try {
      const [y, m, d] = customDate.trim().split("-");
      if (y && m && d) {
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        return dateObj.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    } catch {
      return customDate;
    }
    return customDate;
  }
  if (!dateFilter || dateFilter === "All") return "All Time";
  return dateFilter;
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { orders, returns, dateFilter, customDate } = useOrderFlow();

  // Orders strictly matching the global TopBar date filter / selected custom date
  const dateFilteredOrders = useMemo(() => {
    return orders.filter((o) => matchesDateFilter(o.createdAt, dateFilter, customDate));
  }, [orders, dateFilter, customDate]);

  // Comprehensive metric summary for the selected date
  const summaryCounts = useMemo(() => {
    const total = dateFilteredOrders.length;
    const processing = dateFilteredOrders.filter((o) => o.orderStatus === "CONFIRMED").length;
    const completed = dateFilteredOrders.filter((o) => o.orderStatus === "COMPLETED").length;
    const packing = dateFilteredOrders.filter((o) => o.orderStatus === "PACKING").length;
    const packed = dateFilteredOrders.filter((o) => o.orderStatus === "PACKED").length;
    const dispatched = dateFilteredOrders.filter((o) => o.orderStatus === "DISPATCHED").length;

    // Helper: is order shipped / delivered via courier
    const isShipped = (o: (typeof dateFilteredOrders)[number]) =>
      o.dispatch?.courierStatus === "SHIPPED" ||
      (o.dispatch?.courierStatus as string) === "DELIVERED" ||
      Boolean(o.dispatch?.shippedAt) ||
      Boolean(o.shippedAt) ||
      Boolean(o.dispatch?.llrNumber && o.dispatch.llrNumber.trim());

    // Helper: is order in the courier pipeline (dispatched or picked up or shipped)
    const isCourierPipeline = (o: (typeof dateFilteredOrders)[number]) =>
      o.orderStatus === "DISPATCHED" ||
      o.dispatch?.courierStatus === "PICKED_UP" ||
      o.dispatch?.courierStatus === "WAITING_FOR_PICKUP" ||
      Boolean(o.dispatch?.pickedUpAt) ||
      isShipped(o);

    const courierShipped = dateFilteredOrders.filter(isShipped).length;
    const courierDelivered = dateFilteredOrders.filter(
      (o) => (o.dispatch?.courierStatus as string) === "DELIVERED" || Boolean(o.dispatch?.deliveredAt)
    ).length;
    const courierMissingLlr = dateFilteredOrders.filter(
      (o) => isCourierPipeline(o) && (!o.dispatch?.llrNumber || !o.dispatch.llrNumber.trim())
    ).length;
    const courierPending = dateFilteredOrders.filter(
      (o) => isCourierPipeline(o) && !isShipped(o)
    ).length;

    // SMS metrics
    const smsSent = dateFilteredOrders.filter((o) => o.sms?.status === "SENT").length;
    const smsFailed = dateFilteredOrders.filter((o) => o.sms?.status === "FAILED").length;
    // Dispatched or shipped orders awaiting customer tracking SMS notification
    const smsPending = dateFilteredOrders.filter(
      (o) => isCourierPipeline(o) && o.sms?.status !== "SENT" && o.sms?.status !== "FAILED"
    ).length;

    return {
      total,
      processing,
      completed,
      packing,
      packed,
      dispatched,
      courierPending,
      courierShipped,
      courierDelivered,
      courierMissingLlr,
      smsSent,
      smsPending,
      smsFailed,
    };
  }, [dateFilteredOrders]);

  // Return Management Metrics (filtered by global date filter)
  const returnMetrics = useMemo(() => {
    const filteredReturns = returns.filter((r) => matchesDateFilter(r.createdAt, dateFilter, customDate));
    return {
      returnRequested: filteredReturns.filter((r) => r.status === "Return Requested" || r.status === "Return Approved").length,
      refundPending: filteredReturns.filter((r) => r.returnType === "Refund" && r.status !== "Completed" && r.status !== "Rejected").length,
      replacementPending: filteredReturns.filter((r) => (r.returnType === "Replacement" || r.returnType === "Exchange") && r.status !== "Completed" && r.status !== "Rejected").length,
    };
  }, [returns, dateFilter, customDate]);

  // Actionable items for "Needs Attention" section
  const attentionItems = useMemo(() => {
    const items: {
      id: string;
      text: string;
      href: string;
      urgent?: boolean;
    }[] = [];

    // Orders waiting for packing (Processing/Confirmed)
    if (summaryCounts.processing > 0) {
      items.push({
        id: "packing-waiting",
        text: `⚠ ${summaryCounts.processing} ${
          summaryCounts.processing === 1 ? "order" : "orders"
        } waiting for packing`,
        href: "/fulfillment/packing?status=CONFIRMED",
      });
    }

    // New return requests
    if (returnMetrics.returnRequested > 0) {
      items.push({
        id: "returns-requested",
        text: `⚠️ ${returnMetrics.returnRequested} ${
          returnMetrics.returnRequested === 1 ? "return" : "returns"
        } requested`,
        href: "/returns?status=Return Requested",
      });
    }

    // Refunds pending payout
    if (returnMetrics.refundPending > 0) {
      items.push({
        id: "returns-refund-pending",
        text: `⚠️ ${returnMetrics.refundPending} ${
          returnMetrics.refundPending === 1 ? "refund" : "refunds"
        } pending processing`,
        href: "/returns?status=Refund",
        urgent: true,
      });
    }

    // Replacements waiting for packing
    if (returnMetrics.replacementPending > 0) {
      items.push({
        id: "returns-replacement-pending",
        text: `⚠️ ${returnMetrics.replacementPending} ${
          returnMetrics.replacementPending === 1 ? "exchange" : "exchanges"
        } pending`,
        href: "/returns?status=Exchange",
      });
    }

    // Orders missing LLR
    if (summaryCounts.courierMissingLlr > 0) {
      items.push({
        id: "missing-llr",
        text: `⚠ ${summaryCounts.courierMissingLlr} ${
          summaryCounts.courierMissingLlr === 1 ? "order" : "orders"
        } missing LLR`,
        href: "/couriers?tab=missing-llr",
      });
    }

    // SMS Delivery Failures
    if (summaryCounts.smsFailed > 0) {
      items.push({
        id: "sms-failed",
        text: `⚠ ${summaryCounts.smsFailed} ${
          summaryCounts.smsFailed === 1 ? "SMS" : "SMS messages"
        } failed`,
        href: "/sms?status=FAILED",
        urgent: true,
      });
    }

    return items;
  }, [summaryCounts, returnMetrics]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 border-b border-slate-200/60 pb-5">
        <div>
          <h1
            suppressHydrationWarning
            className="text-2xl font-bold text-slate-900 tracking-tight leading-tight flex items-center gap-2"
          >
            <span>
              {mounted ? getGreeting() : "Welcome"}
            </span>
            <span className="inline-block text-xl">👋</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
            <span>Here&apos;s what&apos;s happening with your orders</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/80">
              {getFilterDisplayLabel(dateFilter, customDate)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* TOTAL ORDERS COUNTER */}
          <Link
            href="/orders"
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all shadow-2xs group"
          >
            <div className="p-1 rounded-md bg-orange-50 text-orange-600 border border-orange-100">
              <Package className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-500">Total Orders:</span>
              <span
                suppressHydrationWarning
                className="font-bold font-mono text-slate-900 group-hover:text-orange-600 text-sm tabular-nums"
              >
                {summaryCounts.total}
              </span>
            </div>
          </Link>

          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* MODULE CARDS (PACKING | COURIER | SMS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* PACKING CARD */}
        <div className="bg-white border border-blue-300 hover:border-blue-400 transition-colors rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                <Box className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Packing
              </h2>
            </div>
            <Link
              href="/fulfillment/packing"
              className="text-[11px] font-medium text-slate-400 hover:text-orange-600 flex items-center gap-0.5 transition-colors"
            >
              Open
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            <Link
              href="/fulfillment/packing?status=CONFIRMED"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Processing
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.processing}
              </span>
            </Link>

            <Link
              href="/fulfillment/packing?status=COMPLETED"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Completed
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.completed}
              </span>
            </Link>

            <Link
              href="/fulfillment/packing?status=PACKING"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Packing
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.packing}
              </span>
            </Link>

            <Link
              href="/fulfillment/packing?status=PACKED"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Packed
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.packed}
              </span>
            </Link>

            <Link
              href="/fulfillment/packing?status=DISPATCHED"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Dispatched
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.dispatched}
              </span>
            </Link>
          </div>
        </div>

        {/* COURIER CARD */}
        <div className="bg-white border border-amber-300 hover:border-amber-400 transition-colors rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
                <Truck className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Courier
              </h2>
            </div>
            <Link
              href="/couriers"
              className="text-[11px] font-medium text-slate-400 hover:text-orange-600 flex items-center gap-0.5 transition-colors"
            >
              Open
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            <Link
              href="/couriers?tab=pending-status"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Pending
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.courierPending}
              </span>
            </Link>

            <Link
              href="/couriers?tab=shipped"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Shipped
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.courierShipped}
              </span>
            </Link>

            <Link
              href="/couriers?tab=delivered"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Delivered
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.courierDelivered}
              </span>
            </Link>

            <Link
              href="/couriers?tab=missing-llr"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Missing LLR
              </span>
              <span
                suppressHydrationWarning
                className={cn(
                  "text-xs font-bold font-mono tabular-nums",
                  summaryCounts.courierMissingLlr > 0 ? "text-amber-700" : "text-slate-900"
                )}
              >
                {summaryCounts.courierMissingLlr}
              </span>
            </Link>
          </div>
        </div>

        {/* SMS CARD */}
        <div className="bg-white border border-emerald-300 hover:border-emerald-400 transition-colors rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                <Send className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                SMS
              </h2>
            </div>
            <Link
              href="/sms"
              className="text-[11px] font-medium text-slate-400 hover:text-orange-600 flex items-center gap-0.5 transition-colors"
            >
              Open
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            <Link
              href="/sms?status=PENDING"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Pending
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.smsPending}
              </span>
            </Link>

            <Link
              href="/sms?status=SENT"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Sent
              </span>
              <span
                suppressHydrationWarning
                className="text-xs font-bold text-slate-900 font-mono group-hover:text-orange-600 tabular-nums"
              >
                {summaryCounts.smsSent}
              </span>
            </Link>

            <Link
              href="/sms?status=FAILED"
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Failed
              </span>
              <span
                suppressHydrationWarning
                className={cn(
                  "text-xs font-bold font-mono tabular-nums",
                  summaryCounts.smsFailed > 0 ? "text-red-600" : "text-slate-900"
                )}
              >
                {summaryCounts.smsFailed}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ROW 3: NEEDS ATTENTION */}
      <div className="bg-white border border-orange-400/90 hover:border-orange-500 transition-colors rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Needs Attention
          </h2>
        </div>

        {attentionItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            {attentionItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-all duration-150 group",
                  item.urgent
                    ? "border-red-200 bg-red-50/50 hover:bg-red-50 hover:border-red-300 text-red-900"
                    : "border-amber-200 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 text-amber-900"
                )}
              >
                <span className="text-xs font-medium flex items-center gap-2">
                  {item.urgent ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{item.text}</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-emerald-100 bg-emerald-50/50 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All good — nothing needs attention.</span>
          </div>
        )}
      </div>
    </div>
  );
}
