// Cloudflare Pages Function: creates a pending Demo Mode limit order.
// Unlike demo-trade.js (market orders, execute immediately), this just
// records the order — see fill-demo-order.js for how it actually
// executes once the price crosses, and CLAUDE.md for why that only
// happens while a wallet's own Dashboard tab is open.

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

  const { walletAddress, symbol, assetType, side, quantity, limitPrice } = body;
  const qty = Number(quantity);
  const limit = Number(limitPrice);
  if (
    !walletAddress ||
    !symbol ||
    !assetType ||
    !["buy", "sell"].includes(side) ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return new Response(
      JSON.stringify({ error: "walletAddress, symbol, assetType, side, and positive quantity/limitPrice are required" }),
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/create_demo_order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_wallet: walletAddress,
        p_symbol: symbol,
        p_asset_type: assetType,
        p_side: side,
        p_quantity: qty,
        p_limit_price: limit,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const knownError = ["demo_mode_not_active", "invalid_quantity_or_price", "invalid_side"].find((e) =>
        errText.includes(e)
      );
      return new Response(JSON.stringify({ error: knownError || `Failed to create order: ${errText}` }), {
        status: knownError ? 400 : 502,
      });
    }

    const orderId = await res.json();
    return new Response(JSON.stringify({ ok: true, orderId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
