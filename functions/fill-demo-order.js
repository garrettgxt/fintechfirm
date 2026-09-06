// Cloudflare Pages Function: executes a pending Demo Mode limit order at
// the given fill price. Called by the client (see the limit-order watcher
// in Dashboard.jsx) the moment it observes a live price crossing an
// order's limit — same "trust the client's already-displayed price"
// reasoning as demo-trade.js, and for the same reason (Binance blocks
// Cloudflare Workers' own server-side calls — see CLAUDE.md).

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Supabase env vars not set" }), { status: 500 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { orderId, fillPrice } = body;
  const price = Number(fillPrice);
  if (!orderId || !Number.isFinite(price) || price <= 0) {
    return new Response(JSON.stringify({ error: "orderId and a positive fillPrice are required" }), { status: 400 });
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/fill_demo_order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_order_id: orderId, p_fill_price: price }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Failed to fill order: ${errText}` }), { status: 502 });
    }

    const result = await res.json();
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
