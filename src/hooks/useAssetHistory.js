// Shared "fetch chart history for one symbol+range" logic, used by both
// PriceChart.jsx (compact cards, 1D/1W/1M) and AssetDetailPanel.jsx (the
// bigger per-asset view, full range set). Crypto history comes from
// Binance's public klines endpoint (generous free, keyless rate limits).
// Stock/ETF/forex history comes from functions/market-history.js (Twelve
// Data, proxied).

import { useEffect, useState } from "react";

// A page can mount many cards at once (e.g. 30+ on the Markets tab), and
// unlike quotes (batched into one request by the caller), each card's
// history is its own separate call to Twelve Data — whose free tier is
// only 8 requests/minute, shared across every visitor. Without this,
// a page full of cards trips that limit immediately (confirmed in
// production: a 6-card page alone was enough to get every card a 429).
// This queue serializes market-history requests with a fixed gap between
// them so a big page drains through the limit instead of overrunning it;
// crypto history (Binance, generous limits) skips this entirely.
let historyQueueTail = Promise.resolve();
const HISTORY_MIN_GAP_MS = 4000;

function enqueueHistoryFetch(run) {
  const result = historyQueueTail.then(async () => {
    try {
      return await run();
    } finally {
      await new Promise((r) => setTimeout(r, HISTORY_MIN_GAP_MS));
    }
  });
  historyQueueTail = result.catch(() => {});
  return result;
}

function buildUrl(symbol, isCrypto, range) {
  return isCrypto
    ? `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${range.interval}&limit=${range.limit}`
    : `/market-history?symbol=${encodeURIComponent(symbol)}&interval=${range.interval}&outputsize=${range.outputsize}`;
}

// Returns the chart points array ({time, value}[]), or null while loading
// / on failure (caller decides how to render that — e.g. keep showing the
// previous range's data, or a loading state).
export function useAssetHistory(symbol, type, range) {
  const isCrypto = type === "crypto";
  const [points, setPoints] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const url = buildUrl(symbol, isCrypto, range);
    const maxAttempts = isCrypto ? 3 : 4;

    async function loadWithRetry() {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return;
        try {
          const res = isCrypto ? await fetch(url) : await enqueueHistoryFetch(() => fetch(url));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;

          let result;
          if (isCrypto) {
            if (!Array.isArray(data)) throw new Error("Unexpected response shape");
            const seen = new Set();
            result = [];
            for (const candle of data) {
              const time = Math.floor(candle[0] / 1000);
              const close = parseFloat(candle[4]);
              if (seen.has(time) || Number.isNaN(close)) continue;
              seen.add(time);
              result.push({ time, value: close });
            }
          } else {
            if (!Array.isArray(data.points)) throw new Error(data.error || "Unexpected response shape");
            result = data.points;
          }

          setPoints(result);
          return;
        } catch (err) {
          if (attempt === maxAttempts - 1) console.error(`Failed to load ${symbol} history:`, err);
          else if (isCrypto) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          // Non-crypto retries already wait via the queue's fixed gap.
        }
      }
    }

    loadWithRetry();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, isCrypto, range.interval, range.limit, range.outputsize]);

  return points;
}
