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
// SETUP (in Cloudflare dashboard):
//   Settings > Environment variables > add:
//     TWELVE_DATA_API_KEY = (from your Twelve Data dashboard)

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const symbolsParam = url.searchParams.get("symbols");
  if (!symbolsParam) {
    return new Response(JSON.stringify({ error: "symbols parameter is required" }), { status: 400 });
  }

  const apiKey = context.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Market data provider not configured" }), { status: 500 });
  }

  const cache = caches.default;
  const cacheKey = new Request(context.request.url, context.request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const twelveDataUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolsParam)}&apikey=${apiKey}`;
    const res = await fetch(twelveDataUrl);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Twelve Data error: HTTP ${res.status}` }), { status: 502 });
    }
    const data = await res.json();

    // A single symbol returns one object; multiple symbols return
    // { "AAPL": {...}, "TSLA": {...} } — normalize to an array either way.
    const num = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const symbols = symbolsParam.split(",");
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

    const response = new Response(JSON.stringify({ quotes }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
