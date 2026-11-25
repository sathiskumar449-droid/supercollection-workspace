"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, RefreshCw, Globe, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
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
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("sc_wc_store_url") || "https://supercollections.in";
      const savedKey = localStorage.getItem("sc_wc_consumer_key") || "";
      const savedSecret = localStorage.getItem("sc_wc_consumer_secret") || "";
      
      if (savedUrl) setStoreUrl(savedUrl);
      if (savedKey) setConsumerKey(savedKey);
      if (savedSecret) setConsumerSecret(savedSecret);

      // Default to last_month, never get stuck on old last_2_days
      const savedRange = localStorage.getItem("sc_wc_range_type") as SyncRange;
      if (savedRange && savedRange !== "last_2_days") {
        setRangeType(savedRange);
      } else {
        setRangeType("last_month");
      }
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
        return "All past orders without date filter (Up to 1,500 latest)";
    }
  }, [rangeType, startDate, endDate]);

  if (!isOpen) return null;

  /**
   * Browser-Side WooCommerce Fetcher
   * Fetches orders directly from WooCommerce using the user's browser session.
   * Completely bypasses hosting WAF and Cloudflare datacenter IP blocks!
   */
  const fetchOrdersFromBrowser = async (
    targetStoreUrl: string,
    key: string,
    secret: string,
    range: SyncRange,
    customStart?: string,
    customEnd?: string,
    onProgress?: (msg: string) => void
  ): Promise<any[]> => {
    let cleanUrl = targetStoreUrl.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Calculate IST Date boundaries
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffsetMs);
    const curYear = nowIST.getUTCFullYear();
    const curMonth = nowIST.getUTCMonth();
    const curDay = nowIST.getUTCDate();

    let afterIso: string | undefined = undefined;
    let beforeIso: string | undefined = undefined;

    switch (range) {
      case "last_month": {
        const prevYear = curMonth === 0 ? curYear - 1 : curYear;
        const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
        const lastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
        const mStr = String(prevMonth + 1).padStart(2, "0");
        const dStr = String(lastDay).padStart(2, "0");
        afterIso = `${prevYear}-${mStr}-01T00:00:00`;
        beforeIso = `${prevYear}-${mStr}-${dStr}T23:59:59`;
        break;
      }
      case "last_30_days": {
        const past30 = new Date(nowIST.getTime() - 30 * 24 * 60 * 60 * 1000);
        const y = past30.getUTCFullYear();
        const m = String(past30.getUTCMonth() + 1).padStart(2, "0");
        const d = String(past30.getUTCDate()).padStart(2, "0");
        const curM = String(curMonth + 1).padStart(2, "0");
        const curD = String(curDay).padStart(2, "0");
        afterIso = `${y}-${m}-${d}T00:00:00`;
        beforeIso = `${curYear}-${curM}-${curD}T23:59:59`;
        break;
      }
      case "this_month": {
        const curM = String(curMonth + 1).padStart(2, "0");
        const curD = String(curDay).padStart(2, "0");
        afterIso = `${curYear}-${curM}-01T00:00:00`;
        beforeIso = `${curYear}-${curM}-${curD}T23:59:59`;
        break;
      }
      case "last_2_days": {
        const past2 = new Date(nowIST.getTime() - 2 * 24 * 60 * 60 * 1000);
        const y = past2.getUTCFullYear();
        const m = String(past2.getUTCMonth() + 1).padStart(2, "0");
        const d = String(past2.getUTCDate()).padStart(2, "0");
        const curM = String(curMonth + 1).padStart(2, "0");
        const curD = String(curDay).padStart(2, "0");
        afterIso = `${y}-${m}-${d}T00:00:00`;
        beforeIso = `${curYear}-${curM}-${curD}T23:59:59`;
        break;
      }
      case "custom": {
        if (customStart) afterIso = `${customStart}T00:00:00`;
        if (customEnd) beforeIso = `${customEnd}T23:59:59`;
        break;
      }
      case "all":
      default:
        break;
    }

    const authHeader = "Basic " + btoa(`${key}:${secret}`);

    async function fetchStatus(status: string, useDate: boolean): Promise<any[]> {
      const list: any[] = [];
      for (let page = 1; page <= 10; page++) {
        const u = new URL(`${cleanUrl}/wp-json/wc/v3/orders`);
        u.searchParams.set("per_page", "100");
        u.searchParams.set("page", String(page));
        u.searchParams.set("status", status);
        u.searchParams.set("orderby", "date");
        u.searchParams.set("order", "desc");
        u.searchParams.set("consumer_key", key);
        u.searchParams.set("consumer_secret", secret);
        if (useDate && afterIso) u.searchParams.set("after", afterIso);
        if (useDate && beforeIso) u.searchParams.set("before", beforeIso);

        const res = await fetch(u.toString(), {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.message || "Invalid Consumer Key or Secret (401)");
          }
          if (res.status === 400 && useDate) {
            return fetchStatus(status, false);
          }
          break;
        }

        const items = await res.json();
        if (!Array.isArray(items) || items.length === 0) break;
        list.push(...items);
        if (items.length < 100) break;
      }
      return list;
    }

    onProgress?.("Fetching processing orders from WooCommerce...");
    const processing = await fetchStatus("processing", false);

    onProgress?.("Fetching completed orders from WooCommerce...");
    const completed = await fetchStatus("completed", range !== "all");

    const map = new Map<string, any>();
    [...processing, ...completed].forEach((o) => {
      if (o && (o.id || o.number)) {
        // Strictly only processing and completed orders
        if (o.status === "processing" || o.status === "completed") {
          map.set(String(o.id || o.number), o);
        }
      }
    });

    return Array.from(map.values());
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    const trimmedUrl = storeUrl.trim();
    const trimmedKey = consumerKey.trim();
    const trimmedSecret = consumerSecret.trim();

    if (!trimmedKey || !trimmedSecret) {
      setIsLoading(false);
      setStatusMessage({
        type: "error",
        text: "WooCommerce API keys are not configured. Please add them in Settings → WooCommerce Webhook.",
      });
      return;
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sc_wc_store_url", trimmedUrl);
        localStorage.setItem("sc_wc_consumer_key", trimmedKey);
        localStorage.setItem("sc_wc_consumer_secret", trimmedSecret);
        localStorage.setItem("sc_wc_range_type", rangeType);
      }

      let fetchedOrders: any[] | null = null;

      // 1. Direct browser fetch: completely bypasses hosting WAF & Cloudflare blocks
      try {
        setStatusMessage({
          type: "info",
          text: `Connecting to ${trimmedUrl.replace(/^https?:\/\//, "")} from your browser...`,
        });

        fetchedOrders = await fetchOrdersFromBrowser(
          trimmedUrl,
          trimmedKey,
          trimmedSecret,
          rangeType,
          rangeType === "custom" ? startDate : undefined,
          rangeType === "custom" ? endDate : undefined,
          (msg) => setStatusMessage({ type: "info", text: msg })
        );
      } catch (browserErr: any) {
        console.warn("Direct browser fetch encountered error, will fallback to server fetch:", browserErr);
        if (browserErr.message && (browserErr.message.includes("401") || browserErr.message.toLowerCase().includes("invalid"))) {
          throw new Error(`WooCommerce Authentication Failed: ${browserErr.message}. Please verify your API Key & Secret in Settings.`);
        }
      }

      // 2. Send fetched orders to backend in chunks of 20 to prevent Vercel Serverless Function timeout
      let totalSyncedCount = 0;

      if (fetchedOrders && fetchedOrders.length > 0) {
        const BATCH_SIZE = 20;
        const totalOrders = fetchedOrders.length;
        const totalBatches = Math.ceil(totalOrders / BATCH_SIZE);

        for (let b = 0; b < totalBatches; b++) {
          const start = b * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, totalOrders);
          const chunk = fetchedOrders.slice(start, end);

          setStatusMessage({
            type: "info",
            text: `Saving orders into database (${end} / ${totalOrders})...`,
          });

          const res = await fetch("/api/sync/woocommerce", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orders: chunk,
              isBatch: true,
              batchIndex: b,
              totalBatches,
              storeUrl: trimmedUrl,
              consumerKey: trimmedKey,
              consumerSecret: trimmedSecret,
              rangeType,
              startDate: rangeType === "custom" ? startDate : undefined,
              endDate: rangeType === "custom" ? endDate : undefined,
            }),
          });

          const resText = await res.text();
          let data: any = null;
          try {
            data = JSON.parse(resText);
          } catch {
            throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 100)}`);
          }

          if (!res.ok || !data.success) {
            throw new Error(data.error || `Server error (${res.status}) while saving orders`);
          }

          totalSyncedCount += (typeof data.syncedCount === "number" ? data.syncedCount : chunk.length);
        }
      } else {
        // Fallback: direct server sync
        setStatusMessage({
          type: "info",
          text: "Contacting server to sync orders...",
        });

        const res = await fetch("/api/sync/woocommerce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeUrl: trimmedUrl,
            consumerKey: trimmedKey,
            consumerSecret: trimmedSecret,
            rangeType,
            startDate: rangeType === "custom" ? startDate : undefined,
            endDate: rangeType === "custom" ? endDate : undefined,
          }),
        });

        const resText = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(resText);
        } catch {
          throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 100)}`);
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to sync orders from WooCommerce");
        }

        totalSyncedCount = data.syncedCount || 0;
      }

      // Purge any old local mock orders and reload fresh from Supabase
      orderflowStore.resetData();
      await orderflowStore.refreshFromSupabase();

      const rangeLabel =
        rangeType === "last_month"
          ? "Last Month"
          : rangeType === "last_30_days"
          ? "Last 30 Days"
          : rangeType === "this_month"
          ? "This Month"
          : rangeType === "last_2_days"
          ? "Last 2 Days"
          : rangeType === "all"
          ? "All Time"
          : "Selected Range";

      if (totalSyncedCount === 0) {
        setStatusMessage({
          type: "error",
          text: `0 orders found for ${rangeLabel}. If your orders were placed on different dates, please click "All Orders" or "This Month" above to import them!`,
        });
      } else {
        setStatusMessage({
          type: "success",
          text: `Success! Synced ${totalSyncedCount} orders from WooCommerce (${rangeLabel})!`,
        });

        if (onSyncComplete) {
          onSyncComplete(totalSyncedCount);
        }

        setTimeout(() => {
          onClose();
        }, 2500);
      }
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

  const syncButtonLabel =
    rangeType === "last_month"
      ? "Sync Last Month's Orders Now"
      : rangeType === "last_30_days"
      ? "Sync Last 30 Days Orders Now"
      : rangeType === "this_month"
      ? "Sync This Month's Orders Now"
      : rangeType === "last_2_days"
      ? "Sync Last 2 Days Orders Now"
      : rangeType === "all"
      ? "Sync All Available Orders"
      : "Sync Custom Range Orders";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sync WooCommerce Orders</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSync} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Section 1: Period Selector (Always clearly visible at the top) */}
          <div className="space-y-2 p-3.5 bg-orange-50/40 rounded-xl border border-orange-200/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span>Select Sync Period</span>
              </label>
              <span className="text-[11px] font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                {rangeType === "last_month" ? "⭐ Recommended for 1st Sync" : "Custom Period"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {[
                { id: "last_month", label: "Last Month", desc: "Previous full month" },
                { id: "this_month", label: "This Month", desc: "Current month to date" },
                { id: "last_30_days", label: "Last 30 Days", desc: "Past 30 days" },
                { id: "last_2_days", label: "Last 2 Days", desc: "Today & yesterday" },
                { id: "all", label: "All Orders", desc: "All past records" },
                { id: "custom", label: "Custom Range", desc: "Pick start & end" },
              ].map((item) => {
                const isSelected = rangeType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRangeType(item.id as SyncRange);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("sc_wc_range_type", item.id);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-orange-500 bg-orange-500 text-white font-bold shadow-sm ring-2 ring-orange-500/20"
                        : "border-slate-200 hover:border-orange-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`text-xs font-semibold ${isSelected ? "text-white" : "text-slate-900"}`}>
                      {item.label}
                    </div>
                    <div className={`text-[10px] font-normal leading-tight mt-0.5 ${isSelected ? "text-orange-100" : "text-slate-500"}`}>
                      {item.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Period Preview */}
            <div className="mt-2 p-2 bg-white/90 border border-orange-200 rounded-lg text-xs flex items-center justify-between text-slate-700">
              <span className="text-[11px] text-slate-500 font-medium">Target Date Window:</span>
              <span className="font-bold text-orange-900 text-[11px]">{rangeDescription}</span>
            </div>

            {/* Custom Date Pickers */}
            {rangeType === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Start Date (From)</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">End Date (To)</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Feedback Status */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : statusMessage.type === "info"
                  ? "bg-blue-50 text-blue-800 border border-blue-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === "info" ? (
                <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Actions - Sticky Footer */}
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Syncing Orders..." : syncButtonLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
