// Shared live crypto price feed.
//
// One Coinbase Exchange WebSocket connection (public, no API key) is
// shared by every component that calls useLivePrices() — the homepage
// ticker, the market charts, and the dashboard balance all read from the
// same module-level store instead of each opening their own socket.
//
// If the socket can't connect (blocked network, etc.) this falls back to
// polling CoinGecko's public REST API every 15s. Both sources are real
// market data — nothing here is simulated.

import { useEffect, useState } from "react";

const PRODUCTS = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  LTC: "LTC-USD",
  SOL: "SOL-USD",
};

const COINGECKO_IDS = { BTC: "bitcoin", ETH: "ethereum", LTC: "litecoin", SOL: "solana" };

const HISTORY_LENGTH = 60; // ~last few minutes of ticks, enough for a sparkline

const store = {
  prices: {
    BTC: { price: null, prevPrice: null, changePct24h: null, history: [] },
    ETH: { price: null, prevPrice: null, changePct24h: null, history: [] },
    LTC: { price: null, prevPrice: null, changePct24h: null, history: [] },
    SOL: { price: null, prevPrice: null, changePct24h: null, history: [] },
  },
  listeners: new Set(),
  started: false,
  ws: null,
  reconnectDelay: 1000,
  pollInterval: null,
};

function notify() {
  for (const listener of store.listeners) listener();
}

function applyTick(symbol, price, changePct24h) {
  const prev = store.prices[symbol];
  if (price == null || Number.isNaN(price)) return;
  const history = [...prev.history, price].slice(-HISTORY_LENGTH);
  store.prices[symbol] = {
    price,
    prevPrice: prev.price !== null ? prev.price : price,
    changePct24h: changePct24h !== undefined ? changePct24h : prev.changePct24h,
    history,
  };
  notify();
}

function stopPolling() {
  if (store.pollInterval) {
    clearInterval(store.pollInterval);
    store.pollInterval = null;
  }
}

function startPollingFallback() {
  if (store.pollInterval) return;
  const ids = Object.values(COINGECKO_IDS).join(",");

  async function poll() {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      );
      const data = await res.json();
      for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
        const entry = data?.[id];
        if (entry?.usd != null) {
          applyTick(symbol, entry.usd, entry.usd_24h_change ?? undefined);
        }
      }
    } catch (err) {
      console.error("Price polling fallback failed:", err);
    }
  }

  poll();
  store.pollInterval = setInterval(poll, 15000);
}

function connectWebSocket() {
  let socket;
  try {
    socket = new WebSocket("wss://ws-feed.exchange.coinbase.com");
  } catch (err) {
    startPollingFallback();
    return;
  }
  store.ws = socket;

  socket.onopen = () => {
    stopPolling();
    store.reconnectDelay = 1000;
    socket.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: Object.values(PRODUCTS),
        channels: ["ticker"],
      })
    );
  };

  socket.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type !== "ticker" || !msg.product_id) return;
    const symbol = Object.keys(PRODUCTS).find((s) => PRODUCTS[s] === msg.product_id);
    if (!symbol) return;

    const price = parseFloat(msg.price);
    const open24h = parseFloat(msg.open_24h);
    const changePct24h =
      open24h > 0 ? ((price - open24h) / open24h) * 100 : undefined;

    applyTick(symbol, price, changePct24h);
  };

  socket.onclose = () => {
    if (store.ws !== socket) return; // superseded by a newer connection
    startPollingFallback(); // keep data flowing while we retry the socket
    setTimeout(() => {
      store.reconnectDelay = Math.min(store.reconnectDelay * 2, 30000);
      connectWebSocket();
    }, store.reconnectDelay);
  };

  socket.onerror = () => {
    socket.close();
  };
}

function ensureStarted() {
  if (store.started) return;
  store.started = true;
  connectWebSocket();
}

export function useLivePrices() {
  const [, setTick] = useState(0);

  useEffect(() => {
    ensureStarted();
    const listener = () => setTick((t) => t + 1);
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  }, []);

  return store.prices;
}

export { PRODUCTS as LIVE_PRICE_PRODUCTS, COINGECKO_IDS };
