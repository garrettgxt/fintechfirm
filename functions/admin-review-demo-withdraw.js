// Cloudflare Pages Function: approve or reject a Demo Mode withdrawal
// request, for the admin panel only. Locked behind ADMIN_PASSWORD.
// The requested amount was already escrowed (subtracted from
// demo_balance_usd) when the request was created — approving does
// nothing further to the balance; rejecting refunds it back via
// add_demo_funds.

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

  const { requestId, action } = body;
  if (!requestId || !["approve", "reject"].includes(action)) {
    return new Response(JSON.stringify({ error: "requestId and action ('approve' or 'reject') are required" }), {
      status: 400,
    });
  }

  try {
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_withdraw_requests?id=eq.${requestId}&select=id,wallet_address,amount_usd,status`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!lookupRes.ok) return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502 });
    const [record] = await lookupRes.json();
    if (!record) return new Response(JSON.stringify({ error: "Request not found" }), { status: 404 });
    if (record.status !== "pending") {
      return new Response(JSON.stringify({ error: "Request already reviewed" }), { status: 400 });
    }

    if (action === "reject") {
      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/add_demo_funds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ p_wallet: record.wallet_address, p_amount: record.amount_usd }),
      });
      if (!rpcRes.ok) {
        const errText = await rpcRes.text();
        return new Response(JSON.stringify({ error: `Failed to refund balance: ${errText}` }), { status: 502 });
      }
    }

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/demo_withdraw_requests?id=eq.${requestId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: action === "approve" ? "approved" : "rejected",
        reviewed_at: new Date().toISOString(),
      }),
    });
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return new Response(JSON.stringify({ error: `Failed to update request: ${errText}` }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
