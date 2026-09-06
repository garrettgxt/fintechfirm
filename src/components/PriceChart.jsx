import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries } from "lightweight-charts";
import { useLivePrices } from "../hooks/useLivePrices.js";

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

// Crypto history comes from Binance's public klines endpoint (generous
// free, keyless rate limits). Stock/ETF/forex history comes from
// functions/market-history.js (Twelve Data, proxied — see that file for
// why it's cached server-side).
const CRYPTO_RANGES = [
  { label: "1D", interval: "5m", limit: 288 },
  { label: "1W", interval: "1h", limit: 168 },
  { label: "1M", interval: "4h", limit: 180 },
];
const MARKET_RANGES = [
  { label: "1D", interval: "5min", outputsize: 100 },
  { label: "1W", interval: "1h", outputsize: 168 },
  { label: "1M", interval: "1day", outputsize: 30 },
];

const CRYPTO_LABELS = { BTC: "Bitcoin", ETH: "Ethereum", LTC: "Litecoin", SOL: "Solana" };

const UP_COLORS = { lineColor: "#5C8F72", topColor: "rgba(92,143,114,0.28)" };
const DOWN_COLORS = { lineColor: "#A25A45", topColor: "rgba(162,90,69,0.28)" };

// For type !== "crypto", pass `quote` ({price, changePct}) from a single
// batched useMarketQuotes call in the parent — a card doesn't poll its
// own quote, since a screen full of cards would each fire a separate
// upstream request and blow through Twelve Data's free-tier rate limit.
// Crypto keeps using its own useLivePrices() call directly; that's a
// shared WebSocket singleton, so per-card use is free.
export default function PriceChart({ symbol, name, type = "crypto", quote, onBuy, onSell, holdingQuantity }) {
  const isCrypto = type === "crypto";
  const ranges = isCrypto ? CRYPTO_RANGES : MARKET_RANGES;
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [range, setRange] = useState(ranges[0]);

  const cryptoPrices = useLivePrices();
  const live = isCrypto ? cryptoPrices[symbol] : quote;
  const isUp = (live?.changePct ?? live?.changePct24h ?? 0) >= 0;
  const changePct = live?.changePct ?? live?.changePct24h ?? null;

  // Create the chart once per mounted card.
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(237,231,218,0.55)",
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(237,231,218,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: "rgba(203,164,103,0.4)", labelBackgroundColor: "#16302B" },
        horzLine: { color: "rgba(203,164,103,0.4)", labelBackgroundColor: "#16302B" },
      },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      bottomColor: "rgba(92,143,114,0)",
      ...UP_COLORS,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol]);

  // Flip the fill/line color if the trend direction changes.
  useEffect(() => {
    seriesRef.current?.applyOptions(isUp ? UP_COLORS : DOWN_COLORS);
  }, [isUp]);

  // Load real history for the selected range.
  useEffect(() => {
    let cancelled = false;
    const url = isCrypto
      ? `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${range.interval}&limit=${range.limit}`
      : `/market-history?symbol=${encodeURIComponent(symbol)}&interval=${range.interval}&outputsize=${range.outputsize}`;

    const maxAttempts = isCrypto ? 3 : 4;

    async function loadWithRetry() {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return;
        try {
          const res = isCrypto ? await fetch(url) : await enqueueHistoryFetch(() => fetch(url));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled || !seriesRef.current) return;

          let points;
          if (isCrypto) {
            if (!Array.isArray(data)) throw new Error("Unexpected response shape");
            const seen = new Set();
            points = [];
            for (const candle of data) {
              const time = Math.floor(candle[0] / 1000);
              const close = parseFloat(candle[4]);
              if (seen.has(time) || Number.isNaN(close)) continue;
              seen.add(time);
              points.push({ time, value: close });
            }
          } else {
            if (!Array.isArray(data.points)) throw new Error(data.error || "Unexpected response shape");
            points = data.points;
          }

          seriesRef.current.setData(points);
          chartRef.current?.timeScale().fitContent();
          return;
        } catch (err) {
          if (attempt === maxAttempts - 1) console.error(`Failed to load ${symbol} history:`, err);
          else if (isCrypto) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          // Non-crypto retries already wait via the queue's fixed gap —
          // a 429 needs real time to pass, so no extra backoff here.
        }
      }
    }

    loadWithRetry();
    return () => {
      cancelled = true;
    };
  }, [symbol, range, isCrypto]);

  // Append each new price (real-time tick for crypto, polled quote for
  // stock/forex) onto the end of the chart.
  useEffect(() => {
    if (live?.price == null || !seriesRef.current) return;
    seriesRef.current.update({ time: Math.floor(Date.now() / 1000), value: live.price });
  }, [live?.price]);

  const changeColor = isUp ? "var(--sage)" : "var(--rust)";
  const displayName = name || CRYPTO_LABELS[symbol] || symbol;

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <div className="chart-card-title">
            {displayName} <span className="chart-card-symbol">{symbol}</span>
          </div>
          <div className="chart-card-price num">
            {live?.price != null
              ? `$${live.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "Loading…"}
            {changePct != null && (
              <span className="chart-card-change" style={{ color: changeColor }}>
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {onSell && holdingQuantity > 0 && (
            <button className="btn-secondary chart-buy-btn" onClick={() => onSell(symbol)}>
              Sell
            </button>
          )}
          {onBuy && (
            <button className="btn-secondary chart-buy-btn" onClick={() => onBuy(symbol)}>
              Buy
            </button>
          )}
        </div>
      </div>
      <div className="chart-range-toggle">
        {ranges.map((r) => (
          <button key={r.label} className={r.label === range.label ? "active" : ""} onClick={() => setRange(r)}>
            {r.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="chart-canvas" />
    </div>
  );
}
