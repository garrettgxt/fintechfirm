// Coinstate Capital — Banxa configuration
//
// Banxa's "Referral" integration needs no backend and no signing — just a
// URL with your parameters. Much simpler than MoonPay's setup.
//
// 1. Sign up / talk to Banxa about getting partner access:
//    https://banxa.com (or your existing Banxa contact if you have one)
// 2. Ask specifically for your "partnerRef" (subdomain) and sandbox access —
//    their docs suggest an account manager may need to enable this, so it
//    may not be instant like MoonPay's test key.
// 3. Paste your partnerRef below once you have it.

export const BANXA_PARTNER_REF = "PASTE_YOUR_BANXA_PARTNER_REF_HERE";

// Sandbox while testing; switch to false once Banxa approves production.
export const BANXA_SANDBOX = true;

export function getBanxaCheckoutUrl({ walletAddress, coinType = "ETH" }) {
  const domain = BANXA_SANDBOX ? "banxa-sandbox.com" : "banxa.com";
  const params = new URLSearchParams({
    walletAddress,
    coinType,
    blockchain: coinType,
    fiatType: "USD",
  });
  return `https://${BANXA_PARTNER_REF}.${domain}?${params.toString()}`;
}
