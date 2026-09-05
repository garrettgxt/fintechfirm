// Coinstate Capital — Banxa configuration
//
// Banxa's "Referral" integration needs no backend and no signing — just a
// URL with your parameters.
//
// 1. Apply for Banxa partner/API access: https://banxa.com/talk-to-our-team/
//    (partner access is not self-serve — Banxa reviews and approves first)
// 2. Once approved, get your "partnerRef" (subdomain) and sandbox API key
//    from the Banxa Partner Dashboard. Per Banxa's docs, sandbox access is
//    typically available within minutes of approval; production access is
//    a separate, later approval.
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
