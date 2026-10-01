"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, RefreshCw, Globe, CheckCircle2, AlertCircle, KeyRound, ExternalLink, Calendar, Copy, Check, Sparkles } from "lucide-react";
import { orderflowStore } from "@/lib/store";

interface SyncWooCommerceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (count: number) => void;
}

type SyncRange = "last_month" | "last_30_days" | "this_month" | "last_2_days" | "custom" | "all";

export function SyncWooCommerceDialog({
  isOpen,
  onClose,
  onSyncComplete,
}: SyncWooCommerceDialogProps) {
  const [storeUrl, setStoreUrl] = useState("https://supercollections.in");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [rangeType, setRangeType] = useState<SyncRange>("last_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("sc_wc_store_url") || "https://supercollections.in";
      const savedKey = localStorage.getItem("sc_wc_consumer_key") || "";
      const savedSecret = localStorage.getItem("sc_wc_consumer_secret") || "";
      const savedRange = (localStorage.getItem("sc_wc_range_type") as SyncRange) || "last_month";
      
      if (savedUrl) setStoreUrl(savedUrl);
      if (savedKey) setConsumerKey(savedKey);
      if (savedSecret) setConsumerSecret(savedSecret);
      if (savedRange) setRangeType(savedRange);
    }
  }, [isOpen]);

  // Compute Human-Readable Preview for the selected range
  const rangeDescription = useMemo(() => {
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffsetMs);
    const curYear = nowIST.getUTCFullYear();
    const curMonth = nowIST.getUTCMonth(); // 0-11

    const formatD = (d: Date) =>
      d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

    switch (rangeType) {
      case "last_month": {
        const prevYear = curMonth === 0 ? curYear - 1 : curYear;
        const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
        const lastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
        const start = new Date(Date.UTC(prevYear, prevMonth, 1));
        const end = new Date(Date.UTC(prevYear, prevMonth, lastDay));
        return `${formatD(start)} — ${formatD(end)} (Full Previous Month)`;
      }
      case "last_30_days": {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return `${formatD(past30)} — ${formatD(now)} (Rolling 30 Days)`;
      }
      case "this_month": {
        const start = new Date(Date.UTC(curYear, curMonth, 1));
        return `${formatD(start)} — ${formatD(now)} (Current Month to Date)`;
      }
      case "last_2_days": {
        const past2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        return `${formatD(past2)} — ${formatD(now)} (Today & Yesterday)`;
      }
      case "custom": {
        if (startDate && endDate) {
          return `${startDate} — ${endDate}`;
        }
        return "Select custom Start Date and End Date below";
      }
      case "all":
      default:
        return "All available past orders (Up to 1,500 latest)";
    }
  }, [rangeType, startDate, endDate]);

  if (!isOpen) return null;

  const handleCopyWebhook = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://supercollection-workspace.vercel.app";
    const webhookUrl = `${origin}/api/webhooks/woocommerce`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sc_wc_store_url", storeUrl.trim());
        localStorage.setItem("sc_wc_consumer_key", consumerKey.trim());
        localStorage.setItem("sc_wc_consumer_secret", consumerSecret.trim());
        localStorage.setItem("sc_wc_range_type", rangeType);
      }

      const res = await fetch("/api/sync/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeUrl: storeUrl.trim(),
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
          rangeType,
          startDate: rangeType === "custom" ? startDate : undefined,
          endDate: rangeType === "custom" ? endDate : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to sync orders from WooCommerce");
      }

      // Purge any old local mock orders and reload fresh from Supabase
      orderflowStore.resetData();
      await orderflowStore.refreshFromSupabase();

      setStatusMessage({
        type: "success",
        text: `Success! Synced ${data.syncedCount} orders from WooCommerce (${data.rangeType?.replace("_", " ") || "chosen range"})!`,
      });

      if (onSyncComplete) {
        onSyncComplete(data.syncedCount);
      }

      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error("WooCommerce Sync Error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Connection failed. Please verify your Consumer Key and Secret.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sync WooCommerce Orders</h3>
              <p className="text-xs text-slate-500">Import orders from supercollections.in directly into Work Desk</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSync} className="p-6 space-y-4 overflow-y-auto">
          {/* Sync Period Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-600" />
                <span>Select Sync Period (Date Range)</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">Pick Last Month for 1st time sync</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "last_month", label: "Last Month", desc: "Previous full month", isRecommended: true },
                { id: "last_30_days", label: "Last 30 Days", desc: "Rolling 30 days" },
                { id: "this_month", label: "This Month", desc: "Current month" },
                { id: "last_2_days", label: "Last 2 Days", desc: "Today & yesterday" },
                { id: "custom", label: "Custom Range", desc: "Pick start & end" },
                { id: "all", label: "All Orders", desc: "All past records" },
              ].map((item) => {
                const isSelected = rangeType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRangeType(item.id as SyncRange)}
                    className={`relative p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-orange-500 bg-orange-50/80 ring-2 ring-orange-500/20 text-orange-950 font-semibold shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {item.isRecommended && (
                      <span className="absolute -top-2 right-2 px-1.5 py-0.5 bg-orange-600 text-white rounded-full text-[9px] font-bold tracking-tight shadow-2xs flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        Selected
                      </span>
                    )}
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{item.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Date Range Preview Badge */}
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs flex items-center justify-between text-slate-600">
              <span className="text-[11px] text-slate-500">Date Window:</span>
              <span className="font-semibold text-slate-800 text-[11px]">{rangeDescription}</span>
            </div>

            {/* Custom Date Pickers */}
            {rangeType === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Start Date (From)</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">End Date (To)</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Credentials */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store URL
              </label>
              <input
                type="url"
                required
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50 font-mono text-slate-700"
                placeholder="https://supercollections.in"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Consumer Key
                </label>
                <a
                  href="https://supercollections.in/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                >
                  <span>Get Keys from WordPress</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Consumer Secret
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                  placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
            </div>
          </div>

          {/* Automatic Daily Sync Info Box */}
          <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-xl border border-amber-200/80 text-xs text-amber-950 space-y-2">
            <div className="font-bold flex items-center justify-between text-amber-900">
              <span className="flex items-center gap-1.5">
                <span>⚡ Daily Automatic Update (Zero Manual Clicks)</span>
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Once you sync past orders, new daily orders can appear automatically in two ways:
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 bg-white/90 rounded-lg border border-amber-200">
                <div className="font-semibold text-amber-900 flex items-center justify-between mb-1">
                  <span>1. Instant Live Webhook (Recommended)</span>
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="text-[10px] text-orange-700 hover:text-orange-900 flex items-center gap-1 font-medium px-2 py-0.5 bg-orange-100/70 hover:bg-orange-100 rounded cursor-pointer"
                  >
                    {copiedWebhook ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWebhook ? "Copied URL!" : "Copy Webhook URL"}</span>
                  </button>
                </div>
                <p className="text-slate-500 text-[10px] mb-1">
                  In WordPress: <b>WooCommerce → Settings → Advanced → Webhooks</b>. Add webhook with Topic <i>Order created</i> and <i>Order updated</i>.
                </p>
                <div className="font-mono text-[10px] text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 select-all break-all">
                  https://supercollection-workspace.vercel.app/api/webhooks/woocommerce
                </div>
              </div>

              <div className="p-2 bg-white/90 rounded-lg border border-amber-200">
                <span className="font-semibold text-amber-900 block mb-0.5">2. Scheduled Daily Cron & Background Sync</span>
                <p className="text-slate-500 text-[10px]">
                  Saving your keys here also enables the automated daily server sync to fetch daily orders every 24 hours.
                </p>
              </div>
            </div>
          </div>

          {/* Feedback Status */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>
                {isLoading
                  ? "Syncing Orders from WooCommerce..."
                  : rangeType === "last_month"
                  ? "Sync Last Month's Orders Now"
                  : rangeType === "last_30_days"
                  ? "Sync Last 30 Days Orders Now"
                  : rangeType === "custom"
                  ? "Sync Custom Range Orders Now"
                  : "Sync Selected Orders Now"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
