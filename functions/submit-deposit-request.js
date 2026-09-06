// Cloudflare Pages Function: records a customer's claim that they sent a
// deposit to one of the fixed addresses in src/walletAddresses.js. This
// does NOT credit anything by itself — see CLAUDE.md's Site Credit
// section for why (no automated confirmation is possible with a fixed,
// shared address and no memo/payment-ID field on these chains). An admin
// reviews it via /admin (functions/admin-review-deposit.js) and only
// then credits the balance.

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

  const { walletAddress, amountUsd, currency, txHash } = body;
  const amount = Number(amountUsd);
  if (!walletAddress || !currency || !Number.isFinite(amount) || amount <= 0) {
    return new Response(
      JSON.stringify({ error: "walletAddress, currency, and a positive amountUsd are required" }),
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/credit_deposit_requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        amount_usd: amount,
        currency: currency.toLowerCase(),
        tx_hash: txHash || null,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Failed to submit request: ${errText}` }), { status: 502 });
    }

    const [row] = await res.json();
    return new Response(JSON.stringify({ ok: true, requestId: row.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
