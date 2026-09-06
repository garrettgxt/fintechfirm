// Coinstate Capital — fixed Site Credit deposit wallets
//
// These are NOT per-user Privy embedded wallets — every Site Credit
// deposit lands in ONE of these four fixed addresses, shared across all
// buyers. Originally set up for manual testing of the (now unused) Banxa
// buy flow; as of 2026-09-06 this is also the LIVE address set for
// CreditInvoiceModal.jsx's real-money deposit flow (NOWPayments was
// removed entirely — explicit user decision, see CLAUDE.md's Site Credit
// section for the full tradeoff). Because it's one shared address per
// currency with no memo/payment-ID field on any of these chains, nothing
// can automatically confirm a payment or know which customer sent it —
// functions/submit-deposit-request.js + functions/admin-review-deposit.js
// exist specifically to cover that gap with a human verification step
// instead of an automated one.
//
// This still does NOT match the site's copy ("Coinstate Capital never
// has access to your funds", "a wallet only you control") — see
// Auth.jsx / Landing.jsx. That inconsistency was already flagged before
// Site Credit shipped at all and remains a known, deliberately-deferred
// issue, not an oversight.

export const WALLET_ADDRESSES = {
  eth: "0xfBe9Dc46f9985B1dA483D3e4FA7F65F5fa82946F",
  btc: "bc1q9jgfk6srun6qddcsw5pzhyyh467xx3zqka5hss",
  ltc: "LVY5qTssWzEEhbyM5SWWtCWTYhcmdsz6Sx",
  sol: "CXWnAsCzynPtdLXgrVs1KDQFrVia9yYxaQUF33gLymJk",
};

export const SUPPORTED_CURRENCIES = [
  { code: "eth", label: "Ethereum", symbol: "ETH" },
  { code: "btc", label: "Bitcoin", symbol: "BTC" },
  { code: "ltc", label: "Litecoin", symbol: "LTC" },
  { code: "sol", label: "Solana", symbol: "SOL" },
];
