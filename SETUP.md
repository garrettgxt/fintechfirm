# Coinstate Capital — React app setup

Privy handles login (email, Google, Apple) AND creates each user's
self-custodial wallet automatically. Banxa is wired up to buy crypto
straight into that wallet. Supabase backs the admin Demo Mode feature
(overriding a wallet's displayed balance). Live prices and charts stream
from Coinbase's public WebSocket feed and Binance's public klines API (no
keys needed for either). The site is deployed on **Cloudflare Pages**, with
Cloudflare Pages Functions (the `functions/` folder) providing the
server-side pieces.

## 1. Install dependencies

Open a terminal in this folder and run:

    npm install

## 2. Get Banxa partner access

Banxa's referral integration isn't self-serve — you have to apply and get
approved before you get credentials:

1. Apply at [banxa.com/talk-to-our-team](https://banxa.com/talk-to-our-team/)
   for partner/API access.
2. Once approved, get your `partnerRef` (a subdomain) and sandbox API key
   from Banxa's Partner Dashboard. Per their docs, sandbox access is
   typically available within minutes of approval.
3. Open `src/banxaConfig.js` and replace `BANXA_PARTNER_REF` with the real
   value. Leave `BANXA_SANDBOX = true` until Banxa approves you for
   production (a separate, later approval).

Your Privy App ID is already filled in (`src/privyConfig.js`) — nothing to
change there.

## 2b. Get NOWPayments access (for the "Add credit" flow)

Separate from Banxa, there's a second, custodial way to add funds: a user
pays with crypto they already have, and Coinstate Capital's own
NOWPayments account receives it and credits their site balance. This is
self-serve, no business verification required for crypto-only flows:

1. Sign up at [nowpayments.io](https://nowpayments.io).
2. From your dashboard, get an **API key**, and generate an **IPN secret
   key** (Payment Settings section).
3. Set both as Cloudflare Pages secrets — see step 5 below.

**Important:** this makes Coinstate Capital an actual custodian of that
money, which conflicts with the site's own footer/Auth page copy claiming
it never holds customer funds. That's a known, deliberately-deferred
inconsistency (see CLAUDE.md) — resolve it (update the copy, or get real
legal advice on the money-transmission implications) before real users hit
this feature with real money.

## 3. Run it locally to check it works

    npm run dev

Open the URL it gives you (usually http://localhost:5173). Note: wallet
registration, Demo Mode lookups, Banxa's checkout, and Add credit will
show errors locally, because those depend on the `functions/` folder,
which only runs once deployed to Cloudflare Pages — that's expected, not a
bug. Live prices and charts work locally too, since they call public
third-party APIs directly from the browser.

To test the `functions/` folder itself locally: `npm run build`, then
`wrangler pages dev dist` (serves the built site + functions together on
http://127.0.0.1:8788). Put test values in a `.dev.vars` file (gitignored)
in the project root to supply env vars locally, e.g.:

    SUPABASE_URL=...
    SUPABASE_SERVICE_ROLE_KEY=...
    NOWPAYMENTS_API_KEY=...
    NOWPAYMENTS_IPN_SECRET=...
    ADMIN_PASSWORD=...

## 4. Deploy to Cloudflare Pages

The site is already live on Cloudflare Pages, deployed automatically via
Cloudflare's GitHub integration — pushing to the connected branch triggers a
build and deploy, no manual steps needed. `functions/*.js` is auto-detected
and deployed as Pages Functions (each file's `onRequest(context)` export
maps to a route matching its filename, e.g. `functions/get-override.js` →
`/get-override`).

If setting this up fresh: in the Cloudflare dashboard, Workers & Pages →
Create → Pages → connect to this GitHub repo. Build command `npm run build`,
build output directory `dist`.

## 5. Required environment variables (Cloudflare Pages dashboard)

In the Pages project → Settings → Environment variables, add (for both
Production and Preview):

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | `functions/get-override.js`, `register-wallet.js`, `admin-list.js`, `admin-update.js`, `create-payment.js`, `nowpayments-webhook.js`, `get-credit-balance.js`, `payment-status.js` | e.g. `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | same as above | From Supabase Project Settings → API → `service_role` key. This bypasses row-level security — server-side only, never in `src/` or the browser. |
| `ADMIN_PASSWORD` | `functions/admin-list.js`, `admin-update.js` | Password gating the `/admin` panel (sent as the `x-admin-password` header). |
| `NOWPAYMENTS_API_KEY` | `functions/create-payment.js` | From your NOWPayments dashboard (see step 2b). |
| `NOWPAYMENTS_IPN_SECRET` | `functions/nowpayments-webhook.js` | Generated in NOWPayments' Payment Settings — NOT the same as the API key. Used to verify that webhook calls actually came from NOWPayments before crediting any balance. |

Banxa's referral integration needs no server-side secret — `BANXA_PARTNER_REF`
lives in `src/banxaConfig.js` since it's just a subdomain, not a private key.

Redeploy after adding/changing any of these (Pages → Deployments → retry
latest, or just push a commit).

## 6. Supabase setup

Supabase is required, not optional — it stores the `wallet_overrides` table
that backs the admin Demo Mode feature (letting an admin show a fake
balance/asset for a given wallet instead of its real on-chain balance).

The app talks to Supabase only server-side, via plain REST calls from the
Cloudflare Pages Functions in `functions/` (no `@supabase/supabase-js`
client, no Supabase code in `src/`).

`wallet_overrides` columns used by the functions:
`wallet_address` (text, primary/unique key), `email` (text, nullable),
`demo_mode` (bool), `demo_balance_usd` (numeric), `demo_asset` (text),
`demo_asset_amount` (numeric), `updated_at` (timestamptz).

The Add-credit flow adds two more tables (see
`supabase/migrations/20260905214448_add_credit_system.sql`):
`credit_payments` (one row per NOWPayments payment — the audit trail and
idempotency guard) and `user_credits` (`wallet_address`, `balance_usd`) —
the actual custodial balance shown on the dashboard.

This repo is already linked to the Supabase project (`supabase link`).
Schema changes should go through migrations (`supabase migration new
<name>`, edit the SQL, `supabase db push`) rather than one-off manual SQL,
so there's a real history of schema changes.

In your Privy dashboard, make sure your Cloudflare Pages URL is listed under
allowed domains.

## 7. Test the real flow

1. Visit your Cloudflare Pages URL, click "Create your wallet"
2. Log in with email, Google, or Apple through Privy's popup
3. You'll land on `/dashboard` — a wallet address should appear within a
   few seconds (Privy creating it automatically), and the wallet gets
   registered into `wallet_overrides` via `register-wallet.js`
4. Click "Buy crypto", choose a currency, then "Continue to Banxa" —
   Banxa's sandbox checkout should open in a new tab, pre-filled with your
   wallet address
5. Complete a test purchase using Banxa's sandbox test flow (see their
   sandbox docs) — nothing costs real money while `BANXA_SANDBOX = true`
6. Visit `/admin`, enter the `ADMIN_PASSWORD`, and confirm you can see and
   toggle Demo Mode for a registered wallet
7. Click "Add credit" in the dashboard sidebar, pick an amount and
   currency, and confirm an invoice (QR code, exact amount, address,
   countdown) appears. Paying it should flip the modal to "Payment
   received" and increase "Site credit" — this requires
   `NOWPAYMENTS_API_KEY` / `NOWPAYMENTS_IPN_SECRET` to be set first.

## What's real vs. what's next

**Real now:** login, wallet creation, live streaming prices and charts,
Banxa sandbox purchases (once `BANXA_PARTNER_REF` is filled in) landing on
a real wallet address, admin Demo Mode overrides via Supabase, and Add
Credit (once the NOWPayments env vars are set) crediting a custodial site
balance.

**Not built yet:**
- Reading the wallet's actual on-chain balance to show in the holdings
  table (currently shows a static "$0.00" / empty state, unless Demo Mode
  is on for that wallet)
- Stock investing (Alpaca integration)
- Production Banxa access (requires their approval — separate from
  anything here)
- Reconciling Add Credit's custodial model with the site's self-custodial
  copy — see the note in step 2b and CLAUDE.md
