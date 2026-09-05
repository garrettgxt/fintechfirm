import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { SUPPORTED_CURRENCIES } from "../walletAddresses.js";

const PRESET_AMOUNTS = [20, 50, 100, 250, 500, 1000];

const COIN_LABELS = { ETH: "Ethereum", BTC: "Bitcoin", LTC: "Litecoin", SOL: "Solana" };

function formatCountdown(msRemaining) {
  if (msRemaining <= 0) return "0:00";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Two-step flow: pick an amount + currency, then show the generated
// invoice (QR code, exact amount, address, live status) until it's paid.
// Only functions/nowpayments-webhook.js ever actually credits the
// balance — this modal just displays what create-payment.js returned and
// polls functions/payment-status.js to know when that happened.
export default function CreditInvoiceModal({ walletAddress, initialCurrency, onClose, onCredited }) {
  const [step, setStep] = useState("choose"); // choose | invoice | error
  const [amount, setAmount] = useState(20);
  const [customAmount, setCustomAmount] = useState(""); // raw text from the custom-amount field
  const [currency, setCurrency] = useState(initialCurrency || "eth");
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState(null); // { paymentId, payAddress, payAmount, payCurrency, expiresAt }
  const [status, setStatus] = useState("waiting");
  const [now, setNow] = useState(Date.now());
  const [copiedField, setCopiedField] = useState(null);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  async function createInvoice() {
    setSubmitting(true);
    try {
      const res = await fetch("/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, priceAmountUsd: amount, payCurrency: currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");
      setInvoice(data);
      setStatus("waiting");
      setStep("invoice");
    } catch (err) {
      console.error("Failed to create payment:", err);
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }

  // Poll for confirmation, and keep the countdown ticking, while the
  // invoice step is showing.
  useEffect(() => {
    if (step !== "invoice" || !invoice) return;

    async function poll() {
      try {
        const res = await fetch(`/payment-status?paymentId=${encodeURIComponent(invoice.paymentId)}`);
        const data = await res.json();
        setStatus(data.status);
        if (data.credited) {
          onCredited?.();
        }
      } catch (err) {
        console.error("Failed to poll payment status:", err);
      }
    }

    poll();
    pollRef.current = setInterval(poll, 4000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(tickRef.current);
    };
  }, [step, invoice, onCredited]);

  function copy(field, value) {
    navigator.clipboard.writeText(String(value)).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  const expiresAtMs = invoice?.expiresAt ? new Date(invoice.expiresAt).getTime() : null;
  const msRemaining = expiresAtMs ? expiresAtMs - now : null;
  const isPaid = status === "finished";

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
              payment and credits your account balance once it's confirmed on
              the network.
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
              onClick={createInvoice}
              disabled={submitting || !(amount > 0)}
            >
              {submitting ? "Creating invoice…" : `Continue with $${amount.toFixed(2)}`}
            </button>
          </>
        )}

        {step === "invoice" && invoice && (
          <>
            <div className="credit-invoice-head">
              <h2 className="serif" style={{ fontSize: 20 }}>
                {COIN_LABELS[invoice.payCurrency?.toUpperCase()] || invoice.payCurrency?.toUpperCase()}
              </h2>
              <button className="credit-invoice-close" onClick={onClose}>&times;</button>
            </div>

            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.55)", marginBottom: 20 }}>
              Invoice <strong>{invoice.paymentId}</strong> · ${amount.toFixed(2)} of Coinstate credit
            </div>

            {isPaid ? (
              <div className="credit-paid">
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>Payment received</div>
                <div style={{ fontSize: 13, color: "rgba(237,231,218,0.6)" }}>
                  ${amount.toFixed(2)} has been added to your balance.
                </div>
              </div>
            ) : (
              <>
                <div className="credit-qr">
                  <QRCodeSVG value={invoice.payAddress} size={200} bgColor="#EDE7DA" fgColor="#0F1D1B" />
                </div>

                {msRemaining !== null && (
                  <div className="credit-timer">
                    ADDRESS RESERVED FOR {formatCountdown(msRemaining)}
                  </div>
                )}

                <div className="credit-field">
                  <div>
                    <div className="credit-field-label">SEND EXACTLY</div>
                    <div className="num" style={{ fontWeight: 600 }}>
                      {invoice.payAmount} {invoice.payCurrency?.toUpperCase()}
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={() => copy("amount", invoice.payAmount)}>
                    {copiedField === "amount" ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="credit-field">
                  <div style={{ minWidth: 0 }}>
                    <div className="credit-field-label">TO ADDRESS</div>
                    <div className="num" style={{ fontSize: 12.5, wordBreak: "break-all" }}>
                      {invoice.payAddress}
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={() => copy("address", invoice.payAddress)}>
                    {copiedField === "address" ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="credit-watching">
                  <span className="credit-pulse-dot" />
                  Watching the network. This updates by itself.
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.4)", marginTop: 6 }}>
                  Locked rate: 1 {invoice.payCurrency?.toUpperCase()} = $
                  {(amount / invoice.payAmount).toFixed(2)} · this address belongs to this invoice only.
                </div>
              </>
            )}

            <button className="btn-secondary" style={{ width: "100%", marginTop: 20 }} onClick={onClose}>
              Back to wallet
            </button>
          </>
        )}

        {step === "error" && (
          <>
            <div className="credit-invoice-head">
              <h2 className="serif" style={{ fontSize: 20 }}>Couldn't create invoice</h2>
              <button className="credit-invoice-close" onClick={onClose}>&times;</button>
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(237,231,218,0.6)", marginBottom: 20 }}>
              Something went wrong reaching the payment provider. Please try again shortly.
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
