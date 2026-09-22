import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTimeAgo(dateString: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function getISTDateString(dateInput: Date | string | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  } catch {
    return "";
  }
}

export function matchesDateFilter(
  dateInput: string | Date | undefined,
  dateFilter: string = "All",
  customDate?: string
): boolean {
  // If no filter or All without customDate, match everything
  if ((!dateFilter || dateFilter === "All") && !customDate) {
    return true;
  }

  if (!dateInput) return false;

  const orderIST = getISTDateString(dateInput);
  if (!orderIST) return false;

  // 1. Custom date takes precedence if set
  if (customDate && customDate.trim()) {
    return orderIST === customDate.trim();
  }

  const now = new Date();
  const todayIST = getISTDateString(now);

  switch (dateFilter) {
    case "Today":
      return orderIST === todayIST;

    case "Yesterday": {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayIST = getISTDateString(yesterday);
      return orderIST === yesterdayIST;
    }

    case "Last 7 Days": {
      const orderTime = new Date(dateInput).getTime();
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return orderTime >= sevenDaysAgo;
    }

    case "This Month": {
      const currentMonthIST = todayIST.slice(0, 7); // "YYYY-MM"
      return orderIST.slice(0, 7) === currentMonthIST;
    }

    case "All":
    default:
      return true;
  }
}
