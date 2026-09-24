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
    timeZone: "Asia/Kolkata",
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

/**
 * Normalizes phone numbers to their last 10 digits for accurate comparison.
 */
export function normalizePhoneDigits(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Format timestamp into exact unified timeline specification, e.g. "24 Sep 08:44 AM"
 */
export function formatTimelineDateTime(dateString?: string): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });
    const time = d.toLocaleString("en-IN", { 
      hour: "2-digit", 
      minute: "2-digit", 
      hour12: true, 
      timeZone: "Asia/Kolkata" 
    });
    return `${day} ${month} ${time}`;
  } catch {
    return dateString;
  }
}

/**
 * Calculate human-readable duration between two stage timestamps.
 * e.g., "1h 20m", "3h 50m", "2h 05m", "25m"
 */
export function formatStageDuration(startIso?: string, endIso?: string): string | null {
  if (!startIso || !endIso) return null;
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;

    const diffMinutes = Math.floor((end - start) / (1000 * 60));
    if (diffMinutes < 1) return "< 1m";

    const days = Math.floor(diffMinutes / (60 * 24));
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
    const mins = diffMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();
    }
    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, "0")}m`;
    }
    return `${mins}m`;
  } catch {
    return null;
  }
}
