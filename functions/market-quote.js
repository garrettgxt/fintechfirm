// Cloudflare Pages Function: batched live quotes for stocks/ETFs/forex via
// Twelve Data. Crypto does NOT go through here — it uses the existing
// Coinbase/Binance pipeline (src/hooks/useLivePrices.js).
//
// Twelve Data's free tier is rate-limited (8 req/min, 800/day CREDITS —
// and a batched quote request costs 1 credit PER SYMBOL, not per HTTP
// call) and that limit is shared across every visitor to the site, not
// per-user — so this caches its upstream response using the Cache API,
// keyed by the exact request URL. Many simultaneous visitors then share
// one upstream call per cache window instead of each triggering their
// own. Confirmed in production: with the old 45s cache, a single open
// Dashboard tab polling ~32 symbols burned the entire 800/day quota in
// under 20 minutes (1995 credits used against an 800 cap in one session).
// 5 minutes is still not enough for sustained heavy traffic on the free
// tier — a paid Twelve Data plan is the real fix if this needs to hold up
// under real usage — but it cuts the burn rate ~6.7x for now.
//
// FALLBACK (2026-09-06): the daily cap keeps getting exhausted (a real,
// recurring incident — see CLAUDE.md) and while it's exhausted, Demo Mode
// market buys were completely blocked ("Waiting for a live price..."),
// even though Demo Mode doesn't need a perfectly fresh number. Every
// successful quote is now persisted to Supabase's market_quote_cache
// table; when Twelve Data itself fails, this falls back to the last
// cached value per symbol instead of erroring out. A symbol that's never
// been successfully fetched yet still comes back with price: null — this
// can't invent a price from nothing, only remember one that was real.
//
// SETUP (in Cloudflare dashboard):
//   Settings > Environment variables > add:
//     TWELVE_DATA_API_KEY = (from your Twelve Data dashboard)

const EMPTY_QUOTE_FIELDS = {
  price: null,
  changePct: null,
  open: null,
  high: null,
  low: null,
  previousClose: null,
  volume: null,
  avgVolume: null,
  fiftyTwoWeekHigh: null,
  fiftyTwoWeekLow: null,
  exchange: null,
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const symbolsParam = url.searchParams.get("symbols");
  if (!symbolsParam) {
    return new Response(JSON.stringify({ error: "symbols parameter is required" }), { status: 400 });
  }

  const apiKey = context.env.TWELVE_DATA_API_KEY;
  const supabaseUrl = context.env.SUPABASE_URL;
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Market data provider not configured" }), { status: 500 });
  }

  const cache = caches.default;
  const cacheKey = new Request(context.request.url, context.request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const symbols = symbolsParam.split(",");

  try {
    const twelveDataUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolsParam)}&apikey=${apiKey}`;
    const res = await fetch(twelveDataUrl);
    if (!res.ok) {
      return await respondWithCachedFallback(symbols, supabaseUrl, serviceKey, `Twelve Data error: HTTP ${res.status}`);
    }
    const data = await res.json();

    // A single symbol returns one object; multiple symbols return
    // { "AAPL": {...}, "TSLA": {...} } — normalize to an array either way.
    const num = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const quotes = symbols.map((symbol) => {
      const entry = symbols.length === 1 ? data : data[symbol];
      return {
        symbol,
        price: num(entry?.close),
        changePct: num(entry?.percent_change),
        // Extra fields for the asset detail page's "Market details" —
        // only what Twelve Data's quote response actually provides, no
        // faked/estimated values for anything it doesn't.
        open: num(entry?.open),
        high: num(entry?.high),
        low: num(entry?.low),
        previousClose: num(entry?.previous_close),
        volume: num(entry?.volume),
        avgVolume: num(entry?.average_volume),
        fiftyTwoWeekHigh: num(entry?.fifty_two_week?.high),
        fiftyTwoWeekLow: num(entry?.fifty_two_week?.low),
        exchange: entry?.exchange ?? null,
      };
    });

    if (supabaseUrl && serviceKey) {
      context.waitUntil(cacheQuotes(quotes, supabaseUrl, serviceKey));
    }

    const response = new Response(JSON.stringify({ quotes }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return await respondWithCachedFallback(symbols, supabaseUrl, serviceKey, `Unexpected error: ${err.message}`);
  }
}

async function cacheQuotes(quotes, supabaseUrl, serviceKey) {
  const rows = quotes
    .filter((q) => q.price != null)
    .map((q) => ({ symbol: q.symbol, data: q, updated_at: new Date().toISOString() }));
  if (rows.length === 0) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/market_quote_cache?on_conflict=symbol`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
  } catch {
    // Best-effort cache — a failure here just means the next outage has
    // one fewer symbol to fall back on, not worth surfacing to the user.
  }
}

async function respondWithCachedFallback(symbols, supabaseUrl, serviceKey, upstreamError) {
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: upstreamError }), { status: 502 });
  }
  try {
    const symbolFilter = symbols.map((s) => encodeURIComponent(s)).join(",");
    const res = await fetch(
      `${supabaseUrl}/rest/v1/market_quote_cache?symbol=in.(${symbolFilter})&select=symbol,data`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) throw new Error("cache lookup failed");
    const rows = await res.json();
    const bySymbol = Object.fromEntries(rows.map((r) => [r.symbol, r.data]));
    const quotes = symbols.map((symbol) => bySymbol[symbol] || { symbol, ...EMPTY_QUOTE_FIELDS });
    return new Response(JSON.stringify({ quotes, stale: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: upstreamError }), { status: 502 });
  }
}
