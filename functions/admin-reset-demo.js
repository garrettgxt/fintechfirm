// Cloudflare Pages Function: clears a wallet's demo_positions, for the
// admin panel's "Reset portfolio" action. Locked behind ADMIN_PASSWORD,
// same as admin-update.js. Does not touch demo_balance_usd (cash) —
// admin-update.js already handles setting that.

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

  const { walletAddress } = body;
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: "walletAddress is required" }), { status: 400 });
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/demo_positions?wallet_address=eq.${encodeURIComponent(walletAddress)}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
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
