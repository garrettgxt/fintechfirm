import { useState, useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { STOCKS, ETFS, FOREX, CRYPTO, NON_CRYPTO_SYMBOLS, findAsset } from "../assetCatalog.js";
import { useLivePrices } from "../hooks/useLivePrices.js";
import { useMarketQuotes } from "../hooks/useMarketQuotes.js";
import PriceChart from "../components/PriceChart.jsx";
import Sparkline from "../components/Sparkline.jsx";
import CreditInvoiceModal from "../components/CreditInvoiceModal.jsx";
import TradeModal from "../components/TradeModal.jsx";

export default function Dashboard() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [demoMode, setDemoMode] = useState(false);
  const [demoCashUsd, setDemoCashUsd] = useState(0);
  const [demoPositions, setDemoPositions] = useState([]); // [{symbol, assetType, quantity, avgCost}]
  const [tab, setTab] = useState("portfolio");
  const [balanceDelta, setBalanceDelta] = useState(null); // { amount, direction } — a brief "+$0.03" flash
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditCurrency, setCreditCurrency] = useState("eth"); // which coin is preselected when the modal opens
  const [creditBalance, setCreditBalance] = useState(0); // custodial site-credit balance, NOT on-chain funds
  const [tradeModal, setTradeModal] = useState(null); // { symbol, name, assetType, side, price, holdingQuantity }
  const prevDisplayedValue = useRef(null);
  const deltaTimeout = useRef(null);
  const livePrices = useLivePrices();
  const marketQuotes = useMarketQuotes(NON_CRYPTO_SYMBOLS);

  // The embedded wallet Privy created automatically on login.
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet ? embeddedWallet.address : null;

  const email = user?.email?.address || user?.google?.email || user?.apple?.email || "";

  // Register this wallet for the admin panel.
  useEffect(() => {
    if (!walletAddress) return;
    fetch("/register-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, email }),
    }).catch((err) => console.error("Wallet registration failed:", err));
  }, [walletAddress, email]);

  // Demo Mode's paper-trading portfolio (cash + positions). Only
  // meaningful when demoMode is on — see Site Credit below for what a
  // real account's balance actually is.
  function refreshDemoPortfolio() {
    if (!walletAddress) return;
    fetch(`/get-demo-portfolio?wallet=${encodeURIComponent(walletAddress)}`)
      .then((res) => res.json())
      .then((data) => {
        setDemoMode(data.demoMode ?? false);
        setDemoCashUsd(data.cashUsd ?? 0);
        setDemoPositions(data.positions ?? []);
      })
      .catch((err) => console.error("Failed to fetch demo portfolio:", err));
  }

  useEffect(refreshDemoPortfolio, [walletAddress]);

  // Site-credit balance (custodial — see functions/nowpayments-webhook.js).
  // Separate from Demo Mode on purpose: one is real money Coinstate
  // Capital is holding, the other is a simulated paper-trading balance.
  function refreshCreditBalance() {
    if (!walletAddress) return;
    fetch(`/get-credit-balance?wallet=${encodeURIComponent(walletAddress)}`)
      .then((res) => res.json())
      .then((data) => setCreditBalance(data.balanceUsd ?? 0))
      .catch((err) => console.error("Failed to fetch credit balance:", err));
  }

  useEffect(refreshCreditBalance, [walletAddress]);

  // Current price for any catalog symbol, from whichever live feed
  // covers it — used for portfolio valuation and the trade modal's
  // estimate. Falls back to null (caller decides how to handle that).
  function getPrice(symbol, assetType) {
    if (assetType === "crypto") return livePrices[symbol]?.price ?? null;
    return marketQuotes[symbol]?.price ?? null;
  }

  const demoPositionsValue = demoPositions.reduce((sum, p) => {
    const price = getPrice(p.symbol, p.assetType) ?? p.avgCost; // avoid a $0 flash before quotes load
    return sum + p.quantity * price;
  }, 0);
  const demoPortfolioTotal = demoCashUsd + demoPositionsValue;

  // A real account's "Total portfolio value" is its Site Credit balance;
  // a demo account's is its simulated cash + positions.
  const displayedUsdValue = demoMode ? demoPortfolioTotal : creditBalance;

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
  // by the sidebar/balance-card buttons (default) and, for a real
  // (non-demo) account, by a crypto chart's "Buy" button on the Markets
  // tab (preselects that coin).
  function openAddFunds(symbol) {
    setCreditCurrency(symbol ? symbol.toLowerCase() : "eth");
    setCreditOpen(true);
  }

  // Opens the Demo Mode buy/sell modal for one catalog asset.
  function openTrade(asset, side) {
    const holding = demoPositions.find((p) => p.symbol === asset.symbol);
    setTradeModal({
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.type,
      side,
      price: getPrice(asset.symbol, asset.type),
      holdingQuantity: holding?.quantity ?? 0,
    });
  }

  // A card's Buy button: Demo Mode trades any asset; a real account can
  // only "buy" crypto today, and that means funding Site Credit, not a
  // simulated trade — real stock/forex investing isn't built yet.
  function handleBuy(asset) {
    if (demoMode) openTrade(asset, "buy");
    else if (asset.type === "crypto") openAddFunds(asset.symbol);
  }

  function handleSell(asset) {
    if (demoMode) openTrade(asset, "sell");
  }

  function renderAssetGroup(title, assets) {
    return (
      <div key={title} style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 15, marginBottom: 14, color: "rgba(237,231,218,0.6)" }}>{title}</h3>
        <div className="markets-grid">
          {assets.map((asset) => (
            <PriceChart
              key={asset.symbol}
              symbol={asset.symbol}
              name={asset.name}
              type={asset.type}
              quote={asset.type !== "crypto" ? marketQuotes[asset.symbol] : undefined}
              holdingQuantity={demoPositions.find((p) => p.symbol === asset.symbol)?.quantity ?? 0}
              onBuy={demoMode || asset.type === "crypto" ? () => handleBuy(asset) : undefined}
              onSell={demoMode ? () => handleSell(asset) : undefined}
            />
          ))}
        </div>
      </div>
    );
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
            <button disabled title="Coming soon">↗ Invest in stocks (real money)</button>
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
            {demoMode && (
              <div style={{ fontSize: 12.5, color: "var(--brass-bright)", marginBottom: 24 }}>
                Demo Mode is on — Buy/Sell here trades your demo cash balance, not real money.
              </div>
            )}
            {renderAssetGroup("Stocks", STOCKS)}
            {renderAssetGroup("Index ETFs", ETFS)}
            {renderAssetGroup("Forex", FOREX)}
            {renderAssetGroup("Crypto", CRYPTO)}
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
                  <h3>Demo cash available</h3>
                  <span className="status-pill healthy">Ready to trade</span>
                  <div className="wallet-address num">${demoCashUsd.toFixed(2)}</div>
                </div>

                <div className="holdings-panel">
                  <table>
                    <thead>
                      <tr><th>Asset</th><th></th><th>Value</th></tr>
                    </thead>
                  </table>
                  {demoPositions.length > 0 ? (
                    <table>
                      <tbody>
                        {demoPositions.map((p) => {
                          const asset = findAsset(p.symbol);
                          const price = getPrice(p.symbol, p.assetType);
                          const value = price != null ? p.quantity * price : null;
                          const costBasis = p.quantity * p.avgCost;
                          const pnl = value != null ? value - costBasis : null;
                          const pnlPct = costBasis > 0 && pnl != null ? (pnl / costBasis) * 100 : null;
                          return (
                            <tr key={p.symbol}>
                              <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)" }}>
                                <div style={{ fontWeight: 600 }}>{asset?.name || p.symbol}</div>
                                <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>{p.symbol}</div>
                              </td>
                              <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)" }}>
                                {p.assetType === "crypto" && (
                                  <Sparkline
                                    history={livePrices[p.symbol]?.history}
                                    isUp={(livePrices[p.symbol]?.changePct24h ?? 0) >= 0}
                                  />
                                )}
                              </td>
                              <td style={{ padding: "16px 28px", borderTop: "1px solid var(--line)", textAlign: "right" }} className="num">
                                <div>{p.quantity} {p.symbol}</div>
                                <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>
                                  {value != null ? `$${value.toFixed(2)}` : "Loading…"}
                                </div>
                                {pnlPct != null && (
                                  <div
                                    className="holdings-row-change"
                                    style={{ color: pnl >= 0 ? "var(--sage)" : "var(--rust)" }}
                                  >
                                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                                  </div>
                                )}
                                <button
                                  className="btn-secondary"
                                  style={{ marginTop: 8, padding: "4px 10px", fontSize: 12 }}
                                  onClick={() => asset && openTrade(asset, "sell")}
                                >
                                  Sell
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">No holdings yet — buy something on the Markets tab.</div>
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

      {tradeModal && (
        <TradeModal
          walletAddress={walletAddress}
          symbol={tradeModal.symbol}
          name={tradeModal.name}
          assetType={tradeModal.assetType}
          side={tradeModal.side}
          price={tradeModal.price}
          cashUsd={demoCashUsd}
          holdingQuantity={tradeModal.holdingQuantity}
          onClose={() => setTradeModal(null)}
          onTraded={refreshDemoPortfolio}
        />
      )}
    </div>
  );
}
