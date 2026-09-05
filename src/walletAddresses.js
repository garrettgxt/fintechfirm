// Coinstate Capital — fixed dev/test destination wallets
//
// DEV/TEST ONLY. These are NOT per-user Privy embedded wallets — every
// purchase made on the site currently lands in ONE of these four fixed
// addresses, shared across all buyers, for manual testing of the
// Banxa buy flow for each currency.
//
// This is fine for you + a friend testing the flow. It is NOT compatible
// with the site's current copy ("Coinstate Capital never has access to
// your funds", "a wallet only you control") if real outside users and
// real money are ever involved — see Auth.jsx / Landing.jsx. Revisit
// before that happens: either update that copy to reflect custodial
// reality, or switch to per-user Privy wallets for each chain.

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
