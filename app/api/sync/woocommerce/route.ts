import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { OrderStatus, OrderSource } from "@/types/orderflow";
import { parseWooCommerceDate } from "@/lib/woocommerce-source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    // Calculate Date Range in IST (Asia/Kolkata UTC+5:30)
    const rangeType = body.rangeType || "last_month";
    let afterIso: string | undefined = undefined;
    let beforeIso: string | undefined = undefined;

    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffsetMs);
    const currentYear = nowIST.getUTCFullYear();
    const currentMonth = nowIST.getUTCMonth(); // 0 = Jan, 8 = Sep, 9 = Oct
    const currentDay = nowIST.getUTCDate();

    switch (rangeType) {
      case "last_month": {
        // Full previous calendar month (e.g. Sep 01 00:00:00 to Sep 30 23:59:59 IST)
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1; // 0-indexed
        const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
        const mStr = String(prevMonth + 1).padStart(2, "0");
        const dStr = String(lastDayOfPrevMonth).padStart(2, "0");

        afterIso = `${prevYear}-${mStr}-01T00:00:00`;
        beforeIso = `${prevYear}-${mStr}-${dStr}T23:59:59`;
        break;
      }

      case "last_30_days": {
        const past30IST = new Date(nowIST.getTime() - 30 * 24 * 60 * 60 * 1000);
        const y = past30IST.getUTCFullYear();
        const m = String(past30IST.getUTCMonth() + 1).padStart(2, "0");
        const d = String(past30IST.getUTCDate()).padStart(2, "0");
        const curM = String(currentMonth + 1).padStart(2, "0");
        const curD = String(currentDay).padStart(2, "0");

        afterIso = `${y}-${m}-${d}T00:00:00`;
        beforeIso = `${currentYear}-${curM}-${curD}T23:59:59`;
        break;
      }

      case "this_month": {
        const curM = String(currentMonth + 1).padStart(2, "0");
        const curD = String(currentDay).padStart(2, "0");
        afterIso = `${currentYear}-${curM}-01T00:00:00`;
        beforeIso = `${currentYear}-${curM}-${curD}T23:59:59`;
        break;
      }

      case "last_2_days": {
        const past2IST = new Date(nowIST.getTime() - 2 * 24 * 60 * 60 * 1000);
        const y = past2IST.getUTCFullYear();
        const m = String(past2IST.getUTCMonth() + 1).padStart(2, "0");
        const d = String(past2IST.getUTCDate()).padStart(2, "0");
        const curM = String(currentMonth + 1).padStart(2, "0");
        const curD = String(currentDay).padStart(2, "0");

        afterIso = `${y}-${m}-${d}T00:00:00`;
        beforeIso = `${currentYear}-${curM}-${curD}T23:59:59`;
        break;
      }

      case "custom": {
        if (body.startDate) {
          afterIso = `${body.startDate}T00:00:00`;
        }
        if (body.endDate) {
          beforeIso = `${body.endDate}T23:59:59`;
        }
        break;
      }

      case "all":
      default:
        // No date boundaries
        break;
    }

    let wcOrders: any[] = [];

    // 1. If orders were fetched directly by client-side browser (which bypasses hosting WAF & Cloudflare blocks), use them directly
    if (body.orders && Array.isArray(body.orders)) {
      console.log(`[WooCommerce Sync] Using ${body.orders.length} orders passed directly from client browser sync`);
      const wcOrdersMap = new Map<string, any>();
      body.orders.forEach((o: any) => {
        if (o && (o.id || o.number)) {
          wcOrdersMap.set(String(o.id || o.number), o);
        }
      });
      wcOrders = Array.from(wcOrdersMap.values());
    } else {
      // 2. Server-side fetch fallback
      const authHeader = "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
      let had403Block = false;

      // Helper: Paginated WooCommerce Fetcher (handles up to 1500 orders per status)
      async function fetchWcOrders(
        status: string,
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
          url.searchParams.set("status", status);

          if (useDateFilter && afterIso) {
            url.searchParams.set("after", afterIso);
          }
          if (useDateFilter && beforeIso) {
            url.searchParams.set("before", beforeIso);
          }

          Object.entries(extraParams).forEach(([k, v]) => {
            if (k !== "orderby" && k !== "order") url.searchParams.set(k, v);
          });

          // Pass credentials in query params AND Authorization header for maximum host compatibility
          url.searchParams.set("consumer_key", consumerKey);
          url.searchParams.set("consumer_secret", consumerSecret);

          try {
            const res = await fetch(url.toString(), {
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                Accept: "application/json, text/plain, */*",
              },
              cache: "no-store",
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => "");
              console.warn(`WooCommerce API [${status}] page ${page} status ${res.status}:`, errText.slice(0, 200));
              
              if (res.status === 400 && useDateFilter) {
                console.log("Date filter rejected by WooCommerce REST API, retrying without date parameter...");
                return fetchWcOrders(status, extraParams, maxPages, false);
              }

              if (res.status === 403) {
                had403Block = true;
                console.warn(`WAF/Firewall blocked server request for status=${status}`);
                return orders;
              }

              if (res.status === 401) {
                let parsedErr: any = null;
                try { parsedErr = JSON.parse(errText); } catch {}
                const errorMsg = parsedErr?.message || "Invalid credentials";
                throw new Error(`WooCommerce API Authentication Failed (401): ${errorMsg}. Please verify your Consumer Key and Consumer Secret.`);
              }

              if (page === 1) {
                let parsedErr: any = null;
                try { parsedErr = JSON.parse(errText); } catch {}
                const errorMsg = parsedErr?.message || `HTTP ${res.status}`;
                throw new Error(`WooCommerce API Error (${res.status}): ${errorMsg}`);
              }
              break;
            }

            const pageItems = await res.json();
            if (!Array.isArray(pageItems) || pageItems.length === 0) {
              break;
            }

            orders.push(...pageItems);

            if (pageItems.length < 100) {
              break;
            }
          } catch (err: any) {
            if (err.message && err.message.includes("WooCommerce")) {
              throw err;
            }
            console.error(`Error fetching page ${page} for status ${status}:`, err);
            if (page === 1) {
              throw new Error(`Connection to WooCommerce failed: ${err.message || "Network error"}`);
            }
            break;
          }
        }

        return orders;
      }

      // Fetch only processing and completed WooCommerce statuses
      const statusesToFetch = ["processing", "completed"];
      const fetchPromises = statusesToFetch.map((st) => {
        if (st === "completed") {
          return fetchWcOrders(st, {}, 15, rangeType !== "all");
        }
        return fetchWcOrders(st, {}, 10, false);
      });
      const fetchResults = await Promise.all(fetchPromises);

      // Deduplicate into a unified list by WooCommerce order ID
      const wcOrdersMap = new Map<string, any>();
      fetchResults.forEach((resultArray) => {
        if (Array.isArray(resultArray)) {
          resultArray.forEach((o: any) => {
            wcOrdersMap.set(String(o.id || o.number), o);
          });
        }
      });

      wcOrders = Array.from(wcOrdersMap.values());

      if (wcOrders.length === 0 && had403Block) {
        throw new Error(
          "WooCommerce Server Block (403): Your WordPress hosting firewall / Cloudflare blocked the cloud server from fetching orders. Please use the 'Sync Website' button in your browser to import orders directly."
        );
      }
    }

    // Purge any previously imported WooCommerce orders with status NEW or RETURN
    // Only purge when not in a sub-batch, or on the first batch (batchIndex === 0)
    if (!body.isBatch || body.batchIndex === 0) {
      await db.from("orders").delete().eq("source", "WEBSITE").in("status", ["NEW", "RETURN"]);
    }

    let syncedCount = 0;
    const customerCache = new Map<string, string>();

    for (const wc of wcOrders) {
      // Strictly allow ONLY processing and completed orders from WooCommerce
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
      if (mobile && customerCache.has(mobile)) {
        customerId = customerCache.get(mobile)!;
      } else if (mobile) {
        const { data: existingCustomer } = await db
          .from("customers")
          .select("id")
          .eq("mobile", mobile)
          .maybeSingle();

        if (existingCustomer?.id) {
          customerId = existingCustomer.id;
          customerCache.set(mobile, customerId);
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
          if (mobile) customerCache.set(mobile, customerId);
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

        // 3. Insert Items (idempotent, clean refresh)
        if (wc.line_items && wc.line_items.length > 0) {
          await (db as any).from("order_items").delete().eq("order_id", order.id);

          const itemsToInsert = wc.line_items.map((it: any, idx: number) => ({
            order_id: order.id,
            product_name: it.name || "Product",
            sku: it.sku || `SKU-${idx + 1}`,
            size: it.meta_data?.find((m: any) => m.key?.toLowerCase() === "size" || m.key?.toLowerCase() === "pa_size")?.value || "M",
            quantity: parseInt(it.quantity, 10) || 1,
            unit_price: parseFloat(it.price || "0") || 0,
            subtotal: parseFloat(it.total || "0") || 0,
          }));

          if (itemsToInsert.length > 0) {
            await (db as any).from("order_items").insert(itemsToInsert);
          }
        }

        // 4. Initial Activity Logs
        if (!existingOrder) {
          const createdAtTime = parseWooCommerceDate(wc.date_created_gmt, wc.date_created);
          const baseTime = new Date(createdAtTime).getTime();

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

    const message =
      syncedCount > 0
        ? `Successfully synced ${syncedCount} orders from WooCommerce!`
        : `0 orders found for ${rangeType.replace(/_/g, " ")}. If your orders are in other months, please select "All Orders" or "This Month".`;

    return NextResponse.json({
      success: true,
      syncedCount,
      totalFound: wcOrders.length,
      rangeType,
      dateRange: {
        after: afterIso,
        before: beforeIso,
      },
      message,
    });
  } catch (err: any) {
    console.error("WooCommerce Sync Error:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Server error while connecting to WooCommerce",
    }, { status: 500 });
  }
}
