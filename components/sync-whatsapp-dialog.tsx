"use client";

import React, { useState, useEffect } from "react";
import { X, RefreshCw, MessageSquare, CheckCircle2, AlertCircle, KeyRound, ExternalLink } from "lucide-react";
import { orderflowStore } from "@/lib/store";

interface SyncWhatsAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (count: number) => void;
}

export function SyncWhatsAppDialog({
  isOpen,
  onClose,
  onSyncComplete,
}: SyncWhatsAppDialogProps) {
  const [apiUrl, setApiUrl] = useState("http://localhost:3001");
  const [syncSecret, setSyncSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("sc_wa_api_url") || "";
      const savedSecret = localStorage.getItem("sc_wa_sync_secret") || "";
      if (savedUrl) setApiUrl(savedUrl);
      if (savedSecret) setSyncSecret(savedSecret);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sc_wa_api_url", apiUrl.trim());
        if (syncSecret.trim()) {
          localStorage.setItem("sc_wa_sync_secret", syncSecret.trim());
        }
      }

      const res = await fetch("/api/sync/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: apiUrl.trim(),
          syncSecret: syncSecret.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to sync orders from WhatsApp");
      }

      // Refresh data in store
      await orderflowStore.refreshFromSupabase();

      setStatusMessage({
        type: "success",
        text: `Success! Synced ${data.syncedCount} WhatsApp orders (last 2 days).`,
      });

      if (onSyncComplete) {
        onSyncComplete(data.syncedCount);
      }

      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error("WhatsApp Sync Error:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Connection failed. Please check WhatsApp App URL and Sync Secret.",
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
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sync WhatsApp Orders (Last 2 Days)</h3>
              <p className="text-xs text-slate-500">Import recent orders from WhatsApp Chat Box integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSync} className="p-6 space-y-4">
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60 text-xs text-emerald-900 flex items-start gap-2.5">
            <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">2-Day Window Direct Integration</p>
              <p className="text-emerald-800 mt-0.5 leading-relaxed">
                Connects to <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[11px]">GET /api/integrations/workdesk/orders?since=...</code> using your shared <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[11px]">WORKDESK_SYNC_SECRET</code>. Future orders arrive automatically via webhook.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Chat Box App URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="http://localhost:3001"
                  required
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white text-slate-800 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Base URL of your WhatsApp Chat Box app or server
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sync Secret (WORKDESK_SYNC_SECRET)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={syncSecret}
                  onChange={(e) => setSyncSecret(e.target.value)}
                  placeholder="Leave empty to use WORKDESK_SYNC_SECRET from .env.local"
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white text-slate-800 transition-all font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Shared secret key matching WORKDESK_SYNC_SECRET
              </p>
            </div>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Fetching WhatsApp Orders..." : "Sync Last 2 Days"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
