// Cloudflare Pages Function: permanently deletes a wallet and everything
// tied to it, for the admin panel only. Locked behind ADMIN_PASSWORD.
//
// Deletes: wallet_overrides (the account itself), demo_positions,
// demo_orders, demo_withdraw_requests (Demo Mode state), user_credits
// (real Site Credit balance), credit_deposit_requests (pending/reviewed
// deposit claims). Deliberately does NOT touch credit_payments — that's
// the old NOWPayments audit trail, kept as historical financial record
// even when the account it's about is gone.
//
// This is irreversible. There's no undo — the frontend is expected to
// make the admin confirm before ever calling this.

const WALLET_TABLES = [
  "demo_positions",
  "demo_orders",
  "demo_withdraw_requests",
  "credit_deposit_requests",
  "user_credits",
  "wallet_overrides",
];

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

  try {
    for (const table of WALLET_TABLES) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/${table}?wallet_address=eq.${encodeURIComponent(walletAddress)}`,
        {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: "return=minimal" },
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: `Failed to delete from ${table}: ${errText}` }), { status: 502 });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
