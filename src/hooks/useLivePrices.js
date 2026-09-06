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

// Every symbol here must be a real Coinbase Exchange USD product (verified
// against https://api.exchange.coinbase.com/products) — Coinbase silently
// ignores a subscribe request for an unknown product_id, which looks
// exactly like "Loading forever" with no error. TRX, for example, isn't
// listed on Coinbase Exchange at all, which is why the catalog uses UNI
// instead — check before adding another symbol here.
const PRODUCTS = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  LTC: "LTC-USD",
  SOL: "SOL-USD",
  XRP: "XRP-USD",
  DOGE: "DOGE-USD",
  ADA: "ADA-USD",
  AVAX: "AVAX-USD",
  DOT: "DOT-USD",
  LINK: "LINK-USD",
  BNB: "BNB-USD",
  UNI: "UNI-USD",
  // Verified against https://api.exchange.coinbase.com/products before
  // adding — see the matching comment in src/assetCatalog.js.
  BCH: "BCH-USD",
  XLM: "XLM-USD",
  ALGO: "ALGO-USD",
  ATOM: "ATOM-USD",
  FIL: "FIL-USD",
  AAVE: "AAVE-USD",
  GRT: "GRT-USD",
  MANA: "MANA-USD",
  SAND: "SAND-USD",
  XTZ: "XTZ-USD",
  COMP: "COMP-USD",
  CRV: "CRV-USD",
  YFI: "YFI-USD",
  SUSHI: "SUSHI-USD",
  BAT: "BAT-USD",
  ZRX: "ZRX-USD",
  SHIB: "SHIB-USD",
  APE: "APE-USD",
  OP: "OP-USD",
  ARB: "ARB-USD",
  NEAR: "NEAR-USD",
  ICP: "ICP-USD",
  HBAR: "HBAR-USD",
  VET: "VET-USD",
  ZEC: "ZEC-USD",
  DASH: "DASH-USD",
  ETC: "ETC-USD",
  ENS: "ENS-USD",
  LDO: "LDO-USD",
  PEPE: "PEPE-USD",
  SUI: "SUI-USD",
  SEI: "SEI-USD",
  INJ: "INJ-USD",
  RENDER: "RENDER-USD",
  IMX: "IMX-USD",
  FLOW: "FLOW-USD",
  CHZ: "CHZ-USD",
  SNX: "SNX-USD",
  STX: "STX-USD",
  POL: "POL-USD",
  MINA: "MINA-USD",
  KSM: "KSM-USD",
  JASMY: "JASMY-USD",
  MASK: "MASK-USD",
  GMT: "GMT-USD",
  TIA: "TIA-USD",
  PYTH: "PYTH-USD",
  JTO: "JTO-USD",
  WIF: "WIF-USD",
  BONK: "BONK-USD",
};

const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  LTC: "litecoin",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  LINK: "chainlink",
  BNB: "binancecoin",
  UNI: "uniswap",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  ALGO: "algorand",
  ATOM: "cosmos",
  FIL: "filecoin",
  AAVE: "aave",
  GRT: "the-graph",
  MANA: "decentraland",
  SAND: "the-sandbox",
  XTZ: "tezos",
  COMP: "compound-governance-token",
  CRV: "curve-dao-token",
  YFI: "yearn-finance",
  SUSHI: "sushi",
  BAT: "basic-attention-token",
  ZRX: "0x",
  SHIB: "shiba-inu",
  APE: "apecoin",
  OP: "optimism",
  ARB: "arbitrum",
  NEAR: "near",
  ICP: "internet-computer",
  HBAR: "hedera-hashgraph",
  VET: "vechain",
  ZEC: "zcash",
  DASH: "dash",
  ETC: "ethereum-classic",
  ENS: "ethereum-name-service",
  LDO: "lido-dao",
  PEPE: "pepe",
  SUI: "sui",
  SEI: "sei-network",
  INJ: "injective-protocol",
  RENDER: "render-token",
  IMX: "immutable-x",
  FLOW: "flow",
  CHZ: "chiliz",
  SNX: "havven",
  STX: "blockstack",
  POL: "polygon-ecosystem-token",
  MINA: "mina-protocol",
  KSM: "kusama",
  JASMY: "jasmycoin",
  MASK: "mask-network",
  GMT: "stepn",
  TIA: "celestia",
  PYTH: "pyth-network",
  JTO: "jito-governance-token",
  WIF: "dogwifcoin",
  BONK: "bonk",
};

const HISTORY_LENGTH = 60; // ~last few minutes of ticks, enough for a sparkline

const store = {
  prices: Object.fromEntries(
    Object.keys(PRODUCTS).map((symbol) => [symbol, { price: null, prevPrice: null, changePct24h: null, history: [] }])
  ),
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
