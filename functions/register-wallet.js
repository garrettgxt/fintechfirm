// Cloudflare Pages Function: registers a wallet address + email the first
// time someone logs in, so the admin panel has something to list.
//
// SETUP (in Cloudflare dashboard, not in this file):
//   Settings > Environment variables > add:
//     SUPABASE_URL = https://your-project.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY = (from Supabase Project Settings > API —
//       the "service_role" key, NOT the anon key. This key bypasses all
//       row-level security, so it must only ever live here, server-side.
//       Never put it in any file, never in src/, never in the browser.)

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

  const { walletAddress, email } = body;
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: "walletAddress is required" }), { status: 400 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/wallet_overrides`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "resolution=ignore-duplicates", // don't overwrite if it already exists
    },
    body: JSON.stringify({ wallet_address: walletAddress, email: email || null }),
  });

  if (!res.ok && res.status !== 409) {
    const errText = await res.text();
    return new Response(JSON.stringify({ error: errText }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
