// Cloudflare Pages Function: creates a NOWPayments crypto payment for a
// given USD amount, to be paid in the user's chosen currency. Coinstate
// Capital's own NOWPayments account receives the payment; on confirmation
// (see nowpayments-webhook.js) the user's site-credit balance is
// incremented — this money is NOT delivered to the user's own wallet.
//
// SETUP (in Cloudflare dashboard):
//   Settings > Environment variables > add:
//     NOWPAYMENTS_API_KEY = (from your NOWPayments dashboard)
//   (in addition to SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY already used
//   elsewhere in this folder)

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const apiKey = context.env.NOWPAYMENTS_API_KEY;
  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Payment provider not configured" }), { status: 500 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { walletAddress, priceAmountUsd, payCurrency } = body;
  const amount = Number(priceAmountUsd);
  if (!walletAddress || !payCurrency || !Number.isFinite(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: "walletAddress, priceAmountUsd, and payCurrency are required" }), {
      status: 400,
    });
  }

  const orderId = `${walletAddress}-${Date.now()}`;
  const callbackUrl = new URL("/nowpayments-webhook", context.request.url).toString();

  try {
    const npRes = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency: payCurrency.toLowerCase(),
        order_id: orderId,
        ipn_callback_url: callbackUrl,
      }),
    });

    if (!npRes.ok) {
      const errText = await npRes.text();
      return new Response(JSON.stringify({ error: `NOWPayments error: ${errText}` }), { status: 502 });
    }

    const payment = await npRes.json();
    const paymentId = String(payment.payment_id);

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/credit_payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        payment_id: paymentId,
        wallet_address: walletAddress,
        price_amount_usd: amount,
        pay_currency: payCurrency.toLowerCase(),
        status: payment.payment_status || "waiting",
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return new Response(JSON.stringify({ error: `Failed to record payment: ${errText}` }), { status: 502 });
    }

    return new Response(
      JSON.stringify({
        paymentId,
        payAddress: payment.pay_address,
        payAmount: payment.pay_amount,
        payCurrency: payment.pay_currency,
        expiresAt: payment.expiration_estimate_date || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
