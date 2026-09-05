import { Link } from "react-router-dom";

export default function Landing() {
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

      <header style={{ padding: "96px 0" }}>
        <div className="wrap">
          <h1 style={{ fontSize: "clamp(38px,5vw,58px)", lineHeight: 1.06, maxWidth: "18ch" }}>
            One balance. Your coins and your stocks.
          </h1>
          <p style={{ marginTop: 24, fontSize: 18, color: "rgba(237,231,218,0.72)", maxWidth: "46ch" }}>
            A secure, self-custodial wallet is created for you the moment you log in.
            Fund it through licensed on-ramps, and invest across crypto and stocks
            from one view.
          </p>
          <div style={{ marginTop: 36 }}>
            <Link to="/auth" className="btn-primary">Create your wallet</Link>
          </div>
        </div>
      </header>

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
