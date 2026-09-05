// Netlify serverless function: signs a MoonPay widget URL with your secret key.
//
// This exists because MoonPay requires any widget URL that includes a
// walletAddress to be signed with HMAC-SHA256 — and that signing must
// happen on a server, never in browser code, since it uses your secret key.
//
// SETUP (in the Netlify dashboard, not in this file):
//   Site settings > Environment variables > add:
//     MOONPAY_SECRET_KEY = sk_test_... (from MoonPay dashboard > Developers > API Keys)
//
// Never paste the secret key directly into this file if this repo is
// public — always set it as an environment variable in Netlify's dashboard.

const crypto = require("crypto");

exports.handler = async function (event) {
  const url = event.queryStringParameters && event.queryStringParameters.url;

  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing url parameter" }) };
  }

  const secretKey = process.env.MOONPAY_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "MOONPAY_SECRET_KEY is not set. Add it under Site settings > Environment variables in Netlify.",
      }),
    };
  }

  try {
    const queryString = url.split("?")[1] || "";
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(`?${queryString}`)
      .digest("base64");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
