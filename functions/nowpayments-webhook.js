// Cloudflare Pages Function: receives NOWPayments' IPN callback when a
// payment's status changes. This is the ONLY place a user's site-credit
// balance is ever incremented — never trust a status change reported by
// the browser, only this signed server-to-server callback.
//
// SETUP (in Cloudflare dashboard):
//   Settings > Environment variables > add:
//     NOWPAYMENTS_IPN_SECRET = (generate in NOWPayments dashboard,
//       Payment Settings section — this is NOT the API key)

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortObject(value[key]);
    }
    return sorted;
  }
  return value;
}

async function hmacSha512Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const ipnSecret = context.env.NOWPAYMENTS_IPN_SECRET;
  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ipnSecret || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 500 });
  }

  const rawBody = await context.request.text();
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const providedSig = context.request.headers.get("x-nowpayments-sig") || "";
  const sortedBody = JSON.stringify(sortObject(payload));
  const expectedSig = await hmacSha512Hex(ipnSecret, sortedBody);

  if (!timingSafeEqual(providedSig, expectedSig)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const paymentId = String(payload.payment_id);
  const status = payload.payment_status;

  // Everything past this point talks to Supabase over the network — wrap it
  // so a transient failure comes back as a clean 5xx (which NOWPayments will
  // retry) instead of an unhandled exception.
  try {
    // Look up our record of this payment (created by create-payment.js).
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/credit_payments?payment_id=eq.${encodeURIComponent(paymentId)}&select=wallet_address,price_amount_usd,credited`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!lookupRes.ok) {
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502 });
    }
    const rows = await lookupRes.json();
    const record = rows[0];
    if (!record) {
      // Unknown payment_id — acknowledge so NOWPayments stops retrying, but do nothing.
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Always record the latest status, but only credit once, on the
    // transition into "finished" — never re-credit an already-credited row.
    const shouldCredit = status === "finished" && !record.credited;

    if (shouldCredit) {
      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/increment_credit_balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ p_wallet: record.wallet_address, p_amount: record.price_amount_usd }),
      });
      if (!rpcRes.ok) {
        const errText = await rpcRes.text();
        return new Response(JSON.stringify({ error: `Failed to credit balance: ${errText}` }), { status: 502 });
      }
    }

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/credit_payments?payment_id=eq.${encodeURIComponent(paymentId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status,
        credited: shouldCredit ? true : undefined,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return new Response(JSON.stringify({ error: `Failed to update payment record: ${errText}` }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
