// Cloudflare Pages Function: returns a wallet's current site-credit
// balance (see admin-review-deposit.js for how it gets incremented —
// manual admin approval, now that NOWPayments is gone).
// This is a custodial balance held by Coinstate Capital, separate from
// the user's real on-chain wallet holdings.

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
      `${supabaseUrl}/rest/v1/user_credits?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=balance_usd`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502 });
    }

    const rows = await res.json();
    return new Response(
      JSON.stringify({ balanceUsd: rows[0]?.balance_usd ?? 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
