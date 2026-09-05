// Cloudflare Pages Function: updates a wallet's demo_mode / demo_balance_usd,
// for the admin panel only. Locked behind ADMIN_PASSWORD.

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const providedPassword = context.request.headers.get("x-admin-password");
  const realPassword = context.env.ADMIN_PASSWORD;

  if (!realPassword || providedPassword !== realPassword) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { walletAddress, demoMode, demoBalanceUsd } = body;
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: "walletAddress is required" }), { status: 400 });
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/wallet_overrides?wallet_address=eq.${encodeURIComponent(walletAddress)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        demo_mode: demoMode,
        demo_balance_usd: demoBalanceUsd,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    return new Response(JSON.stringify({ error: errText }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
