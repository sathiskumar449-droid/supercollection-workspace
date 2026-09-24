import React from "react";
import { ReturnStatus, RefundStatus } from "@/types/orderflow";
import { cn } from "@/lib/utils";
import { 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  Box, 
  Package, 
  CheckCheck, 
  AlertCircle, 
  XCircle, 
  RefreshCw,
  Truck,
  ArrowRightLeft
} from "lucide-react";

export function ReturnStatusBadge({ status, className }: { status: ReturnStatus; className?: string }) {
  const configs: Record<ReturnStatus, { label: string; textClass: string; bgClass: string; borderClass: string; icon: React.ReactNode }> = {
    "Return Requested": {
      label: "Return Requested",
      textClass: "text-amber-800",
      bgClass: "bg-amber-50",
      borderClass: "border-amber-200",
      icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
    },
    "Return Approved": {
      label: "Return Approved",
      textClass: "text-sky-800",
      bgClass: "bg-sky-50",
      borderClass: "border-sky-200",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />,
    },
    "Awaiting Return": {
      label: "Awaiting Return",
      textClass: "text-indigo-800",
      bgClass: "bg-indigo-50",
      borderClass: "border-indigo-200",
      icon: <Truck className="w-3.5 h-3.5 text-indigo-600" />,
    },
    "Return Received": {
      label: "Return Received",
      textClass: "text-slate-800",
      bgClass: "bg-slate-100",
      borderClass: "border-slate-300",
      icon: <Box className="w-3.5 h-3.5 text-slate-600" />,
    },
    "QC Pending": {
      label: "QC Pending",
      textClass: "text-orange-800",
      bgClass: "bg-orange-50",
      borderClass: "border-orange-200",
      icon: <AlertCircle className="w-3.5 h-3.5 text-orange-600 animate-pulse" />,
    },
    "QC Approved": {
      label: "QC Approved",
      textClass: "text-emerald-800",
      bgClass: "bg-emerald-50",
      borderClass: "border-emerald-200",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
    "Refund Pending": {
      label: "Refund Pending",
      textClass: "text-rose-800",
      bgClass: "bg-rose-50",
      borderClass: "border-rose-200",
      icon: <RotateCcw className="w-3.5 h-3.5 text-rose-600" />,
    },
    "Refunded": {
      label: "Refunded",
      textClass: "text-emerald-800",
      bgClass: "bg-emerald-50",
      borderClass: "border-emerald-200",
      icon: <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />,
    },
    "Replacement Pending": {
      label: "Replacement Pending",
      textClass: "text-purple-800",
      bgClass: "bg-purple-50",
      borderClass: "border-purple-200",
      icon: <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />,
    },
    "Replacement Dispatched": {
      label: "Replacement Dispatched",
      textClass: "text-teal-800",
      bgClass: "bg-teal-50",
      borderClass: "border-teal-200",
      icon: <Truck className="w-3.5 h-3.5 text-teal-600" />,
    },
    "Completed": {
      label: "Completed",
      textClass: "text-emerald-900 font-bold",
      bgClass: "bg-emerald-100/70",
      borderClass: "border-emerald-300",
      icon: <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />,
    },
    "Rejected": {
      label: "Rejected",
      textClass: "text-red-800",
      bgClass: "bg-red-50",
      borderClass: "border-red-200",
      icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
    },
    "Exchanged": {
      label: "Exchanged",
      textClass: "text-blue-800",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
      icon: <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />,
    },
    "Dispatched": {
      label: "Dispatched",
      textClass: "text-teal-800",
      bgClass: "bg-teal-50",
      borderClass: "border-teal-200",
      icon: <Truck className="w-3.5 h-3.5 text-teal-600" />,
    },
    "Cancelled": {
      label: "Cancelled",
      textClass: "text-slate-600",
      bgClass: "bg-slate-100",
      borderClass: "border-slate-300",
      icon: <XCircle className="w-3.5 h-3.5 text-slate-500" />,
    },
  };

  const c = configs[status] || configs["Return Requested"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border shadow-2xs select-none whitespace-nowrap",
        c.textClass,
        c.bgClass,
        c.borderClass,
        className
      )}
    >
      {c.icon}
      <span>{c.label}</span>
    </span>
  );
}

export function RefundStatusBadge({ status, className }: { status?: RefundStatus; className?: string }) {
  if (!status) return <span className="text-slate-400 text-xs">-</span>;

  const configs: Record<RefundStatus, { label: string; textClass: string; bgClass: string; borderClass: string }> = {
    "Not Started": {
      label: "Not Started",
      textClass: "text-slate-600",
      bgClass: "bg-slate-100",
      borderClass: "border-slate-200",
    },
    "Pending": {
      label: "Pending",
      textClass: "text-amber-800",
      bgClass: "bg-amber-50",
      borderClass: "border-amber-200",
    },
    "Processing": {
      label: "Processing",
      textClass: "text-blue-800",
      bgClass: "bg-blue-50",
      borderClass: "border-blue-200",
    },
    "Refunded": {
      label: "Refunded",
      textClass: "text-emerald-800",
      bgClass: "bg-emerald-50",
      borderClass: "border-emerald-200",
    },
    "Failed": {
      label: "Failed",
      textClass: "text-red-800",
      bgClass: "bg-red-50",
      borderClass: "border-red-200",
    },
  };

  const c = configs[status] || configs.Pending;

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium border select-none whitespace-nowrap",
        c.textClass,
        c.bgClass,
        c.borderClass,
        className
      )}
    >
      {c.label}
    </span>
  );
}

export function ReturnCompactIndicator({
  status,
  returnId,
  onClick,
}: {
  status?: string;
  returnId?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (!status || status === "No Return" || status === "NONE") {
    return (
      <span className="text-[11px] text-slate-400 select-none">-</span>
    );
  }

  // Format compact badge
  let label = status;
  let colorClass = "text-slate-600 bg-slate-50 border-slate-200";

  if (status.includes("Requested")) {
    label = "↩ Requested";
    colorClass = "text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100";
  } else if (status.includes("Awaiting")) {
    label = "↩ Awaiting";
    colorClass = "text-indigo-800 bg-indigo-50 border-indigo-200 hover:bg-indigo-100";
  } else if (status.includes("Received") || status.includes("QC")) {
    label = "↩ Returned";
    colorClass = "text-orange-800 bg-orange-50 border-orange-200 hover:bg-orange-100";
  } else if (status.includes("Refund")) {
    label = "↩ Refund";
    colorClass = "text-rose-800 bg-rose-50 border-rose-200 hover:bg-rose-100";
  } else if (status.includes("Replacement")) {
    label = "↩ Replacement";
    colorClass = "text-purple-800 bg-purple-50 border-purple-200 hover:bg-purple-100";
  } else if (status.includes("Completed")) {
    label = "↩ Closed";
    colorClass = "text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
  }

  return (
    <button
      onClick={onClick}
      title={returnId ? `Return Case: ${returnId} (Click to open details)` : "Click to view return details"}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold border shadow-2xs transition-colors cursor-pointer whitespace-nowrap",
        colorClass
      )}
    >
      <span>{label}</span>
    </button>
  );
}
