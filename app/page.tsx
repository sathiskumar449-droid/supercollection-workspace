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

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { orders, dateFilter, customDate } = useOrderFlow();

  // 1. Packing Station Counts (matches Packing Station's exact criteria: non-NEW, non-RETURN)
  const packingEligibleOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.orderStatus !== "NEW" &&
        o.orderStatus !== "RETURN" &&
        matchesDateFilter(o.createdAt, dateFilter, customDate)
    );
  }, [orders, dateFilter, customDate]);

  const packingCounts = useMemo(() => {
    return {
      processing: packingEligibleOrders.filter((o) => o.orderStatus === "CONFIRMED").length,
      completed: packingEligibleOrders.filter((o) => o.orderStatus === "COMPLETED").length,
      packing: packingEligibleOrders.filter((o) => o.orderStatus === "PACKING").length,
      packed: packingEligibleOrders.filter((o) => o.orderStatus === "PACKED").length,
      dispatched: packingEligibleOrders.filter((o) => o.orderStatus === "DISPATCHED").length,
    };
  }, [packingEligibleOrders]);

  // 3. Courier Hub Counts (matches Courier Hub's exact criteria: dispatched or courier-shipped orders)
  const courierOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!matchesDateFilter(o.createdAt, dateFilter, customDate)) return false;
      if (o.orderStatus === "DISPATCHED") return true;
      if (
        (o.dispatch.courierStatus === "SHIPPED" || (o.dispatch.courierStatus as string) === "DELIVERED") &&
        (Boolean(o.dispatchedAt) || Boolean(o.dispatch.dispatchedAt))
      ) {
        return true;
      }
      return false;
    });
  }, [orders, dateFilter, customDate]);

  const courierCounts = useMemo(() => {
    const shipped = courierOrders.filter(
      (o) => o.dispatch.courierStatus === "SHIPPED"
    ).length;
    const delivered = courierOrders.filter(
      (o) => (o.dispatch.courierStatus as string) === "DELIVERED"
    ).length;
    const missingLlr = courierOrders.filter(
      (o) => !o.dispatch.llrNumber || !o.dispatch.llrNumber.trim()
    ).length;
    // Orders that are in courier pipeline but not yet marked shipped or delivered
    const pending = courierOrders.filter(
      (o) =>
        o.dispatch.courierStatus === "PENDING" ||
        (o.dispatch.courierStatus !== "SHIPPED" && (o.dispatch.courierStatus as string) !== "DELIVERED")
    ).length;

    return {
      pending,
      shipped,
      delivered,
      missingLlr,
    };
  }, [courierOrders]);

  // 4. SMS Monitoring Counts (matches SMS Monitoring criteria: shipped orders tracked in Ping4SMS)
  const shippedOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        matchesDateFilter(o.sms.sentAt || o.createdAt, dateFilter, customDate) &&
        (o.dispatch.courierStatus === "SHIPPED" || (o.dispatch.courierStatus as string) === "DELIVERED") &&
        (Boolean(o.dispatchedAt) || Boolean(o.dispatch.dispatchedAt))
    );
  }, [orders, dateFilter, customDate]);

  const smsCounts = useMemo(() => {
    return {
      pending: shippedOrders.filter((o) => o.sms.status === "PENDING").length,
      sent: shippedOrders.filter((o) => o.sms.status === "SENT").length,
      failed: shippedOrders.filter((o) => o.sms.status === "FAILED").length,
    };
  }, [shippedOrders]);

  // 5. Actionable items for "Needs Attention" section
  const attentionItems = useMemo(() => {
    const items: {
      id: string;
      text: string;
      href: string;
      urgent?: boolean;
    }[] = [];

    // Orders waiting for packing (Processing/Confirmed)
    if (packingCounts.processing > 0) {
      items.push({
        id: "packing-waiting",
        text: `⚠ ${packingCounts.processing} ${
          packingCounts.processing === 1 ? "order" : "orders"
        } waiting for packing`,
        href: "/fulfillment/packing?status=CONFIRMED",
      });
    }

    // Orders missing LLR
    if (courierCounts.missingLlr > 0) {
      items.push({
        id: "missing-llr",
        text: `⚠ ${courierCounts.missingLlr} ${
          courierCounts.missingLlr === 1 ? "order" : "orders"
        } missing LLR`,
        href: "/couriers/st-courier?tab=missing-llr",
      });
    }

    // SMS Delivery Failures
    if (smsCounts.failed > 0) {
      items.push({
        id: "sms-failed",
        text: `⚠ ${smsCounts.failed} ${
          smsCounts.failed === 1 ? "SMS" : "SMS messages"
        } failed`,
        href: "/sms?status=FAILED",
        urgent: true,
      });
    }

    return items;
  }, [packingCounts.processing, courierCounts.missingLlr, smsCounts.failed]);

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
          <p className="text-sm text-slate-500 mt-1">
            Here&apos;s what&apos;s happening with your orders today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
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
        <div className="bg-white border border-orange-400/90 hover:border-orange-500 transition-colors rounded-xl p-5 shadow-xs flex flex-col">
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
                {packingCounts.processing}
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
                {packingCounts.completed}
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
                {packingCounts.packing}
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
                {packingCounts.packed}
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
                {packingCounts.dispatched}
              </span>
            </Link>
          </div>
        </div>

        {/* COURIER CARD */}
        <div className="bg-white border border-orange-400/90 hover:border-orange-500 transition-colors rounded-xl p-5 shadow-xs flex flex-col">
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
              href="/couriers/st-courier"
              className="text-[11px] font-medium text-slate-400 hover:text-orange-600 flex items-center gap-0.5 transition-colors"
            >
              Open
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            <Link
              href="/couriers/st-courier?tab=pending-status"
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
                {courierCounts.pending}
              </span>
            </Link>

            <Link
              href="/couriers/st-courier?tab=shipped"
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
                {courierCounts.shipped}
              </span>
            </Link>

            <Link
              href="/couriers/st-courier?tab=delivered"
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
                {courierCounts.delivered}
              </span>
            </Link>

            <Link
              href="/couriers/st-courier?tab=missing-llr"
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
                  courierCounts.missingLlr > 0 ? "text-amber-700" : "text-slate-900"
                )}
              >
                {courierCounts.missingLlr}
              </span>
            </Link>
          </div>
        </div>

        {/* SMS CARD */}
        <div className="bg-white border border-orange-400/90 hover:border-orange-500 transition-colors rounded-xl p-5 shadow-xs flex flex-col">
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
                {smsCounts.pending}
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
                {smsCounts.sent}
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
                  smsCounts.failed > 0 ? "text-red-600" : "text-slate-900"
                )}
              >
                {smsCounts.failed}
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
