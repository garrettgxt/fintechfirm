// Cloudflare Pages Function: historical candles for stocks/ETFs/forex via
// Twelve Data's time_series endpoint, reshaped into the same
// {time, value}[] format PriceChart.jsx already uses for crypto (from
// Binance klines), and cached the same way as market-quote.js.
//
// SETUP: same TWELVE_DATA_API_KEY as market-quote.js.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const symbol = url.searchParams.get("symbol");
  const interval = url.searchParams.get("interval") || "1day";
  const outputsize = url.searchParams.get("outputsize") || "200";
  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol parameter is required" }), { status: 400 });
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
    const twelveDataUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;
    const res = await fetch(twelveDataUrl);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Twelve Data error: HTTP ${res.status}` }), { status: 502 });
    }
    const data = await res.json();
    if (data.status === "error" || !Array.isArray(data.values)) {
      return new Response(JSON.stringify({ error: data.message || "No data returned" }), { status: 502 });
    }

    // Twelve Data returns most-recent-first — lightweight-charts needs
    // ascending chronological order.
    const points = data.values
      .map((v) => ({
        time: Math.floor(new Date(v.datetime.replace(" ", "T") + "Z").getTime() / 1000),
        value: parseFloat(v.close),
      }))
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .reverse();

    const response = new Response(JSON.stringify({ points }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=45" },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${err.message}` }), { status: 502 });
  }
}
