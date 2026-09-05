// Coinstate Capital — Privy configuration
//
// Your App ID is safe to keep here (it's meant to be public-facing, like a
// publishable key). It was already provided: cmtniisf700490dk0brltloy2
//
// Do NOT put your Privy App SECRET in this file or anywhere in src/ —
// that key must only ever live on a server (see functions/, Cloudflare
// Pages Functions), never in code that ships to the browser.

export const PRIVY_APP_ID = "cmtniisf700490dk0brltloy2";

export const privyConfig = {
  loginMethods: ["email", "google", "apple"],
  appearance: {
    theme: "dark",
    accentColor: "#B08A4E",
    logo: undefined,
  },
  embedded: {
    // Creates a self-custodial embedded wallet automatically for every
    // user the first time they log in — no separate "create wallet" step.
    ethereum: {
      createOnLogin: "all-users",
    },
  },
};
