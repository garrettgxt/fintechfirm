import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { SUPPORTED_CURRENCIES } from "../walletAddresses.js";

const PRESET_AMOUNTS = [500, 1000, 5000, 10000];

// Self-service Demo Mode cash top-up — fake money, no real payment ever
// happens. Walks through the same visual shape as CreditInvoiceModal's
// real crypto-QR deposit flow (amount -> currency -> QR/address ->
// confirm) per explicit user request ("needs to have the QR code for
// cryptos to deposit... that's how I want it setup in demo mode"), but
// deliberately does NOT import WALLET_ADDRESSES (the real fixed deposit
// addresses) — reusing a REAL address here would risk a demo user
// actually sending real crypto to it while believing they're only in a
// simulation, since this flow never checks a blockchain either way.
// Instead the "address" and QR are obviously fake and clearly labeled;
// confirming just calls add-demo-funds directly, same as before.
export default function AddDemoFundsModal({ walletAddress, onClose, onAdded }) {
  const [step, setStep] = useState("choose"); // choose | deposit | done
  const [amount, setAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [currency, setCurrency] = useState("eth");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;
  const isValid = Number.isFinite(effectiveAmount) && effectiveAmount > 0;
  const coin = SUPPORTED_CURRENCIES.find((c) => c.code === currency) || SUPPORTED_CURRENCIES[0];
  const demoAddress = `DEMO-${coin.symbol}-NO-REAL-FUNDS-NEEDED`;

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
      setStep("done");
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
        {step === "choose" && (
          <>
            <div className="credit-invoice-head">
              <h2 className="serif" style={{ fontSize: 20 }}>Deposit</h2>
              <button className="credit-invoice-close" onClick={onClose}>&times;</button>
            </div>

            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.55)", marginBottom: 20 }}>
              Simulated cash for Demo Mode trading — no real money involved.
            </div>

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>Amount</div>
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
              style={{ marginBottom: 20 }}
            />

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>Pay with</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`credit-chip ${currency === c.code ? "active" : ""}`}
                >
                  {c.symbol}
                </button>
              ))}
            </div>

            <button
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={() => setStep("deposit")}
              disabled={!isValid}
            >
              Continue with ${isValid ? effectiveAmount.toLocaleString() : "0"}
            </button>
          </>
        )}

        {step === "deposit" && (
          <>
            <div className="credit-invoice-head">
              <h2 className="serif" style={{ fontSize: 20 }}>{coin.label}</h2>
              <button className="credit-invoice-close" onClick={onClose}>&times;</button>
            </div>

            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.55)", marginBottom: 20 }}>
              ${effectiveAmount.toFixed(2)} of demo cash
            </div>

            <div className="credit-qr">
              <QRCodeSVG value={demoAddress} size={200} bgColor="#EDE7DA" fgColor="#0F1D1B" />
            </div>

            <div className="credit-field">
              <div style={{ minWidth: 0 }}>
                <div className="credit-field-label">DEMO ADDRESS — NOT REAL</div>
                <div className="num" style={{ fontSize: 12.5, wordBreak: "break-all" }}>{demoAddress}</div>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.4)", margin: "12px 0 20px" }}>
              This is a simulated deposit — nothing is actually sent anywhere. Confirming below adds the amount to
              your demo cash balance immediately, no real {coin.label} required.
            </div>

            {error && <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>{error}</div>}

            <button className="btn-primary" style={{ width: "100%" }} onClick={submit} disabled={submitting}>
              {submitting ? "Depositing…" : `Simulate payment — deposit $${effectiveAmount.toLocaleString()}`}
            </button>
            <button className="btn-secondary" style={{ width: "100%", marginTop: 10 }} onClick={() => setStep("choose")}>
              Back
            </button>
          </>
        )}

        {step === "done" && (
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
        )}
      </div>
    </div>
  );
}
