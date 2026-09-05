import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries } from "lightweight-charts";
import { useLivePrices } from "../hooks/useLivePrices.js";

// Binance's public klines endpoint has generous free, keyless rate limits
// (unlike CoinGecko's anonymous tier, which a handful of simultaneous
// chart loads can exhaust) — used here just for chart history. Live ticks
// still come from Coinbase (see useLivePrices).
const RANGES = [
  { label: "1D", interval: "5m", limit: 288 },
  { label: "1W", interval: "1h", limit: 168 },
  { label: "1M", interval: "4h", limit: 180 },
];

const LABELS = { BTC: "Bitcoin", ETH: "Ethereum", LTC: "Litecoin", SOL: "Solana" };

const UP_COLORS = { lineColor: "#5C8F72", topColor: "rgba(92,143,114,0.28)" };
const DOWN_COLORS = { lineColor: "#A25A45", topColor: "rgba(162,90,69,0.28)" };

export default function PriceChart({ symbol, onBuy }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [range, setRange] = useState(RANGES[0]);
  const prices = useLivePrices();
  const live = prices[symbol];
  const isUp = (live?.changePct24h ?? 0) >= 0;

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

  // Load real history for the selected range from Binance's public klines
  // endpoint. A couple of retries handle any transient network hiccup.
  useEffect(() => {
    let cancelled = false;
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${range.interval}&limit=${range.limit}`;

    async function loadWithRetry() {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const candles = await res.json();
          if (cancelled || !seriesRef.current || !Array.isArray(candles)) return;
          const seen = new Set();
          const points = [];
          for (const candle of candles) {
            const time = Math.floor(candle[0] / 1000);
            const close = parseFloat(candle[4]);
            if (seen.has(time) || Number.isNaN(close)) continue;
            seen.add(time);
            points.push({ time, value: close });
          }
          seriesRef.current.setData(points);
          chartRef.current?.timeScale().fitContent();
          return;
        } catch (err) {
          if (attempt === 2) console.error(`Failed to load ${symbol} history:`, err);
          else await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }

    loadWithRetry();
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  // Append each real-time tick onto the end of the chart.
  useEffect(() => {
    if (live?.price == null || !seriesRef.current) return;
    seriesRef.current.update({ time: Math.floor(Date.now() / 1000), value: live.price });
  }, [live?.price]);

  const changeColor = isUp ? "var(--sage)" : "var(--rust)";

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <div className="chart-card-title">
            {LABELS[symbol]} <span className="chart-card-symbol">{symbol}</span>
          </div>
          <div className="chart-card-price num">
            {live?.price != null
              ? `$${live.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "Loading…"}
            {live?.changePct24h != null && (
              <span className="chart-card-change" style={{ color: changeColor }}>
                {live.changePct24h >= 0 ? "+" : ""}
                {live.changePct24h.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        {onBuy && (
          <button className="btn-secondary chart-buy-btn" onClick={() => onBuy(symbol)}>
            Buy
          </button>
        )}
      </div>
      <div className="chart-range-toggle">
        {RANGES.map((r) => (
          <button key={r.label} className={r.label === range.label ? "active" : ""} onClick={() => setRange(r)}>
            {r.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="chart-canvas" />
    </div>
  );
}
