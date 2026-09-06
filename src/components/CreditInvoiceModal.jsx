import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { WALLET_ADDRESSES, SUPPORTED_CURRENCIES } from "../walletAddresses.js";

const PRESET_AMOUNTS = [20, 50, 100, 250, 500, 1000];

const COIN_LABELS = { ETH: "Ethereum", BTC: "Bitcoin", LTC: "Litecoin", SOL: "Solana" };

// NOWPayments was removed from this flow entirely (explicit user
// decision — see CLAUDE.md's Site Credit section): every deposit now
// goes to one of the FIXED addresses in src/walletAddresses.js, the same
// address for every customer paying in that currency. That means there's
// no automatic way to confirm a payment or know who sent it (no memo/
// payment-ID field on these chains), so this no longer auto-credits
// anything. After paying, the customer submits what they sent (amount +
// optional tx hash) via functions/submit-deposit-request.js; an admin
// verifies it on a block explorer and approves it from /admin
// (functions/admin-review-deposit.js), which is the only place a real
// balance actually gets credited now.
export default function CreditInvoiceModal({ walletAddress, initialCurrency, onClose }) {
  const [step, setStep] = useState("choose"); // choose | deposit | submitted | error
  const [amount, setAmount] = useState(20);
  const [customAmount, setCustomAmount] = useState("");
  const [currency, setCurrency] = useState(initialCurrency || "eth");
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const payAddress = WALLET_ADDRESSES[currency];
  const coinLabel = COIN_LABELS[currency.toUpperCase()] || currency.toUpperCase();

  function copy(field, value) {
    navigator.clipboard.writeText(String(value)).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  async function submitRequest() {
    setSubmitting(true);
    try {
      const res = await fetch("/submit-deposit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, amountUsd: amount, currency, txHash: txHash || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      setStep("submitted");
    } catch (err) {
      console.error("Failed to submit deposit request:", err);
      setStep("error");
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
              <h2 className="serif" style={{ fontSize: 20 }}>Add site credit</h2>
              <button className="credit-invoice-close" onClick={onClose}>&times;</button>
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(237,231,218,0.6)", marginBottom: 20 }}>
              Pay with crypto you already have. Coinstate Capital receives the
              payment and credits your account balance once we've verified it.
            </div>

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>Amount</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {PRESET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAmount(a);
                    setCustomAmount("");
                  }}
                  className={`credit-chip ${customAmount === "" && amount === a ? "active" : ""}`}
                >
                  ${a}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Or enter a custom amount"
              value={customAmount}
              onChange={(e) => {
                const raw = e.target.value;
                setCustomAmount(raw);
                const parsed = parseFloat(raw);
                if (Number.isFinite(parsed) && parsed > 0) setAmount(parsed);
              }}
              className="credit-custom-amount num"
              style={{ marginBottom: 20 }}
            />

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>Pay with</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
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
              disabled={!(amount > 0) || !payAddress}
            >
              Continue with ${amount.toFixed(2)}
            </button>
          </>
        )}

        {step === "deposit" && (
          <>
            <div className="credit-invoice-head">
              <h2 className="serif" style={{ fontSize: 20 }}>{coinLabel}</h2>
              <button className="credit-invoice-close" onClick={onClose}>&times;</button>
            </div>

            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.55)", marginBottom: 20 }}>
              ${amount.toFixed(2)} of Coinstate credit
            </div>

            <div className="credit-qr">
              <QRCodeSVG value={payAddress} size={200} bgColor="#EDE7DA" fgColor="#0F1D1B" />
            </div>

            <div className="credit-field">
              <div style={{ minWidth: 0 }}>
                <div className="credit-field-label">TO ADDRESS</div>
                <div className="num" style={{ fontSize: 12.5, wordBreak: "break-all" }}>{payAddress}</div>
              </div>
              <button className="btn-secondary" onClick={() => copy("address", payAddress)}>
                {copiedField === "address" ? "Copied" : "Copy"}
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.4)", margin: "12px 0 20px" }}>
              This is our standing {coinLabel} deposit address — send exactly what you intend to credit,
              in USD terms at today's rate. Once sent, tell us what you paid below so we can verify and
              credit your balance.
            </div>

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.5)", marginBottom: 8 }}>
              Transaction hash (optional, speeds up verification)
            </div>
            <input
              type="text"
              placeholder="0x..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="credit-custom-amount num"
              style={{ marginBottom: 16, fontSize: 12.5 }}
            />

            <button className="btn-primary" style={{ width: "100%" }} onClick={submitRequest} disabled={submitting}>
              {submitting ? "Submitting…" : "I've sent it — submit for review"}
            </button>
            <button className="btn-secondary" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
              Back to wallet
            </button>
          </>
        )}

        {step === "submitted" && (
          <div className="credit-paid">
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>Submitted for review</div>
            <div style={{ fontSize: 13, color: "rgba(237,231,218,0.6)" }}>
              We'll verify your ${amount.toFixed(2)} {coinLabel} payment and add it to your balance shortly.
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: 20 }} onClick={onClose}>
              Back to wallet
            </button>
          </div>
        )}

        {step === "error" && (
          <>
            <div className="credit-invoice-head">
              <h2 className="serif" style={{ fontSize: 20 }}>Couldn't submit request</h2>
              <button className="credit-invoice-close" onClick={onClose}>&times;</button>
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(237,231,218,0.6)", marginBottom: 20 }}>
              Something went wrong. Please try again shortly.
            </div>
            <button className="btn-secondary" style={{ width: "100%" }} onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
