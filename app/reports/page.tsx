"use client";

import React, { useState, useMemo } from "react";
import { 
  BarChart3, 
  Calendar, 
  Download, 
  TrendingUp, 
  Globe, 
  MessageSquare, 
  Truck, 
  Send, 
  Box, 
  CheckCircle2, 
  Clock, 
  PieChart 
} from "lucide-react";
import { useOrderFlow } from "@/lib/hooks";
import { formatINR, cn, matchesDateFilter } from "@/lib/utils";

export default function ReportsPage() {
  const { orders, dateFilter, setDateFilter, customDate } = useOrderFlow();
  const timeRange = dateFilter || "Today";
  const setTimeRange = (range: string) => setDateFilter(range);

  // Date filtered orders based on TopBar date selector
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => matchesDateFilter(o.createdAt, dateFilter, customDate));
  }, [orders, dateFilter, customDate]);

  // Breakdown statistics
  const totalOrders = filteredOrders.length;
  const totalValue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Source Split
  const websiteOrders = filteredOrders.filter((o) => o.source === "WEBSITE");
  const whatsappOrders = filteredOrders.filter((o) => o.source === "WHATSAPP");

  // Status Split
  const newCount = filteredOrders.filter((o) => o.orderStatus === "NEW").length;
  const confirmedCount = filteredOrders.filter((o) => o.orderStatus === "CONFIRMED").length;
  const packingCount = filteredOrders.filter((o) => o.orderStatus === "PACKING").length;
  const packedCount = filteredOrders.filter((o) => o.orderStatus === "PACKED").length;
  const dispatchedCount = filteredOrders.filter((o) => o.orderStatus === "DISPATCHED").length;

  // Courier Breakdown
  const courierCounts: Record<string, number> = {};
  filteredOrders.forEach((o) => {
    const name = o.dispatch.courierName || "Unassigned";
    courierCounts[name] = (courierCounts[name] || 0) + 1;
  });

  // SMS Breakdown
  const smsSent = filteredOrders.filter((o) => o.sms.status === "SENT").length;
  const smsPending = filteredOrders.filter((o) => o.sms.status === "PENDING").length;
  const smsFailed = filteredOrders.filter((o) => o.sms.status === "FAILED").length;

  // Hourly volume distribution (simulated for today)
  const hourlyBuckets = [
    { hour: "08:00", count: 12 },
    { hour: "09:00", count: 18 },
    { hour: "10:00", count: 24 },
    { hour: "11:00", count: 19 },
    { hour: "12:00", count: 15 },
    { hour: "13:00", count: 8 },
    { hour: "14:00", count: 6 },
  ];
  const maxHourly = Math.max(...hourlyBuckets.map((b) => b.count));

  // CSV Export handler
  const handleExportCsv = () => {
    const headers = ["Order Number,Source,Customer Name,Mobile,Amount,Order Status,Courier,LLR,SMS Status,Created At"];
    const rows = orders.map((o) =>
      [
        o.orderNumber,
        o.source,
        `"${o.customer.name}"`,
        `"${o.customer.mobile}"`,
        o.totalAmount,
        o.orderStatus,
        `"${o.dispatch.courierName}"`,
        `"${o.dispatch.llrNumber || ""}"`,
        o.sms.status,
        o.createdAt,
      ].join(",")
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OrderFlow_Report_${timeRange.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-subtle">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Fulfillment Reports & Operations Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Minimal, executive-level summaries of order pipelines, channel throughput, courier performance, and SMS delivery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            {(["Today", "Yesterday", "Last 7 Days", "Last 30 Days"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium transition-all",
                  timeRange === t ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top 4 Executive Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
          <span className="text-xs font-medium text-slate-500">Total Orders Processed</span>
          <span className="text-2xl font-bold text-slate-900 font-mono block mt-1">
            {totalOrders}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            100% Intake Verification
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
          <span className="text-xs font-medium text-slate-500">Gross Merchandise Value</span>
          <span className="text-2xl font-bold text-slate-900 font-mono block mt-1">
            {formatINR(totalValue)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Avg order: {formatINR(Math.round(totalValue / totalOrders))}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
          <span className="text-xs font-medium text-slate-500">Dispatch Fulfillment Rate</span>
          <span className="text-2xl font-bold text-orange-700 font-mono block mt-1">
            {Math.round((dispatchedCount / totalOrders) * 100)}%
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {dispatchedCount} of {totalOrders} dispatched
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-subtle">
          <span className="text-xs font-medium text-slate-500">SMS Delivery Reliability</span>
          <span className="text-2xl font-bold text-emerald-700 font-mono block mt-1">
            {Math.round((smsSent / totalOrders) * 100)}%
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {smsSent} delivered via Ping4SMS
          </span>
        </div>
      </div>

      {/* Grid: Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Hourly Intake Volume Bar Chart */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hourly Order Volume</h3>
              <p className="text-xs text-slate-500">Intake velocity across warehouse shift hours</p>
            </div>
            <span className="text-xs font-semibold text-slate-700">Peak: 10:00 (24 orders)</span>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
            {hourlyBuckets.map((bucket, i) => {
              const heightPercent = Math.round((bucket.count / maxHourly) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                    {bucket.count}
                  </span>
                  <div className="w-full bg-slate-100 rounded-t-sm h-32 flex items-end">
                    <div
                      className="w-full bg-orange-600 rounded-t-sm group-hover:bg-orange-700 transition-all"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{bucket.hour}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Intake Split */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-subtle space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Channel Distribution</h3>
                <p className="text-xs text-slate-500">Intake breakdown by origin</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    Website (WooCommerce)
                  </span>
                  <span>{websiteOrders.length} Orders ({Math.round((websiteOrders.length / totalOrders) * 100)}%)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${(websiteOrders.length / totalOrders) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Total revenue: {formatINR(websiteOrders.reduce((s, o) => s + o.totalAmount, 0))}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                    Existing WhatsApp Chat Box
                  </span>
                  <span>{whatsappOrders.length} Orders ({Math.round((whatsappOrders.length / totalOrders) * 100)}%)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full"
                    style={{ width: `${(whatsappOrders.length / totalOrders) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Total revenue: {formatINR(whatsappOrders.reduce((s, o) => s + o.totalAmount, 0))}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Orders from both channels flow automatically into the unified fulfillment queue.
          </p>
        </div>

        {/* Courier Allocation Breakdown */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Courier Partner Allocation</h3>
              <p className="text-xs text-slate-500">Parcels routed per carrier</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {Object.entries(courierCounts).map(([courier, count]) => {
              const percent = Math.round((count / totalOrders) * 100);
              return (
                <div key={courier} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{courier}</span>
                    <span className="text-slate-600">
                      {count} parcels ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        courier === "ST Courier" ? "bg-orange-700" : "bg-slate-500"
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Distribution Funnel */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Fulfillment Pipeline Funnel</h3>
              <p className="text-xs text-slate-500">Orders across each operational step</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { label: "New (Unconfirmed)", count: newCount, color: "bg-slate-400" },
              { label: "Confirmed (Ready to Pack)", count: confirmedCount, color: "bg-blue-500" },
              { label: "Packing (At Stations)", count: packingCount, color: "bg-orange-500" },
              { label: "Packed (Ready for Dispatch)", count: packedCount, color: "bg-purple-500" },
              { label: "Dispatched (Handed to Courier)", count: dispatchedCount, color: "bg-emerald-600" },
            ].map((step, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", step.color)} />
                  <span className="font-medium text-slate-800">{step.label}</span>
                </div>
                <span className="font-bold text-slate-900 font-mono">{step.count}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

