import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries } from "lightweight-charts";
import { useLivePrices } from "../hooks/useLivePrices.js";
import { useAssetHistory } from "../hooks/useAssetHistory.js";
import { formatPrice } from "../formatPrice.js";
import { TV_SYMBOLS } from "../assetCatalog.js";
import TradingViewWidget from "./TradingViewWidget.jsx";

// Crypto history comes from Binance's public klines endpoint (generous
// free, keyless rate limits) via our own lightweight-charts rendering.
// Stock/ETF/forex charts are TradingView's free embed widget instead
// (TradingViewWidget.jsx, chartOnly mode) — Twelve Data's time_series
// endpoint isn't batchable and was the dominant cost behind a real
// credit-exhaustion incident (see CLAUDE.md), so non-crypto charts no
// longer call it at all. chartOnly strips the widget's own name/price/
// date-tab row (which duplicated our own header in two widget types
// tried first), so MARKET_RANGES drives our own toggle instead, styled
// like the crypto one below — `tv` is TradingView's own range id,
// appended to the symbol string (see TradingViewWidget.jsx).
const CRYPTO_RANGES = [
  { label: "1D", interval: "5m", limit: 288 },
  { label: "1W", interval: "1h", limit: 168 },
  { label: "1M", interval: "4h", limit: 180 },
];
const MARKET_RANGES = [
  { label: "1D", tv: "1d" },
  { label: "1M", tv: "1m" },
  { label: "3M", tv: "3m" },
  { label: "1Y", tv: "12m" },
  { label: "5Y", tv: "60m" },
  { label: "All", tv: "all" },
];

const CRYPTO_LABELS = { BTC: "Bitcoin", ETH: "Ethereum", LTC: "Litecoin", SOL: "Solana" };

const UP_COLORS = { lineColor: "#5C8F72", topColor: "rgba(92,143,114,0.28)" };
const DOWN_COLORS = { lineColor: "#A25A45", topColor: "rgba(162,90,69,0.28)" };

// For type !== "crypto", pass `quote` (from useMarketQuotes) from a single
// batched call in the parent — a card doesn't poll its own quote, since a
// screen full of cards would each fire a separate upstream request and
// burn through Twelve Data's shared daily credit cap. Crypto keeps using
// its own useLivePrices() call directly; that's a shared WebSocket
// singleton, so per-card use is free.
export default function PriceChart({ symbol, name, type = "crypto", quote, onBuy, onSell, holdingQuantity }) {
  const isCrypto = type === "crypto";
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [range, setRange] = useState(CRYPTO_RANGES[0]);
  const [marketRange, setMarketRange] = useState(MARKET_RANGES[0]);

  const cryptoPrices = useLivePrices();
  const live = isCrypto ? cryptoPrices[symbol] : quote;
  const isUp = (live?.changePct ?? live?.changePct24h ?? 0) >= 0;
  const changePct = live?.changePct ?? live?.changePct24h ?? null;
  const points = useAssetHistory(symbol, type, range, isCrypto);

  // Create the chart once per mounted card. Crypto only — non-crypto
  // renders TradingViewWidget instead (see below).
  useEffect(() => {
    if (!isCrypto) return;
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
  }, [symbol, isCrypto]);

  // Flip the fill/line color if the trend direction changes.
  useEffect(() => {
    if (!isCrypto) return;
    seriesRef.current?.applyOptions(isUp ? UP_COLORS : DOWN_COLORS);
  }, [isUp, isCrypto]);

  // Push newly-loaded history into the chart.
  useEffect(() => {
    if (!isCrypto || !points || !seriesRef.current) return;
    seriesRef.current.setData(points);
    chartRef.current?.timeScale().fitContent();
  }, [points, isCrypto]);

  // Append each new price (real-time tick) onto the end of the chart.
  useEffect(() => {
    if (!isCrypto || live?.price == null || !seriesRef.current) return;
    seriesRef.current.update({ time: Math.floor(Date.now() / 1000), value: live.price });
  }, [live?.price, isCrypto]);

  const changeColor = isUp ? "var(--sage)" : "var(--rust)";
  const displayName = name || CRYPTO_LABELS[symbol] || symbol;

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <div className="chart-card-title">
            {displayName} <span className="chart-card-symbol">{symbol}</span>
          </div>
          {isCrypto && (
            <div className="chart-card-price num">
              {live?.price != null ? formatPrice(live.price) : "Loading…"}
              {changePct != null && (
                <span className="chart-card-change" style={{ color: changeColor }}>
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(2)}%
                </span>
              )}
            </div>
          )}
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
      {isCrypto ? (
        <>
          <div className="chart-range-toggle">
            {CRYPTO_RANGES.map((r) => (
              <button key={r.label} className={r.label === range.label ? "active" : ""} onClick={() => setRange(r)}>
                {r.label}
              </button>
            ))}
          </div>
          <div ref={containerRef} className="chart-canvas" />
        </>
      ) : (
        <>
          <div className="chart-range-toggle">
            {MARKET_RANGES.map((r) => (
              <button
                key={r.label}
                className={r.label === marketRange.label ? "active" : ""}
                onClick={() => setMarketRange(r)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <TradingViewWidget tvSymbol={TV_SYMBOLS[symbol]} height={220} rangeCode={marketRange.tv} />
        </>
      )}
    </div>
  );
}
