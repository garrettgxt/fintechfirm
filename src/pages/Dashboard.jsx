import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { MoonPayBuyWidget } from "@moonpay/moonpay-react";
import { createPublicClient, http, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { getBanxaCheckoutUrl } from "../banxaConfig.js";
import { WALLET_ADDRESSES, SUPPORTED_CURRENCIES } from "../walletAddresses.js";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(), // uses a public Ethereum RPC endpoint, no API key needed
});

// CoinGecko ids for each symbol we support, used to convert a demo dollar
// value into a plausible coin quantity to display.
const COINGECKO_IDS = { ETH: "ethereum", BTC: "bitcoin", LTC: "litecoin", SOL: "solana" };

export default function Dashboard() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyCurrency, setBuyCurrency] = useState("eth");
  const [moonpayOpen, setMoonpayOpen] = useState(false);
  const [ethBalance, setEthBalance] = useState(null); // in ETH, as a number
  const [ethPriceUsd, setEthPriceUsd] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [demoBalanceUsd, setDemoBalanceUsd] = useState(0);
  const [demoAsset, setDemoAsset] = useState("ETH");
  const [demoAssetAmount, setDemoAssetAmount] = useState(0); // dollar value of the demo holding
  const [assetPrices, setAssetPrices] = useState({}); // { ETH: 3450.12, BTC: ..., LTC: ..., SOL: ... }

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

  // Fetch a live USD price for every asset we support (not just ETH), so a
  // demo holding set in dollars can be shown as a coin quantity, the same
  // way the real ETH row shows quantity + USD.
  useEffect(() => {
    const ids = Object.values(COINGECKO_IDS).join(",");
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)
      .then((res) => res.json())
      .then((data) => {
        const prices = {};
        for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
          prices[symbol] = data?.[id]?.usd ?? null;
        }
        setAssetPrices(prices);
      })
      .catch((err) => console.error("Failed to fetch asset prices:", err));
  }, []);

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
        setDemoAsset(data.demoAsset);
        setDemoAssetAmount(data.demoAssetAmount);
      })
      .catch((err) => console.error("Demo mode check failed:", err));
  }, [walletAddress, email]);

  const displayedUsdValue = demoMode ? demoBalanceUsd : usdValue;

  // Whichever asset + quantity is currently relevant to show the user —
  // the demo holding if Demo Mode is on, otherwise their real ETH balance.
  const displayAsset = demoMode ? demoAsset : "ETH";
  const displayQuantity = demoMode
    ? assetPrices[demoAsset]
      ? demoAssetAmount / assetPrices[demoAsset]
      : null
    : ethBalance;

  function openBanxa() {
    const destination = WALLET_ADDRESSES[buyCurrency];
    if (!destination) return;
    const coinType = buyCurrency.toUpperCase();
    const url = getBanxaCheckoutUrl({ walletAddress: destination, coinType });
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
                Total portfolio value
                {demoMode && (
                  <span style={{ marginLeft: 10, fontSize: 11, color: "var(--brass-bright)" }}>
                    Demo
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
              <button className="btn-secondary" onClick={() => setBuyOpen(true)}>
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
                <div className="wallet-address num">
                  {displayQuantity !== null
                    ? `${displayQuantity.toFixed(5)} ${displayAsset}`
                    : "Loading…"}
                </div>
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
            {demoMode ? (
              demoAssetAmount > 0 ? (
                <table>
                  <tbody>
                    <tr>
                      <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontWeight: 600 }}>
                          {SUPPORTED_CURRENCIES.find((c) => c.symbol === demoAsset)?.label || demoAsset}
                        </div>
                        <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>{demoAsset}</div>
                      </td>
                      <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)", textAlign: "right" }} className="num">
                        <div>
                          {assetPrices[demoAsset]
                            ? `${(demoAssetAmount / assetPrices[demoAsset]).toFixed(5)} ${demoAsset}`
                            : "Loading price…"}
                        </div>
                        <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>
                          ${demoAssetAmount.toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No holdings yet — buy crypto to see it appear here.</div>
              )
            ) : ethBalance !== null && ethBalance > 0 ? (
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
            <div style={{ fontSize: 14, color: "rgba(237,231,218,0.6)", marginBottom: 20 }}>
              Choose a currency, then a payment partner to fund your wallet.
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setBuyCurrency(c.code)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: buyCurrency === c.code ? "1px solid var(--brass)" : "1px solid var(--line)",
                    background: buyCurrency === c.code ? "rgba(176,138,78,0.14)" : "transparent",
                    color: buyCurrency === c.code ? "var(--brass-bright)" : "var(--paper)",
                  }}
                >
                  {c.symbol}
                </button>
              ))}
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
        // Passing all 4 addresses (instead of a single walletAddress) means
        // MoonPay only shows currencies we actually have an address for —
        // nothing else is even selectable. currencyCode (not
        // defaultCurrencyCode) locks the pick to whichever one was chosen
        // in the modal above, so it can't be changed inside MoonPay's own
        // UI once the widget is open. This closes the mismatch risk that
        // used to exist here.
        walletAddresses={JSON.stringify(WALLET_ADDRESSES)}
        currencyCode={buyCurrency}
        onUrlSignatureRequested={signMoonPayUrl}
        onClose={() => setMoonpayOpen(false)}
      />
    </div>
  );
}
