import { useState, useEffect, useRef, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { STOCKS, ETFS, FOREX, CRYPTO, NON_CRYPTO_SYMBOLS, findAsset } from "../assetCatalog.js";
import { useLivePrices } from "../hooks/useLivePrices.js";
import { useMarketQuotes } from "../hooks/useMarketQuotes.js";
import PriceChart from "../components/PriceChart.jsx";
import Sparkline from "../components/Sparkline.jsx";
import CreditInvoiceModal from "../components/CreditInvoiceModal.jsx";
import AddDemoFundsModal from "../components/AddDemoFundsModal.jsx";
import AssetSearch from "../components/AssetSearch.jsx";
import AssetDetailPanel from "../components/AssetDetailPanel.jsx";
import { consumePendingAsset } from "../pendingAsset.js";
import { formatPrice } from "../formatPrice.js";

export default function Dashboard() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [demoMode, setDemoMode] = useState(false);
  const [demoCashUsd, setDemoCashUsd] = useState(0);
  const [demoPositions, setDemoPositions] = useState([]); // [{symbol, assetType, quantity, avgCost}]
  const [tab, setTab] = useState("portfolio");
  const [balanceDelta, setBalanceDelta] = useState(null); // { amount, direction } — a brief "+$0.03" flash
  const [creditOpen, setCreditOpen] = useState(false);
  const [demoFundsOpen, setDemoFundsOpen] = useState(false);
  const [creditCurrency, setCreditCurrency] = useState("eth"); // which coin is preselected when the modal opens
  const [creditBalance, setCreditBalance] = useState(0); // custodial site-credit balance, NOT on-chain funds
  const [selectedAsset, setSelectedAsset] = useState(null); // asset object when tab === "asset"
  const [pendingOrders, setPendingOrders] = useState([]);
  const prevDisplayedValue = useRef(null);
  const deltaTimeout = useRef(null);
  const livePrices = useLivePrices();

  // Twelve Data meters a batched quote request PER SYMBOL (confirmed via
  // a real quota exhaustion incident — see CLAUDE.md), so polling all
  // ~32 non-crypto catalog symbols unconditionally for as long as the
  // Dashboard is mounted — regardless of which tab is actually open —
  // burns the shared daily credit cap for data nobody's looking at. Only
  // ask for what the current view actually needs: the full board while
  // Markets is open (that page inherently shows everything), the symbols
  // behind an open non-crypto position (Portfolio's valuation), whatever
  // single asset is being viewed (the asset detail page), and any pending
  // non-crypto limit order (the fill-while-open watcher below needs a
  // live price for those regardless of which tab is showing).
  const neededNonCryptoSymbols = useMemo(() => {
    if (tab === "markets") return NON_CRYPTO_SYMBOLS;
    const held = demoPositions.filter((p) => p.assetType !== "crypto").map((p) => p.symbol);
    const viewed = tab === "asset" && selectedAsset && selectedAsset.type !== "crypto" ? [selectedAsset.symbol] : [];
    const pending = pendingOrders.filter((o) => o.assetType !== "crypto").map((o) => o.symbol);
    return [...new Set([...held, ...viewed, ...pending])];
  }, [tab, demoPositions, selectedAsset, pendingOrders]);
  const marketQuotes = useMarketQuotes(neededNonCryptoSymbols);

  // The embedded wallet Privy created automatically on login.
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet ? embeddedWallet.address : null;

  const email = user?.email?.address || user?.google?.email || user?.apple?.email || "";

  // If a logged-out visitor clicked a stock/coin on Landing.jsx (search or
  // a chart's Buy button), that sent them to /auth with no session to open
  // the asset view in — resume straight to that asset's detail view now
  // instead of leaving them on the default Portfolio tab with no memory of
  // what they clicked. One-time on mount; consumePendingAsset clears it.
  useEffect(() => {
    const pending = consumePendingAsset();
    if (!pending?.symbol) return;
    setSelectedAsset(findAsset(pending.symbol) || pending);
    setTab("asset");
  }, []);

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

  // Site-credit balance (custodial — see functions/admin-review-deposit.js,
  // the only place it's ever incremented now that NOWPayments is gone).
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

  // Pending Demo Mode limit orders for this wallet.
  function refreshPendingOrders() {
    if (!walletAddress) return;
    fetch(`/get-demo-orders?wallet=${encodeURIComponent(walletAddress)}`)
      .then((res) => res.json())
      .then((data) => setPendingOrders(data.orders ?? []))
      .catch((err) => console.error("Failed to fetch pending orders:", err));
  }

  useEffect(refreshPendingOrders, [walletAddress, demoMode]);

  // Limit orders only fill while this effect is alive — i.e. while this
  // wallet's own Dashboard tab is open. There's no background scheduler
  // (Cloudflare Pages has no built-in cron); this is a known, accepted
  // tradeoff for a demo feature, documented in CLAUDE.md.
  useEffect(() => {
    if (!demoMode || pendingOrders.length === 0) return;
    let cancelled = false;

    async function checkOrders() {
      for (const order of pendingOrders) {
        if (cancelled) return;
        const currentPrice = getPrice(order.symbol, order.assetType);
        if (currentPrice == null) continue;
        const shouldFill =
          (order.side === "buy" && currentPrice <= order.limitPrice) ||
          (order.side === "sell" && currentPrice >= order.limitPrice);
        if (!shouldFill) continue;
        try {
          await fetch("/fill-demo-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id, fillPrice: currentPrice }),
          });
          refreshPendingOrders();
          refreshDemoPortfolio();
        } catch (err) {
          console.error("Failed to fill order:", err);
        }
      }
    }

    checkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, pendingOrders, livePrices, marketQuotes]);

  function cancelOrder(orderId) {
    fetch("/cancel-demo-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, walletAddress }),
    })
      .then(() => refreshPendingOrders())
      .catch((err) => console.error("Failed to cancel order:", err));
  }

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

  // Opens the full asset detail view (chart, market details, buy/sell panel).
  function openAsset(asset) {
    setSelectedAsset(asset);
    setTab("asset");
  }

  // A card's Buy button: Demo Mode opens the asset detail view; a real
  // account can only "buy" crypto today, and that means funding Site
  // Credit, not a simulated trade — real stock/forex investing isn't
  // built yet.
  function handleBuy(asset) {
    if (demoMode) openAsset(asset);
    else if (asset.type === "crypto") openAddFunds(asset.symbol);
  }

  function handleSell(asset) {
    if (demoMode) openAsset(asset);
  }

  function handleSearchSelect(asset) {
    openAsset(asset);
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
          <h1 className="serif" style={{ fontSize: 20, flexShrink: 0 }}>
            {tab === "markets" ? "Markets" : tab === "asset" ? selectedAsset?.symbol : "Portfolio"}
          </h1>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 24px" }}>
            <AssetSearch onSelect={handleSearchSelect} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <span style={{ fontSize: 13.5, color: "rgba(237,231,218,0.6)" }}>{email}</span>
            <button className="btn-secondary" onClick={logout}>Log out</button>
          </div>
        </div>

        {tab === "asset" && selectedAsset ? (
          <div className="content">
            <AssetDetailPanel
              asset={selectedAsset}
              quote={selectedAsset.type !== "crypto" ? marketQuotes[selectedAsset.symbol] : undefined}
              walletAddress={walletAddress}
              demoMode={demoMode}
              cashUsd={demoCashUsd}
              holdingQuantity={demoPositions.find((p) => p.symbol === selectedAsset.symbol)?.quantity ?? 0}
              onBack={() => setTab("markets")}
              onTraded={() => {
                refreshDemoPortfolio();
                refreshPendingOrders();
              }}
            />
          </div>
        ) : tab === "markets" ? (
          <div className="content">
            {demoMode && (
              <div style={{ fontSize: 12.5, color: "var(--brass-bright)", marginBottom: 24 }}>
                Demo Mode is on — Buy/Sell here trades your demo cash balance, not real money.
              </div>
            )}
            {renderAssetGroup("Major Indices (S&P 500, Nasdaq 100, Dow)", ETFS)}
            {renderAssetGroup("Stocks", STOCKS)}
            {renderAssetGroup("Forex", FOREX)}
            {renderAssetGroup("Crypto", CRYPTO)}
          </div>
        ) : (
          <div className="content">
            <div className="balance-card">
              <div>
                <div className="balance-label">Total portfolio value</div>
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
                {demoMode ? (
                  <>
                    <button className="btn-primary" onClick={() => setTab("markets")}>Invest in stocks</button>
                    <button className="btn-secondary" onClick={() => setDemoFundsOpen(true)}>+ Add funds</button>
                  </>
                ) : (
                  <button className="btn-secondary" onClick={() => openAddFunds()}>Add funds</button>
                )}
              </div>
            </div>

            {demoMode && (
              <>
                <div className="panel">
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
                                  onClick={() => asset && openAsset(asset)}
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

                {pendingOrders.length > 0 && (
                  <div className="pending-orders-panel">
                    <table>
                      <thead>
                        <tr><th>Pending order</th><th>Quantity</th><th>Limit price</th><th></th></tr>
                      </thead>
                      <tbody>
                        {pendingOrders.map((o) => (
                          <tr key={o.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{o.symbol}</div>
                              <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)" }}>
                                {o.side === "buy" ? "Buy" : "Sell"} limit
                              </div>
                            </td>
                            <td className="num">{o.quantity}</td>
                            <td className="num">{formatPrice(Number(o.limitPrice))}</td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                className="btn-secondary"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                onClick={() => cancelOrder(o.id)}
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
        />
      )}

      {demoFundsOpen && (
        <AddDemoFundsModal
          walletAddress={walletAddress}
          onClose={() => setDemoFundsOpen(false)}
          onAdded={refreshDemoPortfolio}
        />
      )}
    </div>
  );
}
