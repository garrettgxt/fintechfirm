import { useState, useEffect } from "react";
import { SUPPORTED_CURRENCIES } from "../walletAddresses.js";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadWallets(pwd) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/admin-list", {
        headers: { "x-admin-password": pwd },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load");
        setAuthed(false);
        return;
      }
      setWallets(data.wallets);
      setAuthed(true);
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function updateWallet(walletAddress, demoMode, demoBalanceUsd, demoAsset, demoAssetAmount) {
    await fetch("/admin-update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ walletAddress, demoMode, demoBalanceUsd, demoAsset, demoAssetAmount }),
    });
    loadWallets(password);
  }

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 36, width: 340 }}>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 20 }}>Admin access</h2>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadWallets(password)}
            style={{
              width: "100%", background: "var(--ink)", border: "1px solid var(--line)",
              borderRadius: 3, padding: 12, color: "var(--paper)", marginBottom: 16,
            }}
          />
          <button className="btn-primary" style={{ width: "100%" }} onClick={() => loadWallets(password)} disabled={loading}>
            {loading ? "Checking…" : "Enter"}
          </button>
          {error && <div style={{ color: "var(--rust)", fontSize: 13, marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1 className="serif" style={{ fontSize: 26, marginBottom: 24 }}>Admin — Wallet Overrides</h1>
      <div style={{ fontSize: 13, color: "rgba(237,231,218,0.5)", marginBottom: 24 }}>
        Toggling Demo Mode shows the account a fake balance and a fake crypto
        holding you set, clearly labeled as demo — it never touches their
        real on-chain funds.
      </div>

      {wallets.map((w) => (
        <WalletRow key={w.wallet_address} wallet={w} onUpdate={updateWallet} />
      ))}
    </div>
  );
}

function WalletRow({ wallet, onUpdate }) {
  const [demoMode, setDemoMode] = useState(wallet.demo_mode);
  const [demoBalance, setDemoBalance] = useState(wallet.demo_balance_usd);
  const [demoAsset, setDemoAsset] = useState(wallet.demo_asset || "ETH");
  const [demoAssetAmount, setDemoAssetAmount] = useState(wallet.demo_asset_amount || 0);

  return (
    <div style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 20, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="num" style={{ fontSize: 13.5 }}>{wallet.wallet_address}</div>
          <div style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)", marginTop: 4 }}>{wallet.email}</div>
        </div>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
          Demo Mode
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.45)", marginBottom: 4 }}>Total shown (USD)</div>
          <input
            type="number"
            value={demoBalance}
            onChange={(e) => setDemoBalance(parseFloat(e.target.value) || 0)}
            style={{ width: 100, background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 3, padding: 8, color: "var(--paper)" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.45)", marginBottom: 4 }}>Holding asset</div>
          <select
            value={demoAsset}
            onChange={(e) => setDemoAsset(e.target.value)}
            style={{ background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 3, padding: 8, color: "var(--paper)" }}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.45)", marginBottom: 4 }}>Value of holding (USD)</div>
          <input
            type="number"
            step="any"
            value={demoAssetAmount}
            onChange={(e) => setDemoAssetAmount(parseFloat(e.target.value) || 0)}
            style={{ width: 110, background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 3, padding: 8, color: "var(--paper)" }}
          />
        </div>

        <button
          className="btn-secondary"
          style={{ alignSelf: "flex-end" }}
          onClick={() => onUpdate(wallet.wallet_address, demoMode, demoBalance, demoAsset, demoAssetAmount)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
