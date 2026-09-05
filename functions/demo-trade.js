// Cloudflare Pages Function: executes one Demo Mode buy or sell.
//
// This is a simulated internal ledger, not real brokerage execution — no
// real shares or crypto ever change hands. It only ever touches a wallet
// that has demo_mode = true (enforced by apply_demo_trade in Postgres,
// not just here) so a real account's Site Credit is never at risk.
//
// The price comes from the client, not a fresh server-side fetch —
// deliberately. Binance's API (which chart/price data already uses) is
// fronted by CloudFront and returns a 403 "Request blocked" to Cloudflare
// Workers' own outbound IPs specifically (confirmed in production
// testing — browser calls to Binance work fine, server-side ones don't),
// so re-fetching a price here isn't reliably possible. Trusting the
// client's already-displayed quote is an acceptable tradeoff ONLY because
// this never touches real money: apply_demo_trade hard-requires
// demo_mode = true, so the worst case is a demo user giving themselves a
// slightly favorable price in their own play-money portfolio.

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

  const { walletAddress, symbol, assetType, side, quantity, price } = body;
  const qty = Number(quantity);
  const px = Number(price);
  if (
    !walletAddress ||
    !symbol ||
    !assetType ||
    !["buy", "sell"].includes(side) ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(px) ||
    px <= 0
  ) {
    return new Response(
      JSON.stringify({ error: "walletAddress, symbol, assetType, side, and positive quantity/price are required" }),
      { status: 400 }
    );
  }

  try {
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
        p_price: px,
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
    return new Response(JSON.stringify({ ok: true, price: px, cashUsd: result.cashUsd }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
