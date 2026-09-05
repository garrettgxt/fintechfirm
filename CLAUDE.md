# Coinstate Capital — Project Context

## Stack & Deployment
- React 19 + Vite, react-router-dom v7.
- Deployed on Cloudflare Pages, project name "coinstatecapital", live at
  fintechfirm.pages.dev. Auto-deploys via GitHub integration on push to
  main — no manual `wrangler pages deploy` needed.
- Backend: Cloudflare Pages Functions in /functions (root-level, not
  src/), using `export async function onRequest(context)` syntax.
- Netlify is NOT used — netlify.toml and netlify/functions were removed
  as stale leftovers from an earlier deployment approach.

## Auth & Wallets
- Privy (@privy-io/react-auth) handles login and creates a self-custodial
  embedded ETH wallet automatically per user (privyConfig.js).
- IMPORTANT OPEN ISSUE: crypto purchases (see below) do NOT go to that
  per-user Privy wallet. They go to 4 FIXED addresses (one per currency)
  in src/walletAddresses.js, shared across ALL buyers, set up for
  dev/test purposes only. This conflicts with the site's own copy in
  Auth.jsx/Landing.jsx claiming funds are always self-custodial / never
  held by Coinstate Capital. Flag this again before any real user or real
  money touches the site — either the copy needs to change or the
  architecture needs per-user multi-chain wallets instead.

## Buy Crypto Flow
- Supports ETH, BTC, LTC, SOL — via MoonPay widget (@moonpay/moonpay-react)
  and Banxa (referral link, no SDK, src/banxaConfig.js).
- MoonPay widget is locked to exactly these 4 currencies using the
  `walletAddresses` prop (map of all 4 addresses) + `currencyCode` (not
  `defaultCurrencyCode`) so the buyer can't switch to an unsupported
  currency inside MoonPay's own UI. Still worth a real sandbox test per
  currency to confirm this behaves as documented.
- functions/sign-moonpay-url.js HMAC-signs the widget URL server-side
  using MOONPAY_SECRET_KEY (Cloudflare env var, never in code).

## Demo Mode
- Admin panel at /admin (password-gated via ADMIN_PASSWORD env var, not
  linked in site nav) lets you set, per wallet: demo_mode (on/off),
  demo_balance_usd (total shown on dashboard), demo_asset (ETH/BTC/LTC/SOL),
  and demo_asset_amount.
- demo_asset_amount IS A DOLLAR VALUE, not a coin quantity — this isn't
  obvious from the column name, so don't assume otherwise. Dashboard.jsx
  fetches live CoinGecko prices for all 4 assets and converts this dollar
  value into a displayed coin quantity.
- When demo_mode is on, both the "Your wallet" panel and the holdings
  table show the demo asset/quantity instead of the real on-chain ETH
  balance / wallet address.

## Supabase
- Actively used, not optional — table wallet_overrides (wallet_address,
  email, demo_mode, demo_balance_usd, demo_asset, demo_asset_amount,
  updated_at) backs the entire Demo Mode feature above.
- Accessed server-side only via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  (Cloudflare env vars) in functions/admin-list.js, admin-update.js,
  get-override.js, register-wallet.js.

## Tooling Available
- wrangler (Cloudflare) and supabase CLIs are installed and authenticated
  — use these instead of asking the human to use the web dashboards.
- git push works fully unattended via GitHub CLI (gh) with
  `gh auth setup-git` already configured — no manual/browser auth needed
  for future commits and pushes.

## Working Agreement
- After making changes: commit and push automatically, don't wait to be
  asked each time, just report what was pushed.
- Ask before touching real secrets/env vars or anything that would affect
  real user funds if this goes live.
- If a change would conflict with the self-custodial claims in
  Auth.jsx/Landing.jsx, flag it before proceeding rather than building it
  silently.
