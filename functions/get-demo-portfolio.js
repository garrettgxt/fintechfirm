// Cloudflare Pages Function: returns a wallet's demo cash balance, demo
// positions, and any pending withdrawal request (see
// create-demo-withdraw-request.js — withdrawals need admin approval, so
// the Dashboard needs to know if one is outstanding to show the
// "Withdrawal pending" banner). The frontend computes current market
// value itself from quotes it already has (live crypto prices / polled
// stock-forex quotes) rather than this function fetching prices too —
// avoids duplicate calls.

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
    const [overrideRes, positionsRes, withdrawRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/wallet_overrides?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=demo_mode,demo_balance_usd`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/demo_positions?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=symbol,asset_type,quantity,avg_cost_usd`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/demo_withdraw_requests?wallet_address=eq.${encodeURIComponent(walletAddress)}&status=eq.pending&select=id,amount_usd,created_at`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ),
    ]);

    if (!overrideRes.ok || !positionsRes.ok || !withdrawRes.ok) {
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502 });
    }

    const overrideRows = await overrideRes.json();
    const positions = await positionsRes.json();
    const [pendingWithdrawRow] = await withdrawRes.json();
    const wallet = overrideRows[0];

    return new Response(
      JSON.stringify({
        demoMode: wallet?.demo_mode ?? false,
        cashUsd: wallet?.demo_balance_usd ?? 0,
        positions: positions.map((p) => ({
          symbol: p.symbol,
          assetType: p.asset_type,
          quantity: p.quantity,
          avgCost: p.avg_cost_usd,
        })),
        pendingWithdrawal: pendingWithdrawRow
          ? { id: pendingWithdrawRow.id, amountUsd: pendingWithdrawRow.amount_usd, createdAt: pendingWithdrawRow.created_at }
          : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
