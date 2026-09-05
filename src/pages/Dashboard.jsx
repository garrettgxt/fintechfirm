import { useState, useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { SUPPORTED_CURRENCIES } from "../walletAddresses.js";
import { useLivePrices } from "../hooks/useLivePrices.js";
import PriceChart from "../components/PriceChart.jsx";
import Sparkline from "../components/Sparkline.jsx";
import CreditInvoiceModal from "../components/CreditInvoiceModal.jsx";

// CoinGecko ids for each symbol we support, used to convert a demo dollar
// value into a plausible coin quantity to display.
const COINGECKO_IDS = { ETH: "ethereum", BTC: "bitcoin", LTC: "litecoin", SOL: "solana" };

export default function Dashboard() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [demoMode, setDemoMode] = useState(false);
  const [demoBalanceUsd, setDemoBalanceUsd] = useState(0);
  const [demoAsset, setDemoAsset] = useState("ETH");
  const [demoAssetAmount, setDemoAssetAmount] = useState(0); // dollar value of the demo holding
  const [assetPrices, setAssetPrices] = useState({}); // { ETH: 3450.12, BTC: ..., LTC: ..., SOL: ... }
  const [demoQuantity, setDemoQuantity] = useState(null); // coin quantity, frozen once at load so it behaves like a real holding
  const [tab, setTab] = useState("portfolio");
  const [balanceDelta, setBalanceDelta] = useState(null); // { amount, direction } — a brief "+$0.03" flash
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditCurrency, setCreditCurrency] = useState("eth"); // which coin is preselected when the modal opens
  const [creditBalance, setCreditBalance] = useState(0); // custodial site-credit balance, NOT on-chain funds
  const prevDisplayedValue = useRef(null);
  const deltaTimeout = useRef(null);
  const livePrices = useLivePrices();

  // The embedded wallet Privy created automatically on login.
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet ? embeddedWallet.address : null;

  const email = user?.email?.address || user?.google?.email || user?.apple?.email || "";

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

  // Site-credit balance (custodial — see functions/nowpayments-webhook.js).
  // Separate from the wallet balance above on purpose: one is the user's
  // own on-chain holdings, the other is money Coinstate Capital is holding
  // on their behalf, and conflating the two would be misleading.
  function refreshCreditBalance() {
    if (!walletAddress) return;
    fetch(`/get-credit-balance?wallet=${encodeURIComponent(walletAddress)}`)
      .then((res) => res.json())
      .then((data) => setCreditBalance(data.balanceUsd ?? 0))
      .catch((err) => console.error("Failed to fetch credit balance:", err));
  }

  useEffect(refreshCreditBalance, [walletAddress]);

  // Freeze the demo holding's coin quantity the first time we can compute
  // it, so it behaves like a real holding from then on: the quantity of
  // coins stays fixed, and its dollar value moves with the live price —
  // instead of the dollar value being pinned to a static admin-set number.
  useEffect(() => {
    if (!demoMode || demoQuantity !== null) return;
    const price = assetPrices[demoAsset];
    if (price) setDemoQuantity(demoAssetAmount / price);
  }, [demoMode, demoAsset, demoAssetAmount, assetPrices, demoQuantity]);

  // Demo Mode's holding — only meaningful when demoMode is on, since
  // there's no real on-chain asset being tracked otherwise (see Site
  // Credit below for what a real account's balance actually is now).
  const liveAssetPrice = demoMode ? livePrices[demoAsset]?.price : null;
  const liveUsdValue =
    demoMode && demoQuantity != null && liveAssetPrice != null ? demoQuantity * liveAssetPrice : null;

  // A real account's "Total portfolio value" is its Site Credit balance —
  // the Privy wallet's on-chain balance is no longer shown here, since
  // nothing currently funds it and displaying it was misleading.
  const displayedUsdValue = demoMode ? liveUsdValue ?? demoBalanceUsd : creditBalance;

  // Flash a "+$0.03" / "-$0.05" badge next to the balance whenever it moves.
  useEffect(() => {
    if (displayedUsdValue == null) return;
    const prev = prevDisplayedValue.current;
    prevDisplayedValue.current = displayedUsdValue;
    if (prev == null) return;
    const amount = displayedUsdValue - prev;
    if (Math.abs(amount) < 0.005) return;

    setBalanceDelta({ amount, direction: amount >= 0 ? "up" : "down" });
    clearTimeout(deltaTimeout.current);
    deltaTimeout.current = setTimeout(() => setBalanceDelta(null), 2500);
  }, [displayedUsdValue]);

  useEffect(() => () => clearTimeout(deltaTimeout.current), []);

  // Opens the Add funds modal, optionally preselecting a currency — used
  // by the sidebar/balance-card buttons (default) and by a chart card's
  // "Buy" button on the Markets tab (preselects that coin).
  function openAddFunds(symbol) {
    setCreditCurrency(symbol ? symbol.toLowerCase() : "eth");
    setCreditOpen(true);
  }

  return (
    <div className="dash-shell">
      <aside className="sidebar">
        <div>
          <a href="/" className="brand"><span className="brand-mark"></span>Coinstate Capital</a>
          <nav className="side-nav">
            <button className={tab === "portfolio" ? "active" : ""} onClick={() => setTab("portfolio")}>
              ◆ Portfolio
            </button>
            <button className={tab === "markets" ? "active" : ""} onClick={() => setTab("markets")}>
              ↗ Markets
            </button>
            <button onClick={() => openAddFunds()}>＋ Add funds</button>
            <button disabled title="Coming soon">↗ Invest in stocks</button>
            <button disabled title="Coming soon">⚙ Settings</button>
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
          <h1 className="serif" style={{ fontSize: 20 }}>{tab === "markets" ? "Markets" : "Portfolio"}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13.5, color: "rgba(237,231,218,0.6)" }}>{email}</span>
            <button className="btn-secondary" onClick={logout}>Log out</button>
          </div>
        </div>

        {tab === "markets" ? (
          <div className="content">
            <div className="markets-grid">
              {SUPPORTED_CURRENCIES.map((c) => (
                <PriceChart key={c.symbol} symbol={c.symbol} onBuy={openAddFunds} />
              ))}
            </div>
          </div>
        ) : (
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
                <div className="balance-amount num" style={{ display: "flex", alignItems: "baseline" }}>
                  {`$${displayedUsdValue.toFixed(2)}`}
                  {balanceDelta && (
                    <span className={`balance-delta ${balanceDelta.direction}`}>
                      {balanceDelta.direction === "up" ? "+" : "-"}${Math.abs(balanceDelta.amount).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="balance-actions">
                {!demoMode && (
                  <button className="btn-secondary" onClick={() => openAddFunds()}>Add funds</button>
                )}
                <button className="btn-primary" disabled>Invest in stocks</button>
              </div>
            </div>

            {demoMode && (
              <>
                <div className="panel">
                  <h3>Your wallet</h3>
                  <span className="status-pill healthy">Ready to receive funds</span>
                  <div className="wallet-address num">
                    {demoQuantity !== null ? `${demoQuantity.toFixed(5)} ${demoAsset}` : "Loading…"}
                  </div>
                </div>

                <div className="holdings-panel">
                  <table>
                    <thead>
                      <tr><th>Asset</th><th></th><th>Value</th></tr>
                    </thead>
                  </table>
                  {demoAssetAmount > 0 ? (
                    <table>
                      <tbody>
                        <tr>
                          <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)" }}>
                            <div style={{ fontWeight: 600 }}>
                              {SUPPORTED_CURRENCIES.find((c) => c.symbol === demoAsset)?.label || demoAsset}
                            </div>
                            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>{demoAsset}</div>
                          </td>
                          <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)" }}>
                            <Sparkline
                              history={livePrices[demoAsset]?.history}
                              isUp={(livePrices[demoAsset]?.changePct24h ?? 0) >= 0}
                            />
                          </td>
                          <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)", textAlign: "right" }} className="num">
                            <div>
                              {demoQuantity !== null ? `${demoQuantity.toFixed(5)} ${demoAsset}` : "Loading price…"}
                            </div>
                            <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>
                              {liveUsdValue !== null ? `$${liveUsdValue.toFixed(2)}` : `$${demoAssetAmount.toFixed(2)}`}
                            </div>
                            {livePrices[demoAsset]?.changePct24h != null && (
                              <div
                                className="holdings-row-change"
                                style={{ color: livePrices[demoAsset].changePct24h >= 0 ? "var(--sage)" : "var(--rust)" }}
                              >
                                {livePrices[demoAsset].changePct24h >= 0 ? "+" : ""}
                                {livePrices[demoAsset].changePct24h.toFixed(2)}%
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">No holdings yet — add funds to see it appear here.</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {creditOpen && (
        <CreditInvoiceModal
          walletAddress={walletAddress}
          initialCurrency={creditCurrency}
          onClose={() => setCreditOpen(false)}
          onCredited={refreshCreditBalance}
        />
      )}
    </div>
  );
}
