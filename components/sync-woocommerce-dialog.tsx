"use client";

import React, { useState, useEffect } from "react";
import { X, RefreshCw, Globe, CheckCircle2, AlertCircle, KeyRound, ExternalLink } from "lucide-react";
import { orderflowStore } from "@/lib/store";

interface SyncWooCommerceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (count: number) => void;
}

export function SyncWooCommerceDialog({
  isOpen,
  onClose,
  onSyncComplete,
}: SyncWooCommerceDialogProps) {
  const [storeUrl, setStoreUrl] = useState("https://supercollections.in");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("sc_wc_consumer_key") || "";
      const savedSecret = localStorage.getItem("sc_wc_consumer_secret") || "";
      if (savedKey) setConsumerKey(savedKey);
      if (savedSecret) setConsumerSecret(savedSecret);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sc_wc_consumer_key", consumerKey.trim());
        localStorage.setItem("sc_wc_consumer_secret", consumerSecret.trim());
      }

      const res = await fetch("/api/sync/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeUrl: storeUrl.trim(),
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
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
        text: `Success! Imported ${data.syncedCount} live orders from ${storeUrl}!`,
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
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sync Website Orders</h3>
              <p className="text-xs text-slate-500">Import existing live orders from supercollections.in</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSync} className="p-6 space-y-4">
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
            <p className="text-[11px] text-slate-400 mt-1">
              Found in: <b>WooCommerce → Settings → Advanced → REST API → Add key</b>
            </p>
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
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Syncing Orders..." : "Sync All Orders Now"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
