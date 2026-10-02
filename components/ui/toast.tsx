"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const TOAST_EVENT = "app-global-toast";

/**
 * Trigger a floating notification popup on the side from anywhere in the application.
 */
export function showToast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  const event = new CustomEvent(TOAST_EVENT, {
    detail: {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      type,
    },
  });
  window.dispatchEvent(event);
}

/**
 * Global Toast Container that floats on the side of the screen.
 * Mounts in AppShell so all pages automatically have side popup notifications.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastItem>;
      if (!customEvent.detail) return;
      const newToast = customEvent.detail;

      setToasts((prev) => [...prev.slice(-3), newToast]);

      // Auto dismiss after 3.5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 3500);
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-right-8 fade-in",
              toast.type === "error"
                ? "bg-rose-950/95 text-rose-50 border-rose-800 shadow-rose-950/30"
                : toast.type === "warning"
                ? "bg-amber-950/95 text-amber-50 border-amber-800 shadow-amber-950/30"
                : toast.type === "info"
                ? "bg-slate-900/95 text-white border-slate-700 shadow-black/40"
                : "bg-slate-900/95 text-white border-slate-700/80 shadow-black/40"
            )}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : toast.type === "warning" ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : toast.type === "info" ? (
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 text-xs font-semibold leading-relaxed pr-1 text-slate-100">
              {toast.message}
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
