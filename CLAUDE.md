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
- Supports ETH, BTC, LTC, SOL — via Banxa only (referral link, no SDK, no
  backend signing, src/banxaConfig.js). MoonPay was removed entirely
  (dependency, provider, config, and functions/sign-moonpay-url.js) —
  don't re-add references to it.
- BANXA_PARTNER_REF in src/banxaConfig.js is a placeholder until Banxa
  approves partner access (apply at banxa.com/talk-to-our-team/, not
  self-serve) and issues a partnerRef + sandbox API key via their Partner
  Dashboard. The buy flow will not actually work until that's filled in.
- BANXA_SANDBOX flag in the same file switches between banxa-sandbox.com
  and banxa.com — flip it only once Banxa approves production access.

## Live Market Data
- src/hooks/useLivePrices.js: a single shared Coinbase Exchange WebSocket
  (public, no key) feeds live BTC/ETH/LTC/SOL ticks to every consumer
  (ticker strip, charts, dashboard balance), falling back to polling
  CoinGecko's simple/price if the socket drops.
- src/components/PriceChart.jsx: a lightweight-charts area chart per coin,
  seeded with real history from Binance's public klines endpoint (NOT
  CoinGecko's market_chart endpoint — its anonymous rate limit is low
  enough that a handful of simultaneous chart loads exhausts it; confirmed
  via a live 429 during testing). Used on both the homepage and the
  dashboard's Markets tab.
- The dashboard's portfolio balance and holdings row tick live off this
  feed (not just the 30s on-chain balance poll), including a demo
  holding's dollar value floating with the real live price once its coin
  quantity is frozen — see the comment in Dashboard.jsx.

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

## Site Credit (custodial — separate from the self-custodial wallet)
- IMPORTANT OPEN ISSUE: this is a second, deliberate, custodial funding
  path alongside Banxa, added because Banxa requires business
  verification the user didn't have yet. A user pays crypto they already
  own into Coinstate Capital's own NOWPayments account, and gets an
  internal USD balance credited in return — Coinstate Capital actually
  receives and holds this money. This directly contradicts the site's own
  footer/Auth.jsx copy ("Coinstate Capital does not hold customer funds,
  crypto, or securities" / "never has access to it"). The user was told
  this explicitly and chose to ship it anyway with the copy unchanged —
  this is a known, deliberately-deferred inconsistency, not an oversight.
  Revisit before real users/real money: either update that copy or drop
  this feature. Also worth real legal advice before going live — holding
  and converting customer crypto into internal credit is a different,
  more regulated business than a referral-only on-ramp.
- Flow: src/components/CreditInvoiceModal.jsx (amount + currency picker,
  then a QR/timer/address invoice screen, styled to match a reference
  screenshot the user provided) → functions/create-payment.js (creates a
  NOWPayments payment, records a `waiting` row in Supabase `credit_payments`)
  → functions/nowpayments-webhook.js (the ONLY place a balance is ever
  incremented — verifies NOWPayments' `x-nowpayments-sig` HMAC-SHA512
  header before trusting anything, and is idempotent via the `credited`
  flag) → functions/get-credit-balance.js / payment-status.js (read-only,
  let the browser poll without ever seeing NOWPayments credentials).
- New Supabase tables (supabase/migrations/20260905214448_add_credit_system.sql):
  `credit_payments` (audit trail + idempotency guard) and `user_credits`
  (the actual balance), plus a Postgres function `increment_credit_balance`
  for atomic increments.
- New Cloudflare env vars needed: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET
  (from the user's own NOWPayments dashboard — not set yet as of this
  writing, so the flow is built but not yet live).
- The "Site credit" balance is intentionally displayed as a separate card
  from "Total portfolio value" on the dashboard — don't merge them, since
  one is real on-chain holdings and the other is this custodial balance.

## Supabase
- Actively used, not optional — table wallet_overrides (wallet_address,
  email, demo_mode, demo_balance_usd, demo_asset, demo_asset_amount,
  updated_at) backs the Demo Mode feature above; credit_payments and
  user_credits back Site Credit above.
- Accessed server-side only via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  (Cloudflare env vars) in functions/admin-list.js, admin-update.js,
  get-override.js, register-wallet.js, create-payment.js,
  nowpayments-webhook.js, get-credit-balance.js, payment-status.js.
- This repo is linked to the Supabase project (ref lehosxgqtcuwmqrwdgmu) —
  use `supabase migration new <name>` + `supabase db push` for schema
  changes, not one-off manual SQL.

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
