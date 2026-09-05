import { useState } from "react";

// Demo Mode buy/sell for one symbol. The price shown here is just an
// estimate from whatever quote the caller already had on screen — the
// actual execution price is always re-fetched fresh server-side in
// functions/demo-trade.js, never trusted from the client.
export default function TradeModal({
  walletAddress,
  symbol,
  name,
  assetType,
  side: initialSide,
  price,
  cashUsd,
  holdingQuantity = 0,
  onClose,
  onTraded,
}) {
  const [side, setSide] = useState(initialSide || "buy");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const qty = parseFloat(quantity);
  const estimate = Number.isFinite(qty) && qty > 0 && price != null ? qty * price : null;
  const canSell = holdingQuantity > 0;

  const overBudget = side === "buy" && estimate != null && estimate > cashUsd;
  const overHolding = side === "sell" && Number.isFinite(qty) && qty > holdingQuantity;

  async function submit() {
    if (!Number.isFinite(qty) || qty <= 0 || overBudget || overHolding) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/demo-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, symbol, assetType, side, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trade failed");
      setDone(true);
      onTraded?.();
    } catch (err) {
      setError(err.message === "insufficient_cash" ? "Not enough demo cash for this trade." : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(6,12,11,0.7)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 100, padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="credit-invoice">
        <div className="credit-invoice-head">
          <h2 className="serif" style={{ fontSize: 20 }}>
            {name} <span className="chart-card-symbol">{symbol}</span>
          </h2>
          <button className="credit-invoice-close" onClick={onClose}>&times;</button>
        </div>

        {done ? (
          <div className="credit-paid">
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>
              {side === "buy" ? "Bought" : "Sold"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(237,231,218,0.6)" }}>
              {qty} {symbol} at market price — this is Demo Mode, no real assets changed hands.
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: 20 }} onClick={onClose}>
              Back to wallet
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.55)", marginBottom: 20 }}>
              Demo Mode trade — no real money or assets are involved. Demo cash: $
              {cashUsd.toFixed(2)}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                className={`credit-chip ${side === "buy" ? "active" : ""}`}
                onClick={() => setSide("buy")}
              >
                Buy
              </button>
              {canSell && (
                <button
                  className={`credit-chip ${side === "sell" ? "active" : ""}`}
                  onClick={() => setSide("sell")}
                >
                  Sell
                </button>
              )}
            </div>

            {side === "sell" && (
              <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 12 }}>
                You hold {holdingQuantity} {symbol}
              </div>
            )}

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>
              Quantity
            </div>
            <input
              type="number"
              min="0"
              step="any"
              placeholder={`Number of ${symbol}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="credit-custom-amount num"
              style={{ marginBottom: 16 }}
            />

            {estimate != null && (
              <div style={{ fontSize: 13, color: "rgba(237,231,218,0.7)", marginBottom: 16 }}>
                Estimated {side === "buy" ? "cost" : "proceeds"}: <strong>${estimate.toFixed(2)}</strong>
                {price != null && ` (~$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}/${symbol})`}
              </div>
            )}

            {overBudget && (
              <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>
                That's more than your demo cash balance.
              </div>
            )}
            {overHolding && (
              <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>
                You only hold {holdingQuantity} {symbol}.
              </div>
            )}
            {error && (
              <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>{error}</div>
            )}

            <button
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={submit}
              disabled={submitting || !Number.isFinite(qty) || qty <= 0 || overBudget || overHolding}
            >
              {submitting ? "Placing order…" : side === "buy" ? "Buy (demo)" : "Sell (demo)"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
