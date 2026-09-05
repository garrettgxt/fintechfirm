// Cloudflare Pages Function: batched live quotes for stocks/ETFs/forex via
// Twelve Data. Crypto does NOT go through here — it uses the existing
// Coinbase/Binance pipeline (src/hooks/useLivePrices.js).
//
// Twelve Data's free tier is rate-limited (8 req/min, 800/day) and that
// limit is shared across every visitor to the site, not per-user — so
// this caches its upstream response for ~45s using the Cache API, keyed
// by the exact request URL. Many simultaneous visitors then share one
// upstream call per cache window instead of each triggering their own.
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
    const symbols = symbolsParam.split(",");
    const quotes = symbols.map((symbol) => {
      const entry = symbols.length === 1 ? data : data[symbol];
      const price = parseFloat(entry?.close);
      const percentChange = parseFloat(entry?.percent_change);
      return {
        symbol,
        price: Number.isFinite(price) ? price : null,
        changePct: Number.isFinite(percentChange) ? percentChange : null,
      };
    });

    const response = new Response(JSON.stringify({ quotes }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=45" },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
