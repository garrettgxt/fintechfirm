import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { MoonPayBuyWidget } from "@moonpay/moonpay-react";

export default function Dashboard() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [buyOpen, setBuyOpen] = useState(false);

  // The embedded wallet Privy created automatically on login.
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet ? embeddedWallet.address : null;

  const email = user?.email?.address || user?.google?.email || user?.apple?.email || "";

  async function signMoonPayUrl(url) {
    // Cloudflare Pages Functions route: /sign-moonpay-url
    // (If deploying to Netlify instead, change this back to
    // "/.netlify/functions/sign-moonpay-url")
    const response = await fetch(`/sign-moonpay-url?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    if (!response.ok) {
      console.error("MoonPay URL signing failed:", data.error);
      return "";
    }
    return data.signature;
  }

  return (
    <div className="dash-shell">
      <aside className="sidebar">
        <div>
          <a href="/" className="brand"><span className="brand-mark"></span>Coinstate Capital</a>
          <nav className="side-nav">
            <button className="active">◆ Portfolio</button>
            <button onClick={() => setBuyOpen(true)}>＋ Buy crypto</button>
            <button>↗ Invest in stocks</button>
            <button>⚙ Settings</button>
          </nav>
        </div>
        <div className="side-foot">
          Coinstate Capital holds no custody of your funds. Your wallet is
          self-custodial via Privy; stock holdings are held by a licensed
          broker-dealer partner.
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <h1 className="serif" style={{ fontSize: 20 }}>Portfolio</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13.5, color: "rgba(237,231,218,0.6)" }}>{email}</span>
            <button className="btn-secondary" onClick={logout}>Log out</button>
          </div>
        </div>

        <div className="content">
          <div className="balance-card">
            <div>
              <div className="balance-label">Total portfolio value</div>
              <div className="balance-amount num">
                {walletAddress ? "$0.00" : "Setting up your wallet…"}
              </div>
            </div>
            <div className="balance-actions">
              <button className="btn-secondary" onClick={() => setBuyOpen(true)} disabled={!walletAddress}>
                Buy crypto
              </button>
              <button className="btn-primary" disabled>Invest in stocks</button>
            </div>
          </div>

          <div className="panel">
            <h3>Your wallet</h3>
            {walletAddress ? (
              <>
                <span className="status-pill healthy">Ready to receive funds</span>
                <div className="wallet-address num">{walletAddress}</div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: "rgba(237,231,218,0.5)" }}>
                Creating your secure wallet — this usually takes a few seconds.
              </div>
            )}
          </div>

          <div className="holdings-panel">
            <table>
              <thead>
                <tr><th>Asset</th><th>Value</th></tr>
              </thead>
            </table>
            <div className="empty-state">
              No holdings yet — buy crypto to see it appear here.
            </div>
          </div>
        </div>
      </div>

      <MoonPayBuyWidget
        variant="overlay"
        visible={buyOpen}
        walletAddress={walletAddress || undefined}
        // Wallet only supports Ethereum right now, so default to ETH.
        // Note: this doesn't yet block someone from manually picking a
        // non-Ethereum coin in MoonPay's own dropdown — that's worth
        // revisiting before this goes live with real users, since a
        // Bitcoin or Solana purchase would have nowhere valid to land.
        defaultCurrencyCode="eth"
        onUrlSignatureRequested={signMoonPayUrl}
        onClose={() => setBuyOpen(false)}
      />
    </div>
  );
}
