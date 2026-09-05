// Cloudflare Pages Function: checks whether a given wallet is in Demo Mode,
// and if so, returns the admin-set demo balance to show instead of the
// real on-chain balance.
//
// This is safe to be publicly reachable — it only returns a mode flag and
// a number, never anything sensitive, and never allows writing.

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

  const res = await fetch(
    `${supabaseUrl}/rest/v1/wallet_overrides?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=demo_mode,demo_balance_usd`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 500 });
  }

  const rows = await res.json();
  const row = rows[0];

  return new Response(
    JSON.stringify({
      demoMode: row?.demo_mode ?? false,
      demoBalanceUsd: row?.demo_balance_usd ?? 0,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
