// Cloudflare Pages Function: self-service Demo Mode cash top-up. Fake
// money only — see add_demo_funds in Postgres, which hard-requires
// demo_mode = true, same as every other demo-* function, so this can
// never touch a real account's Site Credit.

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

  const { walletAddress, amount } = body;
  const amt = Number(amount);
  if (!walletAddress || !Number.isFinite(amt) || amt <= 0) {
    return new Response(JSON.stringify({ error: "walletAddress and a positive amount are required" }), { status: 400 });
  }

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/add_demo_funds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_wallet: walletAddress, p_amount: amt }),
    });

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      const knownError = ["demo_mode_not_active", "invalid_amount"].find((e) => errText.includes(e));
      return new Response(JSON.stringify({ error: knownError || `Failed to add funds: ${errText}` }), {
        status: knownError ? 400 : 502,
      });
    }

    const result = await rpcRes.json();
    return new Response(JSON.stringify({ ok: true, cashUsd: result.cashUsd }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
