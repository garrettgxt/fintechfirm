// Cloudflare Pages Function: executes one Demo Mode buy or sell.
//
// This is a simulated internal ledger, not real brokerage execution — no
// real shares or crypto ever change hands. It only ever touches a wallet
// that has demo_mode = true (enforced by apply_demo_trade in Postgres,
// not just here) so a real account's Site Credit is never at risk.
//
// The price used is always fetched fresh, server-side, right before the
// trade — never trusted from the client — so nobody can submit a
// favorable fake price.

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

  const { walletAddress, symbol, assetType, side, quantity } = body;
  const qty = Number(quantity);
  if (!walletAddress || !symbol || !assetType || !["buy", "sell"].includes(side) || !Number.isFinite(qty) || qty <= 0) {
    return new Response(JSON.stringify({ error: "walletAddress, symbol, assetType, side, and a positive quantity are required" }), {
      status: 400,
    });
  }

  try {
    let price;
    if (assetType === "crypto") {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}USDT`);
      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: `Failed to fetch crypto price: HTTP ${res.status} ${errText}` }), { status: 502 });
      }
      const data = await res.json();
      price = parseFloat(data.price);
    } else {
      const apiKey = context.env.TWELVE_DATA_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Market data provider not configured" }), { status: 500 });
      }
      const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`);
      if (!res.ok) return new Response(JSON.stringify({ error: "Failed to fetch market price" }), { status: 502 });
      const data = await res.json();
      price = parseFloat(data.close);
    }

    if (!Number.isFinite(price) || price <= 0) {
      return new Response(JSON.stringify({ error: "Could not determine a current price for this symbol" }), { status: 502 });
    }

    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_demo_trade`, {
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
        p_price: price,
      }),
    });

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      const knownError = ["demo_mode_not_active", "insufficient_cash", "insufficient_position"].find((e) =>
        errText.includes(e)
      );
      return new Response(JSON.stringify({ error: knownError || `Trade failed: ${errText}` }), {
        status: knownError ? 400 : 502,
      });
    }

    const result = await rpcRes.json();
    return new Response(JSON.stringify({ ok: true, price, cashUsd: result.cashUsd }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
