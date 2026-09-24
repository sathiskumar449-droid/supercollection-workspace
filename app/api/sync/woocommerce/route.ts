import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { OrderStatus } from "@/types/orderflow";
import { detectWooCommerceSource, parseWooCommerceDate } from "@/lib/woocommerce-source";

/**
 * WooCommerce 2-Day Live Sync Endpoint
 * Connects to WooCommerce REST API and imports only the last 2 days' orders directly into Supabase.
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional if env variables exist
    }

    let storeUrl = (body.storeUrl || process.env.WOOCOMMERCE_STORE_URL || "https://supercollections.in").trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(storeUrl)) {
      storeUrl = `https://${storeUrl}`;
    }
    const consumerKey = (body.consumerKey || process.env.WOOCOMMERCE_CONSUMER_KEY || "").trim();
    const consumerSecret = (body.consumerSecret || process.env.WOOCOMMERCE_CONSUMER_SECRET || "").trim();

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json({
        error: "Missing WooCommerce API Keys. Please provide consumerKey and consumerSecret.",
        needsKeys: true,
      }, { status: 400 });
    }

    // Limit sync strictly to the last 2 days (today & yesterday)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);
    const afterIso = twoDaysAgo.toISOString();

    // Call WooCommerce REST API using BOTH query params and Basic Auth header for maximum compatibility
    const authHeader = "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const wcApiUrl = `${storeUrl}/wp-json/wc/v3/orders?per_page=100&status=any&after=${encodeURIComponent(afterIso)}&consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}`;

    const res = await fetch(wcApiUrl, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        error: `WooCommerce API Error (${res.status}): ${errText}`,
      }, { status: res.status });
    }

    const wcOrders = await res.json();
    if (!Array.isArray(wcOrders)) {
      return NextResponse.json({ error: "Invalid response from WooCommerce API" }, { status: 502 });
    }

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({
        success: false,
        error: "Supabase database is not configured.",
      }, { status: 500 });
    }

    const db = supabaseAdmin || supabase;

    // Purge old orders older than 2 days so only last 2 days orders remain in the app
    await db.from("orders").delete().lt("created_at", afterIso);

    // Default ST Courier ID
    const { data: stCourier } = await db
      .from("couriers")
      .select("id")
      .eq("code", "ST_COURIER")
      .maybeSingle();

    const defaultCourierId = stCourier?.id || null;
    let syncedCount = 0;

    for (const wc of wcOrders) {
      const wcId = String(wc.id || wc.number);
      const customerName = `${wc.billing?.first_name || ""} ${wc.billing?.last_name || ""}`.trim() || wc.shipping?.first_name || "Online Customer";
      const mobile = (wc.billing?.phone || wc.shipping?.phone || "+91 98000 00000").trim();
      const address = [wc.shipping?.address_1, wc.shipping?.address_2].filter(Boolean).join(", ") || wc.billing?.address_1 || "Customer Address";
      const city = wc.shipping?.city || wc.billing?.city || "Chennai";
      const state = wc.shipping?.state || wc.billing?.state || "Tamil Nadu";
      const pincode = wc.shipping?.postcode || wc.billing?.postcode || "600001";
      const totalAmount = parseFloat(wc.total || "0") || 0;

      // Status mapping
      let orderStatus: OrderStatus = "NEW";
      if (wc.status === "completed") orderStatus = "COMPLETED";
      else if (wc.status === "processing") orderStatus = "CONFIRMED";
      else if (wc.status === "cancelled" || wc.status === "refunded" || wc.status === "failed") orderStatus = "RETURN";
      else orderStatus = "NEW";

      const paymentStatus = wc.status === "processing" || wc.status === "completed" ? "PAID" : wc.payment_method === "cod" ? "COD" : "PENDING";
      const courierStatus = "PENDING"; // Synced orders start as PENDING courier status; only dispatched orders from packing reach courier hub

      // All WooCommerce orders are strictly WEBSITE source
      const orderSource: OrderSource = "WEBSITE";

      // 1. Safe Customer Lookup / Upsert (avoid 42P10 constraint error)
      let customerId: string | null = null;
      if (mobile) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("mobile", mobile)
          .maybeSingle();

        if (existingCustomer?.id) {
          customerId = existingCustomer.id;
          await supabase
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
        const { data: newCust, error: newCustErr } = await supabase
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
        const { data: fallbackCust } = await supabase.from("customers").select("id").limit(1).maybeSingle();
        customerId = fallbackCust?.id || null;
      }

      if (!customerId) {
        console.error("Cannot insert order without customer ID for wcId:", wcId);
        continue;
      }

      // Check if order already exists in Supabase to preserve active fulfillment progression
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, status")
        .eq("external_order_id", wcId)
        .maybeSingle();

      let effectiveStatus: any = orderStatus;
      if (existingOrder?.status) {
        const advancedStatuses = ["PACKING", "PACKED", "DISPATCHED"];
        if (advancedStatuses.includes(existingOrder.status)) {
          effectiveStatus = existingOrder.status;
        }
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

      let { data: order, error: orderError } = await (supabase as any)
        .from("orders")
        .upsert(orderPayload, { onConflict: "source,external_order_id" })
        .select()
        .single();

      // If DB enum does not support DIRECT or INSTAGRAM, fallback safely to WEBSITE
      if (orderError && (orderError.code === "22P02" || orderError.message?.includes("enum"))) {
        orderPayload.source = "WEBSITE";
        const retry = await (supabase as any)
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

        // 4. Initial Activity Logs (Section 2 & 3: Order Created, Processing Started, and Order Completed / Ready for Packing if completed)
        // DO NOT automatically create Courier Hub dispatch record or assign ST Courier (Section 7)
        const { data: existingLogs } = await supabase
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

          await supabase.from("activity_logs").insert(initialLogs);
        } else if (wc.status === "completed") {
          // If order already existed in DB and WooCommerce now marks it completed
          const hasCompletedLog = existingLogs.some(
            (l: any) => l.action?.toLowerCase() === "order completed"
          );
          if (!hasCompletedLog) {
            const completedTimestamp = parseWooCommerceDate(wc.date_modified_gmt, wc.date_modified) || new Date().toISOString();
            await supabase.from("activity_logs").insert([
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

    // Clean up premature logs for orders still in CONFIRMED (processing) or NEW status
    const { data: pendingOrders } = await db
      .from("orders")
      .select("id")
      .in("status", ["CONFIRMED", "NEW"]);

    if (pendingOrders && pendingOrders.length > 0) {
      const pendingIds = pendingOrders.map((o) => o.id);
      await db
        .from("activity_logs")
        .delete()
        .in("order_id", pendingIds)
        .in("action", ["Order completed", "Order confirmed", "Waiting for packing"]);
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      message: `Successfully synced ${syncedCount} live orders from WooCommerce!`,
    });
  } catch (err: any) {
    console.error("WooCommerce Sync Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
