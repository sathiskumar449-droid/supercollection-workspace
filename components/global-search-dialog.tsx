"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight, Package, User, Phone, Tag } from "lucide-react";
import { Order } from "@/types/orderflow";
import { OrderStatusBadge, SourceBadge } from "./ui/status-badge";
import { formatINR } from "@/lib/utils";

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

export function GlobalSearchDialog({
  isOpen,
  onClose,
  orders,
  onSelectOrder,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? orders.filter((o) => {
        return (
          o.orderNumber.toLowerCase().includes(normalized) ||
          o.externalOrderId.toLowerCase().includes(normalized) ||
          o.customer.name.toLowerCase().includes(normalized) ||
          o.customer.mobile.toLowerCase().includes(normalized) ||
          (o.dispatch.llrNumber && o.dispatch.llrNumber.toLowerCase().includes(normalized))
        );
      }).slice(0, 10)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-100">
      <div 
        className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
      >
        <div className="flex items-center px-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Order #, Customer Name, Mobile, or LLR Number..."
            className="w-full px-3 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 ml-2 text-xs font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {!normalized ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              Type an Order Number (e.g. <span className="font-mono text-slate-600 font-medium">OF-9021</span>), customer name, mobile, or LLR to search.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No orders found matching <span className="font-semibold text-slate-800">"{query}"</span>.
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Matching Orders ({filtered.length})
              </div>
              {filtered.map((order) => (
                <div
                  key={order.id}
                  onClick={() => {
                    onSelectOrder(order);
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-700 flex items-center justify-center shrink-0 border border-orange-100">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm text-slate-900">
                          {order.orderNumber}
                        </span>
                        <SourceBadge source={order.source} />
                        <OrderStatusBadge status={order.orderStatus} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 truncate">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <User className="w-3 h-3" />
                          {order.customer.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {order.customer.mobile}
                        </span>
                        {order.dispatch.llrNumber && (
                          <span className="flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                            <Tag className="w-3 h-3" />
                            LLR: {order.dispatch.llrNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatINR(order.totalAmount)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

