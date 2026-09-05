// Cloudflare Pages Function: signs a MoonPay widget URL with your secret key.
//
// This is the Cloudflare equivalent of netlify/functions/sign-moonpay-url.js —
// same job, different platform format. If you deploy to Cloudflare Pages,
// use this file. If you deploy to Netlify instead, use the one in
// netlify/functions/ and you can ignore this one.
//
// Cloudflare auto-routes this file to: /functions/sign-moonpay-url
// (matches the file path, no extra config needed)
//
// SETUP (in the Cloudflare dashboard, not in this file):
//   1. Pages project > Settings > Environment variables > add:
//      MOONPAY_SECRET_KEY = sk_test_... (from MoonPay dashboard > Developers > API Keys)
//   2. Pages project > Settings > Runtime > Compatibility flags > add: nodejs_compat
//      (required for this file's use of Node's crypto module)
//
// Never paste the secret key directly into this file — always set it as an
// environment variable in Cloudflare's dashboard.

import crypto from "node:crypto";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secretKey = context.env.MOONPAY_SECRET_KEY;
  if (!secretKey) {
    return new Response(
      JSON.stringify({
        error: "MOONPAY_SECRET_KEY is not set. Add it under Settings > Environment variables in Cloudflare Pages.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // This matches MoonPay's own documented example exactly:
    // https://dev.moonpay.com/docs/swaps-widget-how-to-enhance-security-using-signed-urls
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(new URL(targetUrl).search)
      .digest("base64");

    return new Response(JSON.stringify({ signature }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
