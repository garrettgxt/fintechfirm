// Cloudflare Pages Function: lets the browser poll a payment's status
// without ever talking to NOWPayments directly or seeing the API key.
// The only source of truth for "did this get paid" is nowpayments-webhook.js
// updating credit_payments — this just reads that row back.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const paymentId = url.searchParams.get("paymentId");
  if (!paymentId) {
    return new Response(JSON.stringify({ error: "paymentId parameter is required" }), { status: 400 });
  }

  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Supabase env vars not set" }), { status: 500 });
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/credit_payments?payment_id=eq.${encodeURIComponent(paymentId)}&select=status,credited`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 502 });
    }

    const rows = await res.json();
    const row = rows[0];
    return new Response(
      JSON.stringify({ status: row?.status ?? "unknown", credited: row?.credited ?? false }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
