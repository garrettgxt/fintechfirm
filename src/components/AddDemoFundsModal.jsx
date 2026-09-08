import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { WALLET_ADDRESSES, SUPPORTED_CURRENCIES } from "../walletAddresses.js";
import { formatUsd } from "../utils/formatCurrency.js";

const PRESET_AMOUNTS = [500, 1000, 5000, 10000];

// Self-service Demo Mode cash top-up. Walks through the same visual shape
// as CreditInvoiceModal's real crypto-QR deposit flow (amount -> currency
// -> QR/address -> confirm) per explicit user request. This step shows
// the SAME REAL fixed deposit addresses CreditInvoiceModal uses — an
// earlier version deliberately used an obviously-fake placeholder address
// instead, specifically to avoid a demo user mistaking this for a real
// deposit step and actually sending crypto here (this flow never checks
// a blockchain either way, so it wouldn't get credited or refunded) —
// the user was told that tradeoff explicitly and asked for the real
// addresses anyway, so that risk is accepted, not overlooked. Confirming
// still just calls add-demo-funds directly (instant, self-service,
// unrelated to whether anything was actually sent) — only the address
// shown changed, not the underlying behavior.
export default function AddDemoFundsModal({ walletAddress, onClose, onAdded }) {
  const [step, setStep] = useState("choose"); // choose | deposit | done
  const [amount, setAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [currency, setCurrency] = useState("eth");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;
  const isValid = Number.isFinite(effectiveAmount) && effectiveAmount > 0;
  const coin = SUPPORTED_CURRENCIES.find((c) => c.code === currency) || SUPPORTED_CURRENCIES[0];
  const payAddress = WALLET_ADDRESSES[currency];

  function copyAddress() {
    navigator.clipboard.writeText(payAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
              {formatUsd(effectiveAmount)} of demo cash
            </div>

            <div className="credit-qr">
              <QRCodeSVG value={payAddress} size={200} bgColor="#EDE7DA" fgColor="#0F1D1B" />
            </div>

            <div className="credit-field">
              <div style={{ minWidth: 0 }}>
                <div className="credit-field-label">TO ADDRESS</div>
                <div className="num" style={{ fontSize: 12.5, wordBreak: "break-all" }}>{payAddress}</div>
              </div>
              <button className="btn-secondary" onClick={copyAddress}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.4)", margin: "12px 0 20px" }}>
              This is Coinstate Capital's real {coin.label} deposit address. Demo cash isn't tied to a real payment
              though — confirming below adds the amount to your demo balance immediately either way.
            </div>

            {error && <div style={{ fontSize: 12.5, color: "var(--rust)", marginBottom: 12 }}>{error}</div>}

            <button className="btn-primary" style={{ width: "100%" }} onClick={submit} disabled={submitting}>
              {submitting ? "Depositing…" : `Deposit ${formatUsd(effectiveAmount)}`}
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
              {formatUsd(effectiveAmount)} added to your cash balance.
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
