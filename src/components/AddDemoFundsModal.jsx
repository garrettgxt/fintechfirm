import { useState } from "react";

const PRESET_AMOUNTS = [500, 1000, 5000, 10000];

// Self-service Demo Mode cash top-up — fake money, no payment involved.
// Separate from CreditInvoiceModal (real crypto payments into Site
// Credit) on purpose: those are two independent systems, and routing a
// demo user into the real payment flow would be actively misleading.
export default function AddDemoFundsModal({ walletAddress, onClose, onAdded }) {
  const [amount, setAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;
  const isValid = Number.isFinite(effectiveAmount) && effectiveAmount > 0;

  async function submit() {
    if (!isValid) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/add-demo-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, amount: effectiveAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add funds");
      setDone(true);
      onAdded?.();
    } catch (err) {
      setError(err.message === "demo_mode_not_active" ? "Demo Mode isn't active on this account." : err.message);
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
          <h2 className="serif" style={{ fontSize: 20 }}>Deposit</h2>
          <button className="credit-invoice-close" onClick={onClose}>&times;</button>
        </div>

        {done ? (
          <div className="credit-paid">
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>Deposited</div>
            <div style={{ fontSize: 13, color: "rgba(237,231,218,0.6)" }}>
              ${effectiveAmount.toFixed(2)} added to your cash balance.
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: 20 }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.55)", marginBottom: 20 }}>
              Simulated cash for Demo Mode trading — no real money involved.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  className={`credit-chip ${!customAmount && amount === preset ? "active" : ""}`}
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount("");
                  }}
                >
                  ${preset.toLocaleString()}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>Or custom amount</div>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Amount in USD"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="credit-custom-amount num"
              style={{ marginBottom: 16 }}
            />

            {error && <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>{error}</div>}

            <button
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={submit}
              disabled={submitting || !isValid}
            >
              {submitting ? "Depositing…" : `Deposit $${isValid ? effectiveAmount.toLocaleString() : "0"}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
