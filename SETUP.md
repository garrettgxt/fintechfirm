# Coinstate Capital — React app setup

This replaces the old static HTML site's auth/dashboard with a real React app.
Privy now handles login (email, Google, Apple) AND creates each user's
self-custodial wallet automatically. MoonPay is wired to buy crypto straight
into that wallet.

## 1. Install dependencies

Open a terminal in this folder and run:

    npm install

## 2. Fill in your MoonPay test key

Open `src/moonpayConfig.js` and replace the placeholder with your real
MoonPay **Test Publishable Key** (starts with `pk_test_`) from
dashboard.moonpay.com → Developers → API Keys.

Your Privy App ID is already filled in (`src/privyConfig.js`) — nothing to
change there.

## 3. Run it locally to check it works

    npm run dev

Open the URL it gives you (usually http://localhost:5173). Note: the "Buy
crypto" button will show an error locally, because the URL-signing function
(step 5) only runs once deployed to Netlify — that's expected, not a bug.

## 4. Deploy to Netlify

- Go to netlify.com, sign up/log in
- Drag this whole folder onto the Netlify dashboard, OR connect it to a
  GitHub repo for automatic deploys
- Netlify will detect `netlify.toml` and build it automatically

## 5. Add your MoonPay SECRET key to Netlify (server-side only)

This is the key that must never appear in any file in this folder.

- In your Netlify site: Site settings → Environment variables → Add variable
- Key: `MOONPAY_SECRET_KEY`
- Value: your MoonPay **Test Secret Key** (starts with `sk_test_`, also from
  Developers → API Keys)
- Redeploy the site after adding it (Netlify → Deploys → Trigger deploy)

## 6. Update Supabase / Privy allowed domains

- In your Privy dashboard: add your new Netlify URL under allowed domains
- If you still want Supabase for anything (e.g. storing extra profile data
  later), update its Site URL / Redirect URLs the same way we discussed
  earlier — but note Supabase is no longer required for login, since Privy
  now handles that directly.

## 7. Test the real flow

1. Visit your Netlify URL, click "Create your wallet"
2. Log in with email, Google, or Apple through Privy's popup
3. You'll land on `/dashboard` — a wallet address should appear within a
   few seconds (Privy creating it automatically)
4. Click "Buy crypto" — MoonPay's sandbox widget should open, pre-filled
   with your wallet address
5. Complete a test purchase using MoonPay's sandbox test card details (see
   their sandbox docs) — the crypto is testnet-only in sandbox mode, so
   nothing costs real money

## What's real vs. what's next

**Real now:** login, wallet creation, MoonPay sandbox purchases landing on
a real (testnet) wallet address.

**Not built yet:**
- Reading the wallet's actual on-chain balance to show in the holdings
  table (currently shows a static "$0.00" / empty state)
- Stock investing (Alpaca integration)
- Production MoonPay keys (requires their KYB approval — separate from
  anything here)
