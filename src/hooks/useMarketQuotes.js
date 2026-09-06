// Shared polling hook for stock/ETF/forex quotes via functions/market-quote.js
// (Twelve Data, proxied so the API key never reaches the browser).
//
// Unlike useLivePrices (a real-time WebSocket for crypto), this polls a
// batched REST endpoint every ~45s — matching the cache window that
// function uses server-side, so polling faster wouldn't get fresher data
// anyway, just waste the shared rate limit.

import { useEffect, useRef, useState } from "react";

const POLL_MS = 45000;

// One shared store + poller per unique set of symbols, so multiple
// components asking for overlapping symbols don't each start their own
// polling loop. Keyed by the sorted, comma-joined symbol list.
const stores = new Map();

function getStore(key) {
  if (!stores.has(key)) {
    stores.set(key, { quotes: {}, listeners: new Set(), interval: null, refCount: 0 });
  }
  return stores.get(key);
}

async function poll(key, symbols) {
  const store = stores.get(key);
  if (!store) return;
  try {
    const res = await fetch(`/market-quote?symbols=${encodeURIComponent(symbols.join(","))}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.quotes)) return;
    for (const q of data.quotes) {
      // Keep the whole quote (price/changePct plus open/high/low/volume/
      // 52-week/exchange) — the asset detail page's "Market details"
      // needs those, not just price/changePct.
      store.quotes[q.symbol] = q;
    }
    for (const listener of store.listeners) listener();
  } catch (err) {
    console.error("Failed to poll market quotes:", err);
  }
}

export function useMarketQuotes(symbols) {
  const key = [...symbols].sort().join(",");
  const [, setTick] = useState(0);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!key) return;
    const store = getStore(key);
    store.refCount++;

    const listener = () => setTick((t) => t + 1);
    store.listeners.add(listener);

    if (!store.interval) {
      poll(key, symbols);
      store.interval = setInterval(() => poll(key, symbols), POLL_MS);
    }

    return () => {
      store.listeners.delete(listener);
      store.refCount--;
      if (store.refCount <= 0) {
        clearInterval(store.interval);
        stores.delete(key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return stores.get(key)?.quotes || {};
}
