import { Link } from "react-router-dom";
import TickerStrip from "../components/TickerStrip.jsx";
import PriceChart from "../components/PriceChart.jsx";
import { useMarketQuotes } from "../hooks/useMarketQuotes.js";

const HOMEPAGE_STOCKS = [
  { symbol: "AAPL", name: "Apple", type: "stock" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "NVDA", name: "Nvidia", type: "stock" },
  { symbol: "NFLX", name: "Netflix", type: "stock" },
  { symbol: "SPY", name: "S&P 500", type: "etf" },
  { symbol: "QQQ", name: "Nasdaq 100", type: "etf" },
];
const HOMEPAGE_STOCK_SYMBOLS = HOMEPAGE_STOCKS.map((s) => s.symbol);

const STEPS = [
  {
    n: "01",
    title: "Create your wallet",
    body: "Log in with email, Google, or Apple. A self-custodial wallet is generated for you automatically — no seed phrase to write down, no separate app to install.",
  },
  {
    n: "02",
    title: "Fund it your way",
    body: "Buy crypto through licensed on-ramp partners with a card, bank transfer, or Apple Pay. Funds are delivered straight to your wallet — never held by us.",
  },
  {
    n: "03",
    title: "Track everything in one view",
    body: "Live prices, real charts, and your full balance in a single portfolio screen. Stock investing is on the way, in the same account.",
  },
];

const FEATURES = [
  {
    title: "Self-custodial by design",
    body: "Privy's key-splitting technology means your private keys never fully exist in one place — including on our servers.",
  },
  {
    title: "Live markets, real data",
    body: "Every price and chart on this page streams from live exchange and market data, updating in real time as the market moves.",
  },
  {
    title: "Multi-asset from one balance",
    body: "Bitcoin, Ethereum, Litecoin, and Solana today — stocks alongside them soon, all under a single portfolio value.",
  },
  {
    title: "Licensed on-ramps",
    body: "Funding is handled by regulated money service businesses. Coinstate Capital never touches your payment details or your funds.",
  },
];

export default function Landing() {
  const stockQuotes = useMarketQuotes(HOMEPAGE_STOCK_SYMBOLS);

  return (
    <div>
      <nav className="nav">
        <div className="wrap">
          <a href="/" className="brand"><span className="brand-mark"></span>Coinstate Capital</a>
          <Link to="/auth" className="btn-primary" style={{ padding: "10px 20px", fontSize: 14.5 }}>
            Log in
          </Link>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <h1 style={{ fontSize: "clamp(38px,5vw,58px)", lineHeight: 1.06, maxWidth: "18ch" }}>
            One balance. Your coins and your stocks.
          </h1>
          <p style={{ marginTop: 24, fontSize: 18, color: "rgba(237,231,218,0.72)", maxWidth: "46ch" }}>
            A secure, self-custodial wallet is created for you the moment you log in.
            Fund it through licensed on-ramps, and invest across crypto and stocks
            from one view.
          </p>
          <div style={{ marginTop: 36, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link to="/auth" className="btn-primary">Create your wallet</Link>
            <a href="#markets" className="btn-secondary">See live markets</a>
          </div>
        </div>
        <div className="wrap">
          <TickerStrip />
        </div>
      </header>

      <section id="markets" className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="serif">Live markets</h2>
            <p>Real charts, streaming from live market data — not a mockup.</p>
          </div>
          <div className="chart-grid">
            {["BTC", "ETH", "SOL", "LTC"].map((symbol) => (
              <PriceChart key={symbol} symbol={symbol} onBuy={() => (window.location.href = "/auth")} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="serif">The market's biggest names</h2>
            <p>Major stocks and indices like the S&amp;P 500 and Nasdaq 100, alongside crypto, all in one account.</p>
          </div>
          <div className="chart-grid">
            {HOMEPAGE_STOCKS.map((s) => (
              <PriceChart
                key={s.symbol}
                symbol={s.symbol}
                name={s.name}
                type={s.type}
                quote={stockQuotes[s.symbol]}
                onBuy={() => (window.location.href = "/auth")}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="serif">How it works</h2>
            <p>Three steps, one account.</p>
          </div>
          <div className="steps-grid">
            {STEPS.map((s) => (
              <div className="step-card" key={s.n}>
                <div className="step-n">{s.n}</div>
                <h3 style={{ fontSize: 19, marginBottom: 10 }}>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="brand-mark" style={{ marginBottom: 18 }}></span>
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 className="serif" style={{ fontSize: "clamp(28px,4vw,40px)" }}>
            Your wallet is one login away.
          </h2>
          <div style={{ marginTop: 28 }}>
            <Link to="/auth" className="btn-primary">Create your wallet</Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <p className="fine">
            Coinstate Capital does not hold customer funds, crypto, or securities.
            Crypto purchases are facilitated by third-party licensed money service
            businesses, delivered directly to a wallet only you control. Investing
            involves risk, including loss of principal.
          </p>
        </div>
      </footer>
    </div>
  );
}
