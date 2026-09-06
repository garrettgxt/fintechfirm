// Cloudflare Pages Function: lists Demo Mode withdrawal requests for the
// admin panel. Locked behind ADMIN_PASSWORD, same as the other admin-*
// functions. Defaults to pending only; pass ?all=1 for the full history.

export async function onRequest(context) {
  const providedPassword = context.request.headers.get("x-admin-password");
  const realPassword = context.env.ADMIN_PASSWORD;
  if (!realPassword || providedPassword !== realPassword) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;

  const url = new URL(context.request.url);
  const showAll = url.searchParams.get("all") === "1";
  const filter = showAll ? "" : "&status=eq.pending";

  const res = await fetch(
    `${supabaseUrl}/rest/v1/demo_withdraw_requests?select=*${filter}&order=created_at.desc`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch withdrawal requests" }), { status: 500 });
  }

  const rows = await res.json();
  return new Response(JSON.stringify({ requests: rows }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
