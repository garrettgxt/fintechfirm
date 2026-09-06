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
- NEW ACCOUNTS DEFAULT TO DEMO MODE ON (2026-09-06, explicit user
  request): `wallet_overrides.demo_mode`'s column DEFAULT is now `true`
  (was `false`) and `demo_balance_usd`'s is `10000` (was `0`, standard
  paper-trading starting balance — Demo Mode "on" with $0 to trade would
  look broken for a first-time user). functions/register-wallet.js's
  insert deliberately only ever sets wallet_address + email, omitting
  demo_mode/demo_balance_usd entirely, so this is a pure column-default
  change (supabase/migrations/20260906060000_default_new_accounts_to_demo_mode.sql)
  with zero code change needed there. ALTER COLUMN ... SET DEFAULT only
  affects future inserts, not existing rows — every wallet that already
  existed keeps whatever demo_mode/balance it already had. The admin
  panel is still the only way to turn Demo Mode OFF for a wallet (opt-out
  now, instead of opt-in).
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
- Self-service "Add demo funds" (2026-09-06): previously only the /admin
  panel could top up demo_balance_usd — a demo user had no way to add
  more simulated cash themselves. New Postgres function `add_demo_funds`
  (same shape as apply_demo_trade: hard-requires demo_mode=true) +
  functions/add-demo-funds.js + src/components/AddDemoFundsModal.jsx
  (preset $500/$1000/$5000/$10000 chips + custom amount, no payment
  step — it's fake money). Deliberately a SEPARATE modal from
  CreditInvoiceModal (real Site Credit/crypto-QR payments) — routing a
  demo user into the real payment flow would be actively misleading.
  IMPORTANT: this is ADDITIVE, not a replacement — a wallet can have
  Demo Mode on AND still fund its real Site Credit balance via the actual
  crypto-QR flow at the same time (they're independent systems; a first
  attempt at this made the sidebar's "+ Add funds" mode-aware and
  accidentally made the real flow unreachable while demoMode was on —
  reverted after the user asked "can I still add funds with the QR code
  in demo mode?"). Current wiring: Dashboard.jsx's sidebar "+ Add funds"
  ALWAYS opens the real CreditInvoiceModal regardless of demo_mode; a
  separate "+ Add demo funds" button next to "Invest in stocks" on the
  Portfolio tab's balance card (shown only when demoMode is true) opens
  AddDemoFundsModal. Two distinct, clearly-labeled entry points, not one
  button that branches.
- AssetDetailPanel.jsx's Buy/Sell panel no longer displays "Demo cash:
  $X" — user feedback was that this is redundant once the account is
  already known to be in Demo Mode (shown elsewhere via the "Demo" badge
  next to Total portfolio value). `cashUsd` is still passed as a prop and
  used internally for the overBudget check, just not shown as text
  anymore. The "You hold N SYMBOL" sell-context line is kept (shown only
  when side === "sell") since that's information the user actually needs,
  not restated state.

## Search, Asset Detail Page, and Limit Orders (Demo Mode)
- src/components/AssetSearch.jsx: client-side search over the static
  src/assetCatalog.js (no backend — it's a fixed list), with category
  chips for Stocks/ETFs/Forex/Crypto only (no Options/Futures/IPOs/
  Earnings — scoped down from the user's reference screenshots since
  there's no real data source for those). Rendered in Landing.jsx's nav
  (selecting a result sends a logged-out visitor to /auth — see
  src/pendingAsset.js below for what happens to that selection) and
  Dashboard.jsx's topbar (selecting a result opens the asset detail view
  below directly, since there's already a session).
- src/components/AssetDetailPanel.jsx: the per-asset page (big chart +
  "Market details" stats + Buy/Sell panel), rendered as a third internal
  view in Dashboard.jsx (`tab === "asset"` + `selectedAsset` state) rather
  than a new router route, so it shares the existing sidebar/topbar chrome
  the same way Portfolio/Markets already do. This fully replaced the old
  standalone TradeModal.jsx popup, which was deleted.
  - Chart: full range set (1D/1W/1M/3M/6M/YTD/1Y/5Y/10Y) via the new
    src/hooks/useAssetHistory.js, extracted out of PriceChart.jsx so both
    the compact cards (1D/1W/1M only) and this page share the same
    fetch/retry logic — including the Twelve Data rate-limit queue.
  - "Market details" grid: for stock/ETF/forex, only fields Twelve Data's
    /quote endpoint actually returns (open/high/low/previous close/
    volume/average volume/52-week high-low/exchange) — functions/
    market-quote.js was extended to pass these through, and
    useMarketQuotes.js now keeps the whole quote object instead of just
    price/changePct. For crypto, there's no 52-week or exchange data from
    our feeds, so this page fetches Binance's public `/api/v3/ticker/24hr`
    client-side instead (same Cloudflare-Workers-get-blocked reasoning as
    everywhere else Binance is used — see below) for real 24hr open/high/
    low/volume; nothing is faked for what a feed doesn't provide.
  - Buy/Sell panel: Buy/Sell tabs, an Order type dropdown (Market/Limit),
    and a Dollars vs Shares/Coins toggle (enter either side, quantity is
    derived from the current or limit price). Market orders reuse the
    existing functions/demo-trade.js path unchanged; Limit orders go
    through the new order-book endpoints below. Demo Mode only — if
    demo_mode is off, this panel shows an explanatory message instead of
    trading, since real stock/ETF/forex investing isn't built.
- New `demo_orders` table + Postgres functions (supabase/migrations/
  20260906024501_add_demo_orders.sql): `create_demo_order` (validates
  demo_mode + positive qty/price, inserts a `pending` row — does NOT
  escrow funds/position upfront), `fill_demo_order` (re-validates and
  delegates to the existing `apply_demo_trade` for the actual cash/
  position effect, marking the order `filled` or `failed`), and
  `cancel_demo_order`. New functions: create-demo-order.js,
  fill-demo-order.js, cancel-demo-order.js, get-demo-orders.js — same
  known-error-string-matching pattern as demo-trade.js.
- IMPORTANT LIMITATION: limit orders only execute while that wallet's own
  Dashboard tab is open. Dashboard.jsx has an effect that watches its own
  pending orders (fetched via get-demo-orders.js) against the live prices
  it already holds (useLivePrices for crypto, useMarketQuotes for stock/
  ETF/forex) and calls fill-demo-order.js the moment a buy-limit's price
  drops to/below its limit or a sell-limit's price rises to/above it.
  There is NO background scheduler — Cloudflare Pages has no built-in
  cron — so an order placed and left with the tab closed will NOT fill
  until the user reopens the dashboard. This was an explicit, user-
  approved tradeoff ("check while the app is open") for a demo feature;
  don't assume orders fill in the background without checking with the
  user first if this ever needs to change.
- Pending orders show in the Portfolio tab (symbol, side, quantity, limit
  price, Cancel button) whenever any exist for that wallet.
- fill-demo-order.js trusts the client-supplied fill price for the same
  reason as demo-trade.js (Binance blocks Cloudflare Workers' own
  outbound IPs — see Demo Mode below) — acceptable only because of the
  demo_mode gate.

## Preserving Intent Across the /auth Redirect
- Bug fixed 2026-09-06: a logged-out visitor clicking a stock/coin (via
  Landing.jsx's search bar or a chart's Buy button) was sent to /auth with
  no way to carry over what they clicked — after logging in they landed
  on the plain Dashboard (Portfolio tab), with no memory of the asset
  they wanted, unable to buy/sell/limit it without re-searching.
- src/pendingAsset.js: `setPendingAsset(asset)` / `consumePendingAsset()`
  wrap a sessionStorage key. Landing.jsx's `goToAuth(asset)` helper calls
  `setPendingAsset` before redirecting; Dashboard.jsx calls
  `consumePendingAsset()` once on mount and, if it finds something, opens
  straight to that asset's detail view (`tab === "asset"`) instead of
  defaulting to Portfolio. It's read-and-clear (sessionStorage, one-time
  resume), not a persistent redirect rule — a normal direct visit to
  /dashboard is unaffected.

## Crypto Catalog (Wealthsimple-style breadth)
- src/assetCatalog.js's CRYPTO list was expanded from the original 12 to
  61 coins, aiming to match the breadth of coins a major retail platform
  (Wealthsimple Crypto, as referenced by the user) lists — this is a
  broad set of major/well-known coins, not a verified line-by-line copy
  of Wealthsimple's exact current lineup (no live access to that list).
- IMPORTANT: every symbol added was verified BEFORE adding, against two
  live sources — this matters because a coin missing from either silently
  shows as permanently broken with no error:
  1. https://api.exchange.coinbase.com/products (must have a `<SYM>-USD`
     entry) — src/hooks/useLivePrices.js's real-time ticker needs this;
     the file's own comment already warned about this exact failure mode
     (TRX isn't on Coinbase and was deliberately left out for that
     reason) before this expansion.
  2. Binance's USDT trading pairs (`<SYM>USDT`) — src/hooks/
     useAssetHistory.js builds this symbol directly with no mapping, for
     chart history.
  Both `PRODUCTS` and `COINGECKO_IDS` in useLivePrices.js were extended
  1:1 for every new symbol (the WS subscribe list and the CoinGecko
  fallback-poll list must stay in sync, or a symbol only present in one
  gets no data on the path that's actually active).
- Coinbase's shared WebSocket has no meaningful per-symbol subscription
  limit, so going from 12 to 61 crypto ticker subscriptions on the one
  shared connection is not a concern the way Twelve Data's credits are
  (below). Binance klines history is likewise unaffected (client-side,
  generous limits, confirmed previously).
- Dashboard.jsx's Markets tab renders every catalog asset as its own
  PriceChart card — with 61 crypto + 11 non-crypto (see below; trimmed
  2026-09-06), that's ~72 chart cards on one page. Left as-is since it
  wasn't reported broken,
  but if this ever becomes a real perf complaint, lazy-loading/pagination
  on that tab (rather than shrinking the catalog) is the fix to reach for.

## Market Data for Stocks/ETFs/Forex (Twelve Data for quotes, TradingView for charts)
- Crypto is untouched — still Coinbase WS (live ticks) + Binance klines
  (history), see Live Market Data above.
- Stock/ETF/forex NUMERIC PRICE (for the header, Buy/Sell math, portfolio
  valuation, limit-order fill-checking) comes from Twelve Data via
  functions/market-quote.js (batched — see below for why this is cheap).
  Needs `TWELVE_DATA_API_KEY` (Cloudflare secret, set from the user's own
  free-tier Twelve Data account).
- FALLBACK for when the daily cap is exhausted (2026-09-06): the incident
  below kept recurring even after every free-tier optimization, and while
  exhausted, Demo Mode market buys were completely blocked ("Waiting for
  a live price..."), which doesn't need to happen — Demo Mode doesn't
  need a fresh price, just *a* real one. New Supabase table
  `market_quote_cache` (symbol primary key, jsonb data) — every
  successful market-quote.js response now persists each quote there
  (fire-and-forget); when Twelve Data itself fails, market-quote.js falls
  back to the last cached value per symbol instead of erroring out. A
  symbol that's never been successfully fetched still comes back with
  price: null — this can't invent a price, only remember a real one.
  Seeded once (supabase/migrations/20260906050100_add_market_quote_cache.sql)
  with AAPL/TSLA/NVDA/NFLX prices actually observed via Twelve Data
  earlier that same session, so Demo buys for those worked immediately
  rather than waiting for the next successful fetch — not fabricated
  data, just not live-fresh. The other 7 non-crypto symbols populate
  themselves the next time Twelve Data succeeds.
- The fallback cache above only ever had real price/changePct for these
  symbols — never the fuller "Market details" field set (open/high/low/
  previousClose/volume/avgVolume/52-week high-low/exchange), so that grid
  stayed blank ("—") even once price/chart/Buy-Sell worked again. User's
  call when asked about this: "since it's demo mode just add some random
  data... just make it look simulated." AssetDetailPanel.jsx's
  `simulateMarketFields(symbol, price, changePct)` fills exactly those
  gaps — ONLY when demoMode is true and only for fields Twelve Data
  didn't provide (never overwrites real data) — seeded by symbol (not
  time) so numbers stay stable across renders instead of jittering.
  previousClose is derived exactly from price+changePct (real math) when
  available; Exchange is read from TV_SYMBOLS's real exchange prefix
  (`exchangeFromTvSymbol`), also not simulated — only open/high/low/
  volume/avgVolume/52-week are genuinely fabricated. The "Market details"
  heading shows a small "(simulated for Demo Mode)" label whenever any
  simulated value is in use, so it's never presented as if it were real —
  this label is the line not to remove if asked to make the panel "look
  more real": simulated financial figures need to stay identifiable as
  such, not just look plausible. Never applies to a real (non-demo)
  account.
- Stock/ETF/forex CHARTS come from TradingView's free embeddable "Symbol
  Overview" widget (src/components/TradingViewWidget.jsx), rendered
  directly by both PriceChart.jsx and AssetDetailPanel.jsx for
  `type !== "crypto"`. TradingView serves the chart from its own
  infrastructure via this embed script — zero API credits, no rate limit
  on our side, no API key needed. The tradeoff: it's a sandboxed iframe
  with no public JS API on the free tier, so we can't read a numeric
  price out of it — that's why the quote/price path above still exists
  separately and independently. src/assetCatalog.js's `TV_SYMBOLS` maps
  each of our 11 non-crypto symbols to TradingView's exchange-prefixed
  format (e.g. "NASDAQ:AAPL", "FX:EURUSD"). functions/market-history.js
  and its Twelve Data time_series calls are now UNUSED (left in place,
  not deleted, per the comment in that file) — see the incident below for
  why this changed.
- Widget config went through several iterations before landing on a
  clean result (all same-day, 2026-09-06): the default "Symbol Overview"
  widget repeats the full company name + price inside the chart itself,
  duplicating our own header; switching to the "Mini Chart" product
  still showed its own compact ticker+name label, same problem. Final
  config: "Symbol Overview" with `chartOnly: true` (strips the name/price
  row) PLUS `hideDateRanges: true` (chartOnly alone still left the
  widget's own 1D/1M/3M/1Y/5Y/All tab row showing, duplicating ours).
  Since chartOnly has no date-range UI to drive externally, the active
  range is set by appending `|<rangeCode>` directly to the symbol string
  (TradingView's own range ids: 1d, 1m, 3m, 12m, 60m, all) — see
  `rangeCode` prop on TradingViewWidget.jsx and MARKET_RANGES in
  PriceChart.jsx / AssetDetailPanel.jsx for the buttons that drive it.
  The remaining small circular TradingView badge on the chart is
  rendered inside a cross-origin iframe — no CSS/JS access from our side,
  not a config flag being left off, a fixed condition of the free embed.
- IMPORTANT INCIDENT (2026-09-06, several rounds in one day):
  1. The free tier's 800 credits/day cap was found completely exhausted
     (1995 used, confirmed via Twelve Data's own /api_usage endpoint
     returning "You have run out of API credits for the day"). NOT a code
     bug — root cause: Twelve Data meters a batched /quote call at ONE
     CREDIT PER SYMBOL, and market-history.js's time_series calls the
     same way PER SYMBOL PER RANGE (and time_series isn't batchable at
     all, unlike quotes). With the old 45s cache and ~32 non-crypto
     symbols, one open Dashboard tab could exhaust the daily cap in under
     20 minutes.
  2. Lengthened both endpoints' cache TTLs (quotes to 5 min, history to
     5min/1hr) — usage kept climbing anyway (1995 -> 2313) because
     useMarketQuotes(NON_CRYPTO_SYMBOLS) in Dashboard.jsx ran
     UNCONDITIONALLY regardless of which tab was open. Fixed: Dashboard.jsx
     now computes `neededNonCryptoSymbols` (useMemo from `tab`,
     `demoPositions`, `selectedAsset`, `pendingOrders`) — full board only
     on the Markets tab, otherwise just symbols actually in play.
  3. Usage STILL climbed (2313 -> 2477) from ordinary public homepage
     traffic (Landing.jsx's fixed 6-symbol quote+history batch, which
     wasn't over-fetching but also can't be scoped down further — it's a
     public marketing page) plus interactive range-switching on cards
     (each distinct symbol+range combo is its own history cache key, so
     clicking through ranges keeps generating fresh cache misses). At
     this point every free-tier lever (caching, scoping, catalog size —
     see below) had been pulled with no zero-cost option left.
  4. User's call at that point: trim the non-crypto catalog from 32 to 11
     symbols (see src/assetCatalog.js's comment) rather than pay or wait.
  5. Stocks kept showing "Loading..." even after the trim (quota still
     exhausted, still climbing) — user's final call: stop using Twelve
     Data's time_series for charts entirely and switch to TradingView's
     free embed widget for the visual chart, keeping Twelve Data only for
     the numeric quote (cheap: one batched, cacheable call, not per-range).
     This is the current architecture described above.
- Historical note now superseded by the TradingView switch but kept for
  context: PriceChart.jsx never polls its own quote for non-crypto
  symbols — it takes a `quote` prop fed by ONE batched
  src/hooks/useMarketQuotes.js call in the parent (see
  `neededNonCryptoSymbols` in Dashboard.jsx; Landing.jsx polls its fixed
  6 homepage symbols). Keep this pattern for any new place that renders
  PriceChart for non-crypto symbols — don't let PriceChart call
  useMarketQuotes itself.
- src/assetCatalog.js's non-crypto side is the curated catalog — trimmed
  2026-09-06 to 6 stocks (AAPL, MSFT, AMZN, NVDA, TSLA, NFLX), 3 index
  ETFs (SPY, QQQ, DIA), 2 forex pairs (EUR/USD, USD/JPY) = 11 symbols
  total, down from 32 — see the credit-exhaustion incident above; this
  was a deliberate tradeoff to survive on Twelve Data's free tier, not a
  data-availability limit. Deliberately not "all stocks/every pair",
  which isn't realistically buildable on this data budget regardless.
  The crypto side is much broader (61 coins) — see the Crypto Catalog
  section above — since that data comes from
  Coinbase/Binance, which aren't credit-metered the way Twelve Data is.

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
- IMPORTANT — how funds actually reach the user (2026-09-06): the address
  a customer pays (`payment.pay_address` in create-payment.js) is
  generated by NOWPayments' own /v1/payment API call, unique per invoice
  — nothing in this codebase sets, stores, or forwards to any wallet.
  This came up because a real $2 test payment didn't land in the wallet
  the user expected, and the user asked to hardcode a specific ETH
  address (0xfBe9Dc46f9985B1dA483D3e4FA7F65F5fa82946F) as the deposit
  address. That would have broken the whole flow: NOWPayments only
  confirms/webhooks payments to addresses IT generated, and a single
  shared address across all customers has no way to attribute which
  customer sent which payment (Ethereum has no memo/payment-ID field —
  this is the exact problem already flagged with the old, unused Banxa
  wallet approach in src/walletAddresses.js). Correct fix, which the user
  chose after this was explained: set that address as the PAYOUT wallet
  inside the NOWPayments dashboard's own settings (Settings > Payout/
  Withdrawal) — NOWPayments keeps generating unique per-invoice addresses
  for incoming payments (preserving auto-confirmation + correct
  crediting) and forwards collected funds to that address afterward. This
  is entirely external configuration on NOWPayments' platform; there is
  no code change and nothing to verify from inside this repo. If asked
  again to hardcode a fixed deposit address anywhere in this flow, point
  back to this exact tradeoff before doing it.
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
