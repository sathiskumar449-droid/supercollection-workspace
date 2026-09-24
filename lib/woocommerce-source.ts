import { OrderSource } from "@/types/orderflow";

/**
 * Parse WooCommerce date strings into an ISO string in UTC.
 * 
 * WooCommerce provides:
 * - date_created_gmt: UTC timestamp e.g. "2026-09-22T05:35:13" (without Z suffix)
 * - date_created: Store local timestamp (IST / +05:30) e.g. "2026-09-22T11:05:13" (without offset)
 * 
 * In Node/Vercel (which runs in UTC timezone), `new Date("2026-09-22T11:05:13")`
 * misinterprets the local IST time as UTC, causing a +5:30 offset bug when converted to IST.
 */
export function parseWooCommerceDate(dateCreatedGmt?: string | null, dateCreated?: string | null): string {
  // 1. If date_created_gmt is provided (UTC from WooCommerce)
  if (dateCreatedGmt && typeof dateCreatedGmt === "string" && dateCreatedGmt.trim()) {
    const trimmed = dateCreatedGmt.trim();
    const gmtStr = trimmed.endsWith("Z") ? trimmed : `${trimmed}Z`;
    const d = new Date(gmtStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // 2. If only date_created is provided (store local time: Indian Standard Time UTC+05:30)
  if (dateCreated && typeof dateCreated === "string" && dateCreated.trim()) {
    const str = dateCreated.trim();
    // If it already has Z or explicit timezone offset (+05:30, etc.)
    if (str.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.toISOString();
    } else {
      // Append IST offset +05:30
      const d = new Date(`${str}+05:30`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  return new Date().toISOString();
}

/**
 * Detect the order source from WooCommerce order data.
 * All orders from WooCommerce are strictly "WEBSITE".
 * Only orders from WhatsApp Chat Box app are "WHATSAPP".
 */
export function detectWooCommerceSource(_wcOrder?: any): OrderSource {
  return "WEBSITE";
}
