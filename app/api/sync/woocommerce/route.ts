import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { OrderStatus, OrderSource } from "@/types/orderflow";
import { parseWooCommerceDate } from "@/lib/woocommerce-source";

export const dynamic = "force-dynamic";

/**
 * Format a Date object into WooCommerce / WordPress compliant ISO string (YYYY-MM-DDTHH:MM:SS)
 * Strictly without fractional milliseconds (.000Z), which breaks WordPress rest_parse_date_time regex.
 */
function toWcDate(date: Date): string {
  return date.toISOString().split(".")[0];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handleSync({
    rangeType: url.searchParams.get("rangeType") || "last_month",
    startDate: url.searchParams.get("startDate") || undefined,
    endDate: url.searchParams.get("endDate") || undefined,
    storeUrl: url.searchParams.get("storeUrl") || undefined,
  });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }
  return handleSync(body);
}

async function handleSync(body: any) {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({
        success: false,
        error: "Supabase database is not configured.",
      }, { status: 500 });
    }

    const db = supabaseAdmin || supabase;

    let storeUrl = (body.storeUrl || process.env.WOOCOMMERCE_STORE_URL || "https://supercollections.in").trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(storeUrl)) {
      storeUrl = `https://${storeUrl}`;
    }
    let consumerKey = (body.consumerKey || process.env.WOOCOMMERCE_CONSUMER_KEY || "").trim();
    let consumerSecret = (body.consumerSecret || process.env.WOOCOMMERCE_CONSUMER_SECRET || "").trim();

    // If keys not in body or env, check Supabase integrations table
    if (!consumerKey || !consumerSecret) {
      const { data: wcInteg } = await db
        .from("integrations")
        .select("config")
        .eq("name", "woocommerce")
        .maybeSingle();

      if (wcInteg?.config?.consumer_key && wcInteg?.config?.consumer_secret) {
        storeUrl = wcInteg.config.store_url || storeUrl;
        consumerKey = wcInteg.config.consumer_key;
        consumerSecret = wcInteg.config.consumer_secret;
      }
    }

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json({
        error: "Missing WooCommerce API Keys. Please provide consumerKey and consumerSecret.",
        needsKeys: true,
      }, { status: 400 });
    }

    // Persist valid keys to Supabase integrations table for automated server crons and background sync
    try {
      await db.from("integrations").upsert({
        name: "woocommerce",
        config: {
          store_url: storeUrl,
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
        },
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "name" });
    } catch (saveErr) {
      console.warn("Could not persist WooCommerce keys to integrations table:", saveErr);
    }

    // Calculate Date Range
    const rangeType = body.rangeType || "last_month";
    let afterIso: string | undefined = undefined;
    let beforeIso: string | undefined = undefined;

    const now = new Date();
    // Indian Standard Time (IST = UTC + 5:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffsetMs);
    const currentYear = nowIST.getUTCFullYear();
    const currentMonth = nowIST.getUTCMonth(); // 0 = Jan, 9 = Oct

    switch (rangeType) {
      case "last_month": {
        // Full previous calendar month (e.g. Sep 01 00:00:00 to Sep 30 23:59:59 IST)
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1; // 0-indexed
        const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();

        const startUtc = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0) - istOffsetMs);
        const endUtc = new Date(Date.UTC(prevYear, prevMonth, lastDayOfPrevMonth, 23, 59, 59, 999) - istOffsetMs);

        afterIso = toWcDate(startUtc);
        beforeIso = toWcDate(endUtc);
        break;
      }

      case "last_30_days": {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        afterIso = toWcDate(thirtyDaysAgo);
        beforeIso = toWcDate(now);
        break;
      }

      case "this_month": {
        const startUtc = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0) - istOffsetMs);
        afterIso = toWcDate(startUtc);
        beforeIso = toWcDate(now);
        break;
      }

      case "last_2_days": {
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        afterIso = toWcDate(twoDaysAgo);
        beforeIso = toWcDate(now);
        break;
      }

      case "custom": {
        if (body.startDate) {
          afterIso = toWcDate(new Date(`${body.startDate}T00:00:00+05:30`));
        }
        if (body.endDate) {
          beforeIso = toWcDate(new Date(`${body.endDate}T23:59:59+05:30`));
        }
        break;
      }

      case "all":
      default:
        // No date boundaries
        break;
    }

    const authHeader = "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    // Helper: Paginated WooCommerce Fetcher (handles up to 1500 orders per status)
    async function fetchWcOrders(
      status: string | null,
      extraParams: Record<string, string> = {},
      maxPages = 15,
      useDateFilter = true
    ): Promise<any[]> {
      const orders: any[] = [];

      for (let page = 1; page <= maxPages; page++) {
        const url = new URL(`${storeUrl}/wp-json/wc/v3/orders`);
        url.searchParams.set("per_page", "100");
        url.searchParams.set("page", String(page));
        url.searchParams.set("orderby", extraParams.orderby || "date");
        url.searchParams.set("order", extraParams.order || "desc");

        if (status) {
          url.searchParams.set("status", status);
        }
        if (useDateFilter && afterIso) {
          url.searchParams.set("after", afterIso);
        }
        if (useDateFilter && beforeIso) {
          url.searchParams.set("before", beforeIso);
        }

        Object.entries(extraParams).forEach(([k, v]) => {
          if (k !== "orderby" && k !== "order") url.searchParams.set(k, v);
        });

        // Add consumer credentials to query string for hosting environments where Basic Auth is stripped
        url.searchParams.set("consumer_key", consumerKey);
        url.searchParams.set("consumer_secret", consumerSecret);

        try {
          const res = await fetch(url.toString(), {
            headers: { Authorization: authHeader, "Content-Type": "application/json" },
            cache: "no-store",
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.warn(`WooCommerce API page ${page} status ${res.status}:`, errText);
            
            // If date parameter caused a 400 error, fallback without date parameter once
            if (res.status === 400 && useDateFilter) {
              console.log("Date filter rejected by WooCommerce REST API, retrying without date parameter...");
              return fetchWcOrders(status, extraParams, maxPages, false);
            }
            break;
          }

          const pageItems = await res.json();
          if (!Array.isArray(pageItems) || pageItems.length === 0) {
            break;
          }

          orders.push(...pageItems);

          // If less than 100 items returned, we've reached the last page
          if (pageItems.length < 100) {
            break;
          }
        } catch (err) {
          console.error(`Error fetching page ${page} for status ${status}:`, err);
          break;
        }
      }

      return orders;
    }

    // 1. ALWAYS fetch active processing orders (without date restriction, because active pending orders must be fulfilled)
    // 2. Fetch completed orders within the chosen period
    const [processingOrders, completedOrders] = await Promise.all([
      fetchWcOrders("processing", {}, 10, false), // Fetch all active processing orders
      fetchWcOrders("completed", {}, 15, rangeType !== "all"), // Completed orders in selected range
    ]);

    // Also fetch recently modified orders to catch recent status changes
    let modifiedOrders: any[] = [];
    if (rangeType === "last_2_days" || rangeType === "this_month") {
      modifiedOrders = await fetchWcOrders(null, { orderby: "modified", order: "desc" }, 2, false);
    }

    // Deduplicate into a unified list by ID
    const wcOrdersMap = new Map<string, any>();
    if (Array.isArray(completedOrders)) {
      completedOrders.forEach((o: any) => {
        if (o.status === "completed") {
          wcOrdersMap.set(String(o.id || o.number), o);
        }
      });
    }
    if (Array.isArray(modifiedOrders)) {
      modifiedOrders.forEach((o: any) => {
        if (o.status === "processing" || o.status === "completed") {
          wcOrdersMap.set(String(o.id || o.number), o);
        }
      });
    }
    // Active processing orders from WooCommerce take precedence
    if (Array.isArray(processingOrders)) {
      processingOrders.forEach((o: any) => {
        if (o.status === "processing") {
          wcOrdersMap.set(String(o.id || o.number), o);
        }
      });
    }

    const wcOrders = Array.from(wcOrdersMap.values());

    // Purge any previously imported WooCommerce orders with status NEW or RETURN
    await db.from("orders").delete().eq("source", "WEBSITE").in("status", ["NEW", "RETURN"]);

    let syncedCount = 0;

    for (const wc of wcOrders) {
      // Strictly ignore pending, cancelled, refunded, failed, on-hold orders from WooCommerce
      if (wc.status !== "processing" && wc.status !== "completed") {
        continue;
      }

      const wcId = String(wc.id || wc.number);
      const customerName = `${wc.billing?.first_name || ""} ${wc.billing?.last_name || ""}`.trim() || wc.shipping?.first_name || "Online Customer";
      const mobile = (wc.billing?.phone || wc.shipping?.phone || "+91 98000 00000").trim();
      const address = [wc.shipping?.address_1, wc.shipping?.address_2].filter(Boolean).join(", ") || wc.billing?.address_1 || "Customer Address";
      const city = wc.shipping?.city || wc.billing?.city || "Chennai";
      const state = wc.shipping?.state || wc.billing?.state || "Tamil Nadu";
      const pincode = wc.shipping?.postcode || wc.billing?.postcode || "600001";
      const totalAmount = parseFloat(wc.total || "0") || 0;

      // Check if order already exists in Supabase to preserve active fulfillment progression
      const { data: existingOrder } = await db
        .from("orders")
        .select("id, status")
        .eq("external_order_id", wcId)
        .maybeSingle();

      let effectiveStatus: OrderStatus = wc.status === "completed" ? "COMPLETED" : "CONFIRMED";
      if (existingOrder?.status) {
        // Preserve active fulfillment progression so re-syncing does not regress packing status
        const progressionStatuses: OrderStatus[] = ["PACKING", "PACKED", "DISPATCHED"];
        if (progressionStatuses.includes(existingOrder.status as OrderStatus)) {
          effectiveStatus = existingOrder.status as OrderStatus;
        } else if (wc.status === "completed") {
          effectiveStatus = "COMPLETED";
        }
      }

      const paymentStatus = wc.status === "processing" || wc.status === "completed" ? "PAID" : wc.payment_method === "cod" ? "COD" : "PENDING";
      const orderSource: OrderSource = "WEBSITE";

      // 1. Safe Customer Lookup / Upsert (avoid 42P10 constraint error)
      let customerId: string | null = null;
      if (mobile) {
        const { data: existingCustomer } = await db
          .from("customers")
          .select("id")
          .eq("mobile", mobile)
          .maybeSingle();

        if (existingCustomer?.id) {
          customerId = existingCustomer.id;
          await db
            .from("customers")
            .update({
              name: customerName,
              address,
              city,
              state,
              pincode,
              updated_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        }
      }

      if (!customerId) {
        const { data: newCust, error: newCustErr } = await db
          .from("customers")
          .insert({
            name: customerName,
            mobile,
            address,
            city,
            state,
            pincode,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (!newCustErr && newCust) {
          customerId = newCust.id;
        } else {
          console.error("Failed to insert customer:", newCustErr);
        }
      }

      // Fallback customer if needed
      if (!customerId) {
        const { data: fallbackCust } = await db.from("customers").select("id").limit(1).maybeSingle();
        customerId = fallbackCust?.id || null;
      }

      if (!customerId) {
        console.error("Cannot insert order without customer ID for wcId:", wcId);
        continue;
      }

      // 2. Upsert Order
      const orderPayload: any = {
        order_number: `SC-WC-${wcId}`,
        external_order_id: wcId,
        source: orderSource,
        customer_id: customerId,
        status: effectiveStatus,
        payment_status: paymentStatus,
        total_amount: totalAmount,
        created_at: parseWooCommerceDate(wc.date_created_gmt, wc.date_created),
        updated_at: new Date().toISOString(),
      };

      let { data: order, error: orderError } = await (db as any)
        .from("orders")
        .upsert(orderPayload, { onConflict: "source,external_order_id" })
        .select()
        .single();

      // If DB enum does not support DIRECT or INSTAGRAM, fallback safely to WEBSITE
      if (orderError && (orderError.code === "22P02" || orderError.message?.includes("enum"))) {
        orderPayload.source = "WEBSITE";
        const retry = await (db as any)
          .from("orders")
          .upsert(orderPayload, { onConflict: "source,external_order_id" })
          .select()
          .single();
        order = retry.data;
        orderError = retry.error;
      }

      if (!orderError && order) {
        syncedCount++;

        // 3. Insert Items (idempotent, safe deduplication)
        if (wc.line_items && wc.line_items.length > 0) {
          await (db as any).from("order_items").delete().eq("order_id", order.id);

          const { data: remainingItems } = await (db as any)
            .from("order_items")
            .select("id, sku, size, product_name")
            .eq("order_id", order.id);

          const existingKeySet = new Set(
            (remainingItems || []).map((r: any) =>
              `${(r.sku || "").trim().toLowerCase()}__${(r.size || "").trim().toLowerCase()}__${(r.product_name || "").trim().toLowerCase()}`
            )
          );

          const itemsToInsert = wc.line_items
            .map((it: any, idx: number) => ({
              order_id: order.id,
              product_name: it.name || "Product",
              sku: it.sku || `SKU-${idx + 1}`,
              size: it.meta_data?.find((m: any) => m.key?.toLowerCase() === "size" || m.key?.toLowerCase() === "pa_size")?.value || "M",
              quantity: parseInt(it.quantity, 10) || 1,
              unit_price: parseFloat(it.price || "0") || 0,
              subtotal: parseFloat(it.total || "0") || 0,
            }))
            .filter((it: any) => {
              const key = `${it.sku.trim().toLowerCase()}__${it.size.trim().toLowerCase()}__${it.product_name.trim().toLowerCase()}`;
              return !existingKeySet.has(key);
            });

          if (itemsToInsert.length > 0) {
            await (db as any).from("order_items").insert(itemsToInsert);
          }
        }

        // 4. Initial Activity Logs
        const { data: existingLogs } = await db
          .from("activity_logs")
          .select("id, action")
          .eq("order_id", order.id);

        const createdAtTime = parseWooCommerceDate(wc.date_created_gmt, wc.date_created);
        const baseTime = new Date(createdAtTime).getTime();

        if (!existingLogs || existingLogs.length === 0) {
          const initialLogs: any[] = [
            {
              order_id: order.id,
              user_name: "WooCommerce",
              user_role: "SYSTEM",
              action: "Order Created",
              details: "Order created in WooCommerce",
              created_at: new Date(baseTime).toISOString(),
            },
            {
              order_id: order.id,
              user_name: "WooCommerce",
              user_role: "SYSTEM",
              action: "Processing Started",
              details: "Order processing started",
              created_at: new Date(baseTime + 1000).toISOString(),
            },
          ];

          if (wc.status === "completed") {
            const completedTimestamp = parseWooCommerceDate(wc.date_modified_gmt, wc.date_modified) || new Date(baseTime + 2000).toISOString();
            initialLogs.push(
              {
                order_id: order.id,
                user_name: "WooCommerce",
                user_role: "SYSTEM",
                action: "Order Completed",
                details: "Order completed in WooCommerce",
                created_at: completedTimestamp,
              },
              {
                order_id: order.id,
                user_name: "Packing Station",
                user_role: "PACKING_STAFF",
                action: "Waiting for Packing",
                details: "Order completed, waiting for packing in fulfillment station",
                created_at: new Date(new Date(completedTimestamp).getTime() + 1000).toISOString(),
              }
            );
          }

          await db.from("activity_logs").insert(initialLogs);
        } else if (wc.status === "completed") {
          const hasCompletedLog = existingLogs.some(
            (l: any) => l.action?.toLowerCase() === "order completed"
          );
          if (!hasCompletedLog) {
            const completedTimestamp = parseWooCommerceDate(wc.date_modified_gmt, wc.date_modified) || new Date().toISOString();
            await db.from("activity_logs").insert([
              {
                order_id: order.id,
                user_name: "WooCommerce",
                user_role: "SYSTEM",
                action: "Order Completed",
                details: "Order completed in WooCommerce",
                created_at: completedTimestamp,
              },
              {
                order_id: order.id,
                user_name: "Packing Station",
                user_role: "PACKING_STAFF",
                action: "Waiting for Packing",
                details: "Order completed, waiting for packing in fulfillment station",
                created_at: new Date(new Date(completedTimestamp).getTime() + 1000).toISOString(),
              },
            ]);
          }
        }
      } else if (orderError) {
        console.error("Order upsert error for wcId", wcId, orderError);
      }
    }

    // Clean up legacy "Order confirmed" logs and convert to "Order completed"
    await db
      .from("activity_logs")
      .update({ action: "Order completed", details: "Order completed in WooCommerce" })
      .eq("action", "Order confirmed");

    return NextResponse.json({
      success: true,
      syncedCount,
      totalFound: wcOrders.length,
      rangeType,
      dateRange: {
        after: afterIso,
        before: beforeIso,
      },
      message: `Successfully synced ${syncedCount} orders from WooCommerce!`,
    });
  } catch (err: any) {
    console.error("WooCommerce Sync Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
