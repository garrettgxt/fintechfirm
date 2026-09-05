// Cloudflare Pages Function: lists all registered wallets, for the admin
// panel only. Locked behind ADMIN_PASSWORD.
//
// SETUP (in Cloudflare dashboard):
//   Settings > Environment variables > add:
//     ADMIN_PASSWORD = choose your own password here
//   (in addition to SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
//   register-wallet.js's setup notes)

export async function onRequest(context) {
  const providedPassword = context.request.headers.get("x-admin-password");
  const realPassword = context.env.ADMIN_PASSWORD;

  if (!realPassword || providedPassword !== realPassword) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/wallet_overrides?select=*&order=updated_at.desc`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch wallets" }), { status: 500 });
  }

  const rows = await res.json();
  return new Response(JSON.stringify({ wallets: rows }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
