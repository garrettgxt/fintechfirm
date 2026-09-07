// Cloudflare Pages Function: returns a wallet's demo cash balance, demo
// positions, and its most recent withdrawal request of ANY status (see
// create-demo-withdraw-request.js). Not just the pending one: once it's
// resolved, the Dashboard still needs to show the outcome (an "approved"
// or "rejected" banner) rather than the request just silently vanishing.
//
// AUTO-APPROVAL: a Demo Mode withdrawal that's still 'pending' 30+
// seconds after it was created is flipped to 'approved' right here (no
// background job needed — Cloudflare Pages has no cron anyway, same
// constraint as limit orders, see CLAUDE.md) the next time anything
// fetches this wallet's portfolio. An admin can still manually
// approve/reject sooner via /admin — that just means this check finds
// the row already resolved and does nothing. The amount was already
// escrowed out of demo_balance_usd when the request was created, so
// approval (auto or manual) never touches the balance again.
const AUTO_APPROVE_MS = 30_000;

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
        `${supabaseUrl}/rest/v1/demo_withdraw_requests?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=id,amount_usd,status,created_at,reviewed_at&order=created_at.desc&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      ),
    ]);

    if (!overrideRes.ok || !positionsRes.ok || !withdrawRes.ok) {
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502 });
    }

    const overrideRows = await overrideRes.json();
    const positions = await positionsRes.json();
    let [withdrawRow] = await withdrawRes.json();
    const wallet = overrideRows[0];

    if (withdrawRow?.status === "pending" && Date.now() - new Date(withdrawRow.created_at).getTime() >= AUTO_APPROVE_MS) {
      const reviewedAt = new Date().toISOString();
      const patchRes = await fetch(`${supabaseUrl}/rest/v1/demo_withdraw_requests?id=eq.${withdrawRow.id}&status=eq.pending`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({ status: "approved", reviewed_at: reviewedAt }),
      });
      if (patchRes.ok) {
        const [updated] = await patchRes.json();
        if (updated) withdrawRow = updated;
      }
    }

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
        withdrawal: withdrawRow
          ? {
              id: withdrawRow.id,
              amountUsd: withdrawRow.amount_usd,
              status: withdrawRow.status,
              createdAt: withdrawRow.created_at,
              reviewedAt: withdrawRow.reviewed_at,
            }
          : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
