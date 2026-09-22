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
 * 
 * WooCommerce provides:
 * - `created_via`: "checkout" (website), "rest-api", "admin", "phone", etc.
 * - `meta_data`: Array of { key, value } from WooCommerce Order Attribution or custom plugins
 *   e.g. { key: "_wc_order_attribution_utm_source", value: "Whatsapp" }
 *        { key: "_wc_order_attribution_source_type", value: "typein" }
 *        { key: "_wc_order_attribution_origin", value: "Source: Whatsapp" }
 *        { key: "_order_source", value: "whatsapp" }
 */
export function detectWooCommerceSource(wcOrder: any): OrderSource {
  const metaData: Array<{ key: string; value: any }> = wcOrder.meta_data || [];
  const createdVia = (wcOrder.created_via || "").toLowerCase().trim();

  // 1. Check meta_data for explicit source markers (WooCommerce 8.5+ Order Attribution & custom fields)
  for (const meta of metaData) {
    const key = String(meta.key || "").toLowerCase();
    const valStr = String(meta.value || "").toLowerCase().trim();

    if (!valStr) continue;

    // Check if key is related to source / attribution / origin / utm
    const isAttributionKey =
      key.includes("source") ||
      key.includes("attribution") ||
      key.includes("origin") ||
      key.includes("referrer") ||
      key.includes("medium") ||
      key.includes("campaign");

    if (isAttributionKey) {
      if (valStr.includes("whatsapp") || valStr.includes("wa.me") || valStr.includes("whats app")) {
        return "WHATSAPP";
      }
      if (valStr.includes("instagram") || valStr.includes("ig.me") || valStr.includes("ig")) {
        return "INSTAGRAM";
      }
      if (
        valStr === "direct" ||
        valStr.includes("typein") ||
        valStr.includes("walk-in") ||
        valStr.includes("walkin") ||
        valStr.includes("manual")
      ) {
        return "DIRECT";
      }
    }
  }

  // 2. Check created_via field
  if (createdVia === "admin" || createdVia === "phone" || createdVia === "pos") {
    return "DIRECT";
  }

  // "checkout" = standard website purchase, "store-api" = WooCommerce block checkout
  if (createdVia === "checkout" || createdVia === "store-api" || createdVia === "rest-api") {
    return "WEBSITE";
  }

  // 3. Default
  return "WEBSITE";
}
