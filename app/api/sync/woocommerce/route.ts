import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

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
      let orderStatus: "NEW" | "CONFIRMED" | "COMPLETED" | "RETURN" = "NEW";
      if (wc.status === "completed") orderStatus = "COMPLETED";
      else if (wc.status === "processing") orderStatus = "CONFIRMED";
      else if (wc.status === "cancelled" || wc.status === "refunded" || wc.status === "failed") orderStatus = "RETURN";
      else orderStatus = "NEW";

      const paymentStatus = wc.status === "processing" || wc.status === "completed" ? "PAID" : wc.payment_method === "cod" ? "COD" : "PENDING";
      const courierStatus = "PENDING"; // Synced orders start as PENDING courier status; only dispatched orders from packing reach courier hub

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

      // 2. Upsert Order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .upsert({
          order_number: `SC-WC-${wcId}`,
          external_order_id: wcId,
          source: "WEBSITE",
          customer_id: customerId,
          status: orderStatus,
          payment_status: paymentStatus,
          total_amount: totalAmount,
          created_at: wc.date_created ? new Date(wc.date_created).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "source,external_order_id" })
        .select()
        .single();

      if (!orderError && order) {
        syncedCount++;

        // 3. Insert Items
        if (wc.line_items && wc.line_items.length > 0) {
          await supabase.from("order_items").delete().eq("order_id", order.id);
          await supabase.from("order_items").insert(
            wc.line_items.map((it: any, idx: number) => ({
              order_id: order.id,
              product_name: it.name || "Product",
              sku: it.sku || `SKU-${idx + 1}`,
              size: it.meta_data?.find((m: any) => m.key?.toLowerCase() === "size" || m.key?.toLowerCase() === "pa_size")?.value || "M",
              quantity: parseInt(it.quantity, 10) || 1,
              unit_price: parseFloat(it.price || "0") || 0,
              subtotal: parseFloat(it.total || "0") || 0,
            }))
          );
        }

        // 4. Ensure Dispatch record exists without overwriting staff updates
        const { data: existingDisp } = await supabase
          .from("dispatches")
          .select("id")
          .eq("order_id", order.id)
          .maybeSingle();

        if (!existingDisp) {
          await supabase.from("dispatches").insert({
            order_id: order.id,
            courier_id: defaultCourierId,
            courier_status: "PENDING",
          });
        }

        // 5. Activity Log (Only for initial order creation, avoid duplicate sync logs)
        const { data: existingLogs } = await supabase
          .from("activity_logs")
          .select("id")
          .eq("order_id", order.id)
          .limit(1);

        if (!existingLogs || existingLogs.length === 0) {
          const createdAtTime = wc.date_created ? new Date(wc.date_created).toISOString() : new Date().toISOString();
          await supabase.from("activity_logs").insert({
            order_id: order.id,
            user_name: "Website",
            user_role: "ORDER_STAFF",
            action: "Order created",
            details: "Order received from website",
            created_at: createdAtTime,
          });
        }
      } else if (orderError) {
        console.error("Order upsert error for wcId", wcId, orderError);
      }
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
