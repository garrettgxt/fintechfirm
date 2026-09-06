import { useState } from "react";

// Demo Mode "Withdraw" — unlike AddDemoFundsModal (instant self-service
// top-up), this submits a request that sits pending until an admin
// approves or rejects it in /admin, same review pattern as real Site
// Credit deposits — explicit user request, even though it's fake money.
// The amount is escrowed server-side the moment the request is created
// (see create-demo-withdraw-request.js), so cashUsd here already reflects
// the pre-withdrawal balance the Max button should offer.
export default function WithdrawDemoFundsModal({ walletAddress, cashUsd, onClose, onRequested }) {
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const effectiveAmount = parseFloat(customAmount);
  const isValid = Number.isFinite(effectiveAmount) && effectiveAmount > 0 && effectiveAmount <= cashUsd;

  async function submit() {
    if (!isValid) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/create-demo-withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, amount: effectiveAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit withdrawal");
      setDone(true);
      onRequested?.();
    } catch (err) {
      const known = {
        demo_mode_not_active: "Demo Mode isn't active on this account.",
        withdrawal_already_pending: "You already have a withdrawal pending review.",
        insufficient_cash: "That's more than your cash balance.",
      };
      setError(known[err.message] || err.message);
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
          <h2 className="serif" style={{ fontSize: 20 }}>Withdraw</h2>
          <button className="credit-invoice-close" onClick={onClose}>&times;</button>
        </div>

        {done ? (
          <div className="credit-paid">
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>Submitted</div>
            <div style={{ fontSize: 13, color: "rgba(237,231,218,0.6)" }}>
              ${effectiveAmount.toFixed(2)} is on hold and awaiting admin approval. You'll see it as pending on your
              Portfolio tab until it's reviewed.
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: 20 }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.55)", marginBottom: 20 }}>
              Withdrawal requests are reviewed and approved manually, same as deposits. The amount is held aside from
              your available cash until then.
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Amount in USD"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="credit-custom-amount num"
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button
                type="button"
                className="credit-chip"
                onClick={() => setCustomAmount(String(cashUsd))}
                disabled={!(cashUsd > 0)}
                title="Withdraw all available cash"
              >
                Max
              </button>
            </div>

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.45)", marginBottom: 16 }}>
              Available: ${cashUsd.toFixed(2)}
            </div>

            {error && <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>{error}</div>}

            <button
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={submit}
              disabled={submitting || !isValid}
            >
              {submitting ? "Submitting…" : `Withdraw $${isValid ? effectiveAmount.toLocaleString() : "0"}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
