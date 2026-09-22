import React from "react";
import { OrderStatus, CourierStatus, SmsStatus, OrderSource } from "@/types/orderflow";
import { cn } from "@/lib/utils";
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Send, 
  AlertCircle, 
  Globe, 
  MessageSquare,
  Box,
  Instagram,
  User
} from "lucide-react";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const configs: Record<OrderStatus, { label: string; text: string; icon: React.ReactNode }> = {
    NEW: {
      label: "New",
      text: "text-slate-600",
      icon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
    },
    CONFIRMED: {
      label: "Processing",
      text: "text-sky-600",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />,
    },
    PACKING: {
      label: "Packaging",
      text: "text-orange-600",
      icon: <Box className="w-3.5 h-3.5 text-orange-600 animate-pulse" />,
    },
    PACKED: {
      label: "Packed",
      text: "text-purple-600",
      icon: <Package className="w-3.5 h-3.5 text-purple-600" />,
    },
    DISPATCHED: {
      label: "Dispatched",
      text: "text-emerald-600",
      icon: <Truck className="w-3.5 h-3.5 text-emerald-600" />,
    },
    COMPLETED: {
      label: "Completed",
      text: "text-emerald-600",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
    RETURN: {
      label: "Return",
      text: "text-rose-600",
      icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
    },
  };

  const c = configs[status] || configs.NEW;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold select-none",
        c.text,
        className
      )}
    >
      {c.icon}
      <span>{c.label}</span>
    </span>
  );
}

export function CourierStatusBadge({ status, className }: { status: CourierStatus; className?: string }) {
  const configs: Record<CourierStatus, { label: string; text: string; dotClass: string }> = {
    PENDING: {
      label: "Pending",
      text: "text-amber-600",
      dotClass: "bg-amber-500",
    },
    SHIPPED: {
      label: "Shipped",
      text: "text-emerald-600",
      dotClass: "bg-emerald-500",
    },
    DISPATCHED: {
      label: "Shipped",
      text: "text-emerald-600",
      dotClass: "bg-emerald-500",
    },
    DELIVERED: {
      label: "Shipped",
      text: "text-emerald-600",
      dotClass: "bg-emerald-500",
    },
  };

  const c = configs[status] || configs.PENDING;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold select-none",
        c.text,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dotClass)} />
      <span>{c.label}</span>
    </span>
  );
}

export function SmsStatusBadge({ status, className }: { status: SmsStatus; className?: string }) {
  const configs: Record<SmsStatus, { label: string; text: string; icon: React.ReactNode }> = {
    SENT: {
      label: "Sent",
      text: "text-emerald-600",
      icon: <Send className="w-3 h-3 text-emerald-600" />,
    },
    PENDING: {
      label: "Pending",
      text: "text-amber-600",
      icon: <Clock className="w-3 h-3 text-amber-600" />,
    },
    FAILED: {
      label: "Failed",
      text: "text-red-600",
      icon: <AlertCircle className="w-3 h-3 text-red-600" />,
    },
  };

  const c = configs[status] || configs.PENDING;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold select-none",
        c.text,
        className
      )}
      title={`Ping4SMS Delivery Status: ${c.label}`}
    >
      {c.icon}
      <span>{c.label}</span>
    </span>
  );
}

export function SourceBadge({ source, className }: { source: OrderSource; className?: string }) {
  const configs: Record<OrderSource, { label: string; textClass: string; icon: React.ReactNode }> = {
    WEBSITE: {
      label: "Website",
      textClass: "text-blue-600",
      icon: <Globe className="w-3.5 h-3.5 text-blue-500" />,
    },
    WHATSAPP: {
      label: "WhatsApp",
      textClass: "text-emerald-600",
      icon: <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />,
    },
    INSTAGRAM: {
      label: "Instagram",
      textClass: "text-fuchsia-600",
      icon: <Instagram className="w-3.5 h-3.5 text-fuchsia-500" />,
    },
    DIRECT: {
      label: "Direct",
      textClass: "text-amber-700",
      icon: <User className="w-3.5 h-3.5 text-amber-500" />,
    },
  };

  const c = configs[source] || configs.WEBSITE;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold select-none",
        c.textClass,
        className
      )}
    >
      {c.icon}
      <span>{c.label}</span>
    </span>
  );
}

