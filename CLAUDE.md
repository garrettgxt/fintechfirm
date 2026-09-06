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
  embedded ETH wallet automatically per user (privyConfig.js). It's still
  used for auth/identity (walletAddress is the key for everything —
  Demo Mode, Site Credit), but Dashboard.jsx no longer fetches or shows
  that wallet's real on-chain ETH balance — it was showing a leftover
  test balance with nothing left to fund it (Banxa's disconnected, see
  below), which read as misleading. Don't re-add an on-chain balance
  display for real (non-demo) accounts without checking with the user
  first — Site Credit is the number that matters now.
- IMPORTANT OPEN ISSUE: crypto purchases via Banxa (see below, currently
  disconnected from the UI anyway) do NOT go to the per-user Privy
  wallet. They go to 4 FIXED addresses (one per currency) in
  src/walletAddresses.js, shared across ALL buyers, set up for dev/test
  purposes only. This conflicts with the site's own copy in
  Auth.jsx/Landing.jsx claiming funds are always self-custodial / never
  held by Coinstate Capital. Flag this again before any real user or real
  money touches the site — either the copy needs to change or the
  architecture needs per-user multi-chain wallets instead.

## Buy Crypto Flow (Banxa) — currently disconnected from the UI
- src/banxaConfig.js (getBanxaCheckoutUrl) is still a real, working
  integration, but nothing in src/ imports or renders it anymore — the
  user said to drop the "Buy crypto" entry point in favor of Add Credit
  (below) since Banxa still needs partner approval to actually work.
  Don't delete the file (it's ready to re-add once BANXA_PARTNER_REF is
  filled in), but don't wire it back up unless asked.
- MoonPay was removed entirely (dependency, provider, config, and
  functions/sign-moonpay-url.js) — don't re-add references to it.
- BANXA_PARTNER_REF in src/banxaConfig.js is a placeholder until Banxa
  approves partner access (apply at banxa.com/talk-to-our-team/, not
  self-serve) and issues a partnerRef + sandbox API key via their Partner
  Dashboard.
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
- In Demo Mode, the dashboard's balance and holdings row tick live off
  this feed, including the demo holding's dollar value floating with the
  real live price once its coin quantity is frozen — see the comment in
  Dashboard.jsx. For a real (non-demo) account the balance shown is Site
  Credit (below), which only changes when a payment is actually credited,
  not a continuous tick.

## Demo Mode — interactive paper trading (stocks, forex, crypto)
- IMPORTANT: real stock/forex investing is explicitly NOT built — this is
  a simulated internal ledger only, confirmed with the user as the model
  before building (the alternative, real brokerage execution via
  something like Alpaca, was explicitly deferred). Never let Demo Mode
  trading touch a real account's Site Credit — functions/demo-trade.js
  and the `apply_demo_trade` Postgres function both hard-require
  `wallet_overrides.demo_mode = true` before doing anything.
- functions/demo-trade.js trusts the PRICE THE CLIENT SENDS, not a fresh
  server-side fetch — deliberately, and only acceptable because of the
  demo_mode gate above. Binance's API (fronted by CloudFront) returns a
  403 "Request blocked" specifically to Cloudflare Workers' own outbound
  IPs — confirmed in production testing: the exact same request that
  works fine from a browser (PriceChart.jsx's chart data) fails from a
  Cloudflare Function. So a server-side price fetch isn't reliably
  possible here; trusting the already-displayed quote means the worst
  case is a demo user giving themselves a slightly favorable price in
  their own play-money portfolio — never a real one. Keep this in mind
  for any FUTURE feature that needs a server-side Binance call — it may
  hit the same block; CoinGecko/Coinbase's REST APIs weren't tested for
  the same issue and may or may not have it too.
- Admin panel at /admin (password-gated via ADMIN_PASSWORD, not linked in
  site nav) now just toggles demo_mode and sets the demo cash balance
  (`wallet_overrides.demo_balance_usd`, repurposed — see below), plus a
  "Reset portfolio" button (functions/admin-reset-demo.js) that clears
  `demo_positions` for that wallet. The old per-wallet single-asset
  fields (demo_asset, demo_asset_amount) are no longer written to or
  read anywhere — left in the DB unused rather than migrated away, not
  worth it for a demo feature.
- Data model: `wallet_overrides.demo_balance_usd` is the demo CASH
  balance (used to mean "total shown on dashboard" before this — that
  older meaning is gone). `demo_positions` (new table, wallet_address +
  symbol as PK) holds what a demo user has actually bought — quantity +
  avg_cost_usd, updated via the `apply_demo_trade` Postgres function
  (does the whole buy/sell atomically: validates demo_mode, checks
  cash/position, moves money, upserts/deletes the position row).
- A demo user can buy/sell any asset in src/assetCatalog.js (stocks,
  index ETFs, forex, and 12 crypto — the same PriceChart.jsx cards on the
  Markets tab get Buy/Sell buttons when demoMode is true). For a real
  (non-demo) account, only crypto shows a Buy button, and it opens Add
  Funds (Site Credit, below) — not a trade — since real stock/forex
  investing isn't built.
- Dashboard.jsx shows a demo cash panel + a multi-position holdings table
  (with P&L per position) only when demo_mode is true; a real account
  shows neither, just the Site Credit balance.

## Market Data for Stocks/ETFs/Forex (Twelve Data)
- Crypto is untouched — still Coinbase WS (live ticks) + Binance klines
  (history), see Live Market Data above. Stocks/ETFs/forex use a
  different provider, Twelve Data, since neither Coinbase nor Binance
  cover those: functions/market-quote.js (batched live quotes) and
  functions/market-history.js (historical candles, reshaped into the
  same {time, value}[] PriceChart.jsx already expects for crypto).
- Needs `TWELVE_DATA_API_KEY` (Cloudflare secret) from the user's own
  Twelve Data account — not set yet as of this writing, so stock/forex
  quotes and charts return a clean "not configured" error until it is;
  crypto is unaffected either way.
- Twelve Data's free tier (800 calls/day, 8/min) is shared across every
  visitor to the site, not per-user, so both functions cache their
  upstream response for ~45s via the Cache API, keyed by the exact
  request URL. Just as important: PriceChart.jsx does NOT poll its own
  quote for non-crypto symbols — it takes a `quote` prop instead, fed by
  ONE batched src/hooks/useMarketQuotes.js call in the parent
  (Dashboard.jsx polls all of src/assetCatalog.js's NON_CRYPTO_SYMBOLS at
  once; Landing.jsx polls just its 4-6 homepage symbols). If you add a new
  place that renders PriceChart for non-crypto symbols, do the same —
  don't let PriceChart call useMarketQuotes itself, or a screen full of
  cards fans out into many separate upstream calls and blows through the
  rate limit.
- market-history.js does NOT have the same batching option as quotes —
  Twelve Data's time_series endpoint is one symbol per call, so every
  PriceChart card fetches its own history independently. Confirmed in
  production: a page with just 6 non-crypto cards was enough to 429
  every one of them. PriceChart.jsx now serializes ALL non-crypto history
  fetches through a shared module-level queue (`enqueueHistoryFetch`,
  ~4s between requests) so a big page (Dashboard's Markets tab has 30+
  non-crypto cards) drains through the free-tier limit over time instead
  of overrunning it immediately — expect stock/ETF/forex charts to fill
  in gradually rather than all at once on a page with many cards. Crypto
  history (Binance) isn't affected — its limits are generous enough that
  this was never a problem there.
- src/assetCatalog.js is the curated catalog (~24 stocks, 3 index ETFs,
  5 forex pairs, 12 crypto) — deliberately not "all stocks/every pair",
  which isn't realistically buildable; scoped down with the user.

## Site Credit (custodial — separate from the self-custodial wallet)
- This is now the site's PRIMARY funding entry point ("Add funds" in the
  dashboard sidebar and next to the Site credit balance) — Banxa's "Buy
  crypto" entry point was removed in favor of this (see Buy Crypto Flow
  above), because Banxa still needs partner approval and this doesn't.
- IMPORTANT OPEN ISSUE: this is a deliberate custodial funding path. A
  user pays crypto they already own into Coinstate Capital's own
  NOWPayments account, and gets an internal USD balance credited in
  return — Coinstate Capital actually receives and holds this money. This
  directly contradicts the site's own footer/Auth.jsx copy ("Coinstate
  Capital does not hold customer funds, crypto, or securities" / "never
  has access to it"). The user was told this explicitly and chose to ship
  it anyway with the copy unchanged — this is a known, deliberately-
  deferred inconsistency, not an oversight. Revisit before real
  users/real money: either update that copy or drop this feature. Also
  worth real legal advice before going live — holding and converting
  customer crypto into internal credit is a different, more regulated
  business than a referral-only on-ramp.
- Flow: src/components/CreditInvoiceModal.jsx (amount + currency picker —
  preset chips at $20/$50/$100/$250/$500/$1000 plus a free-text custom
  amount field, and an optional `initialCurrency` prop so a chart's "Buy"
  button can preselect a coin — then a QR/timer/address invoice screen,
  styled to match a reference screenshot the user provided) →
  functions/create-payment.js (creates a NOWPayments payment, records a
  `waiting` row in Supabase `credit_payments`) → functions/nowpayments-webhook.js
  (the ONLY place a balance is ever incremented — verifies NOWPayments'
  `x-nowpayments-sig` HMAC-SHA512 header before trusting anything, and is
  idempotent via the `credited` flag) → functions/get-credit-balance.js /
  payment-status.js (read-only, let the browser poll without ever seeing
  NOWPayments credentials).
- New Supabase tables (supabase/migrations/20260905214448_add_credit_system.sql):
  `credit_payments` (audit trail + idempotency guard) and `user_credits`
  (the actual balance), plus a Postgres function `increment_credit_balance`
  for atomic increments.
- New Cloudflare env vars needed: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET
  (from the user's own NOWPayments dashboard — not set yet as of this
  writing, so the flow is built but not yet live).
- For a real (non-demo) account, "Total portfolio value" on the
  dashboard IS the Site Credit balance (`creditBalance` in Dashboard.jsx)
  — there's no separate on-chain figure being shown anymore, so this is
  no longer two numbers to keep apart, just one. In Demo Mode, the
  balance card instead shows the admin-set demo figure, same as before —
  Site Credit and Demo Mode are still two independent systems under the
  hood (separate tables, separate state), they just happen to render in
  the same card slot depending on demo_mode.

## Supabase
- Actively used, not optional — table wallet_overrides (wallet_address,
  email, demo_mode, demo_balance_usd [now demo CASH — see Demo Mode
  above], demo_asset/demo_asset_amount [unused legacy], updated_at) plus
  demo_positions back Demo Mode above; credit_payments and user_credits
  back Site Credit above.
- Accessed server-side only via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  (Cloudflare env vars) in functions/admin-list.js, admin-update.js,
  admin-reset-demo.js, get-override.js, register-wallet.js,
  create-payment.js, nowpayments-webhook.js, get-credit-balance.js,
  payment-status.js, demo-trade.js, get-demo-portfolio.js.
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
