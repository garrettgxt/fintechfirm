// Cloudflare Pages Function: lists a wallet's Demo Mode orders. Used both
// to show pending orders on the Portfolio tab and by the limit-order
// watcher to know what to check against live prices.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const walletAddress = url.searchParams.get("wallet");
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: "wallet parameter is required" }), { status: 400 });
  }

  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Supabase env vars not set" }), { status: 500 });
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/demo_orders?wallet_address=eq.${encodeURIComponent(walletAddress)}&status=eq.pending&select=id,symbol,asset_type,side,quantity,limit_price,created_at&order=created_at.desc`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502 });
    }

    const rows = await res.json();
    return new Response(
      JSON.stringify({
        orders: rows.map((r) => ({
          id: r.id,
          symbol: r.symbol,
          assetType: r.asset_type,
          side: r.side,
          quantity: r.quantity,
          limitPrice: r.limit_price,
          createdAt: r.created_at,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
