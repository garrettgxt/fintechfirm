import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries } from "lightweight-charts";
import { useLivePrices } from "../hooks/useLivePrices.js";
import { useAssetHistory } from "../hooks/useAssetHistory.js";
import { formatPrice } from "../formatPrice.js";

// Full range set, matching the reference screenshots. Crypto ranges pull
// from Binance klines (generous free limits); stock/ETF/forex ranges pull
// from functions/market-history.js (Twelve Data, rate-limited — see
// useAssetHistory.js for the shared request queue that protects it).
const CRYPTO_RANGES = [
  { label: "1D", interval: "5m", limit: 288 },
  { label: "1W", interval: "1h", limit: 168 },
  { label: "1M", interval: "4h", limit: 180 },
  { label: "3M", interval: "1d", limit: 90 },
  { label: "6M", interval: "1d", limit: 180 },
  { label: "YTD", interval: "1d", limit: 366 },
  { label: "1Y", interval: "1d", limit: 365 },
  { label: "5Y", interval: "1w", limit: 260 },
  { label: "10Y", interval: "1w", limit: 520 },
];
const MARKET_RANGES = [
  { label: "1D", interval: "5min", outputsize: 100 },
  { label: "1W", interval: "1h", outputsize: 168 },
  { label: "1M", interval: "1day", outputsize: 30 },
  { label: "3M", interval: "1day", outputsize: 90 },
  { label: "6M", interval: "1day", outputsize: 180 },
  { label: "YTD", interval: "1day", outputsize: 260 },
  { label: "1Y", interval: "1day", outputsize: 365 },
  { label: "5Y", interval: "1week", outputsize: 260 },
  { label: "10Y", interval: "1week", outputsize: 520 },
];

const UP_COLORS = { lineColor: "#5C8F72", topColor: "rgba(92,143,114,0.28)" };
const DOWN_COLORS = { lineColor: "#A25A45", topColor: "rgba(162,90,69,0.28)" };

function fmt(n, opts) {
  return n == null ? "—" : n.toLocaleString(undefined, opts);
}

function StatRow({ label, value }) {
  return (
    <div className="detail-stat">
      <div className="detail-stat-label">{label}</div>
      <div className="detail-stat-value num">{value}</div>
    </div>
  );
}

// The full per-asset page: big chart (all reference ranges), "Market
// details" stats, and a Buy/Sell panel supporting Market and Limit orders.
// Demo Mode only for now — see CLAUDE.md.
export default function AssetDetailPanel({
  asset,
  quote,
  walletAddress,
  demoMode,
  cashUsd,
  holdingQuantity = 0,
  onBack,
  onTraded,
}) {
  const { symbol, name, type } = asset;
  const isCrypto = type === "crypto";
  const ranges = isCrypto ? CRYPTO_RANGES : MARKET_RANGES;
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [range, setRange] = useState(ranges[0]);
  const [cryptoStats, setCryptoStats] = useState(null); // Binance 24hr ticker, crypto only

  const cryptoPrices = useLivePrices();
  const live = isCrypto ? cryptoPrices[symbol] : quote;
  const price = live?.price ?? null;
  const changePct = live?.changePct ?? live?.changePct24h ?? null;
  const isUp = (changePct ?? 0) >= 0;
  const points = useAssetHistory(symbol, type, range);

  // Trade panel state.
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("market");
  const [buyIn, setBuyIn] = useState("dollars"); // dollars | shares
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setSide("buy");
    setOrderType("market");
    setAmount("");
    setLimitPrice("");
    setError("");
    setSuccess("");
  }, [symbol]);

  // Crypto has no 52-week/exchange data from our feeds, but Binance's
  // 24hr ticker gives real open/high/low/volume for the "Market details"
  // grid — fetched client-side, same reasoning as chart history (Binance
  // blocks Cloudflare Workers' outbound IPs).
  useEffect(() => {
    if (!isCrypto) return;
    let cancelled = false;
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCryptoStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol, isCrypto]);

  useEffect(() => {
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
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

  useEffect(() => {
    seriesRef.current?.applyOptions(isUp ? UP_COLORS : DOWN_COLORS);
  }, [isUp]);

  useEffect(() => {
    if (!points || !seriesRef.current) return;
    seriesRef.current.setData(points);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  useEffect(() => {
    if (price == null || !seriesRef.current) return;
    seriesRef.current.update({ time: Math.floor(Date.now() / 1000), value: price });
  }, [price]);

  const changeColor = isUp ? "var(--sage)" : "var(--rust)";

  // Resolve the entered amount (in either dollars or shares/coins) into a
  // quantity, using the live price for market orders or the entered limit
  // price for limit orders (so the estimate reflects what the order will
  // actually use if/when it fills).
  const refPrice = orderType === "limit" ? parseFloat(limitPrice) : price;
  const amt = parseFloat(amount);
  const quantity =
    Number.isFinite(amt) && amt > 0 && Number.isFinite(refPrice) && refPrice > 0
      ? buyIn === "dollars"
        ? amt / refPrice
        : amt
      : null;
  const estimatedCost = quantity != null && Number.isFinite(refPrice) ? quantity * refPrice : null;

  const overBudget = side === "buy" && estimatedCost != null && estimatedCost > cashUsd;
  const overHolding = side === "sell" && quantity != null && quantity > holdingQuantity;
  const limitInvalid = orderType === "limit" && (!Number.isFinite(parseFloat(limitPrice)) || parseFloat(limitPrice) <= 0);
  const canSubmit =
    demoMode &&
    quantity != null &&
    quantity > 0 &&
    !overBudget &&
    !overHolding &&
    !limitInvalid &&
    (orderType === "market" ? price != null : true);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (orderType === "market") {
        const res = await fetch("/demo-trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, symbol, assetType: type, side, quantity, price }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Trade failed");
        setSuccess(`${side === "buy" ? "Bought" : "Sold"} ${quantity.toFixed(6).replace(/\.?0+$/, "")} ${symbol} at market.`);
      } else {
        const res = await fetch("/create-demo-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            symbol,
            assetType: type,
            side,
            quantity,
            limitPrice: parseFloat(limitPrice),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Order failed");
        setSuccess(
          `${side === "buy" ? "Buy" : "Sell"} limit order placed for ${quantity.toFixed(6).replace(/\.?0+$/, "")} ${symbol} at ${formatPrice(parseFloat(limitPrice))}. It'll fill automatically while your dashboard is open, once the price crosses.`
        );
      }
      setAmount("");
      setLimitPrice("");
      onTraded?.();
    } catch (err) {
      const known = {
        insufficient_cash: "Not enough demo cash for this trade.",
        insufficient_position: "You don't hold enough to sell that much.",
        demo_mode_not_active: "Demo Mode isn't active on this account.",
      };
      setError(known[err.message] || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const stats = isCrypto
    ? [
        ["Open (24h)", cryptoStats ? formatPrice(parseFloat(cryptoStats.openPrice)) : "—"],
        ["High (24h)", cryptoStats ? formatPrice(parseFloat(cryptoStats.highPrice)) : "—"],
        ["Low (24h)", cryptoStats ? formatPrice(parseFloat(cryptoStats.lowPrice)) : "—"],
        ["Volume (24h)", cryptoStats ? fmt(parseFloat(cryptoStats.volume), { maximumFractionDigits: 0 }) : "—"],
      ]
    : [
        ["Open", quote?.open != null ? formatPrice(quote.open) : "—"],
        ["Previous close", quote?.previousClose != null ? formatPrice(quote.previousClose) : "—"],
        ["High", quote?.high != null ? formatPrice(quote.high) : "—"],
        ["Low", quote?.low != null ? formatPrice(quote.low) : "—"],
        ["Volume", quote?.volume != null ? fmt(quote.volume, { maximumFractionDigits: 0 }) : "—"],
        ["Average volume", quote?.avgVolume != null ? fmt(quote.avgVolume, { maximumFractionDigits: 0 }) : "—"],
        ["52-week high", quote?.fiftyTwoWeekHigh != null ? formatPrice(quote.fiftyTwoWeekHigh) : "—"],
        ["52-week low", quote?.fiftyTwoWeekLow != null ? formatPrice(quote.fiftyTwoWeekLow) : "—"],
        ["Exchange", quote?.exchange || "—"],
      ];

  return (
    <div className="asset-detail">
      <button className="asset-detail-back" onClick={onBack}>&larr; Back</button>

      <div className="asset-detail-head">
        <div>
          <div className="asset-detail-title serif">
            {name} <span className="chart-card-symbol">{symbol}</span>
          </div>
          <div className="chart-card-price num" style={{ fontSize: 30, marginTop: 8 }}>
            {price != null ? formatPrice(price) : "Loading…"}
            {changePct != null && (
              <span className="chart-card-change" style={{ color: changeColor, fontSize: 15 }}>
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="asset-detail-grid">
        <div>
          <div className="chart-range-toggle">
            {ranges.map((r) => (
              <button key={r.label} className={r.label === range.label ? "active" : ""} onClick={() => setRange(r)}>
                {r.label}
              </button>
            ))}
          </div>
          <div ref={containerRef} className="chart-canvas" style={{ height: 360 }} />

          <div className="panel" style={{ marginTop: 24 }}>
            <h3>Market details</h3>
            <div className="detail-stats-grid">
              {stats.map(([label, value]) => (
                <StatRow key={label} label={label} value={value} />
              ))}
            </div>
          </div>
        </div>

        <div className="panel trade-panel">
          {!demoMode ? (
            <div style={{ fontSize: 13.5, color: "rgba(237,231,218,0.6)", lineHeight: 1.6 }}>
              Turn on Demo Mode to buy and sell {symbol} with simulated funds. Real-money investing in stocks, ETFs,
              and forex isn't available yet.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button className={`credit-chip ${side === "buy" ? "active" : ""}`} onClick={() => setSide("buy")}>
                  Buy
                </button>
                <button
                  className={`credit-chip ${side === "sell" ? "active" : ""}`}
                  onClick={() => setSide("sell")}
                  disabled={holdingQuantity <= 0}
                >
                  Sell
                </button>
              </div>

              <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 16 }}>
                Demo cash: ${cashUsd.toFixed(2)}
                {side === "sell" && ` · You hold ${holdingQuantity} ${symbol}`}
              </div>

              <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>Order type</div>
              <select
                className="asset-select"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                style={{ marginBottom: 16 }}
              >
                <option value="market">Market {side === "buy" ? "buy" : "sell"}</option>
                <option value="limit">Limit</option>
              </select>

              {orderType === "limit" && (
                <>
                  <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>Limit price (USD)</div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={price != null ? formatPrice(price).slice(1) : "0.00"}
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="credit-custom-amount num"
                    style={{ marginBottom: 16 }}
                  />
                </>
              )}

              <div className="credit-chip-row" style={{ marginBottom: 8 }}>
                <button className={`credit-chip ${buyIn === "dollars" ? "active" : ""}`} onClick={() => setBuyIn("dollars")}>
                  Dollars
                </button>
                <button className={`credit-chip ${buyIn === "shares" ? "active" : ""}`} onClick={() => setBuyIn("shares")}>
                  {isCrypto ? "Coins" : "Shares"}
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                placeholder={buyIn === "dollars" ? "Amount in USD" : `Number of ${symbol}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="credit-custom-amount num"
                style={{ marginBottom: 16 }}
              />

              {quantity != null && (
                <div style={{ fontSize: 13, color: "rgba(237,231,218,0.7)", marginBottom: 16 }}>
                  {buyIn === "dollars" ? (
                    <>≈ {quantity.toFixed(6).replace(/\.?0+$/, "")} {symbol}</>
                  ) : (
                    <>Estimated {side === "buy" ? "cost" : "proceeds"}: <strong>${estimatedCost?.toFixed(2)}</strong></>
                  )}
                </div>
              )}

              {overBudget && <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>That's more than your demo cash balance.</div>}
              {overHolding && <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>You only hold {holdingQuantity} {symbol}.</div>}
              {error && <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>{error}</div>}
              {success && <div style={{ fontSize: 12.5, color: "var(--sage)", marginBottom: 12 }}>{success}</div>}
              {orderType === "market" && price == null && (
                <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)", marginBottom: 12 }}>Waiting for a live price…</div>
              )}

              <button className="btn-primary" style={{ width: "100%" }} onClick={submit} disabled={submitting || !canSubmit}>
                {submitting
                  ? "Placing order…"
                  : orderType === "market"
                  ? `${side === "buy" ? "Buy" : "Sell"} (demo)`
                  : `Place ${side === "buy" ? "buy" : "sell"} limit order`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
