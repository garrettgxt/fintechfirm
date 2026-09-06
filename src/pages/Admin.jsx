import { useState } from "react";

// Block explorer links per currency, for verifying a submitted tx_hash
// before approving a deposit request — see CLAUDE.md's Site Credit
// section for why this manual step exists (NOWPayments was removed;
// fixed shared addresses have no automated way to confirm a payment).
function explorerUrl(currency, txHash) {
  if (!txHash) return null;
  switch (currency) {
    case "eth":
      return `https://etherscan.io/tx/${txHash}`;
    case "btc":
      return `https://www.blockchain.com/explorer/transactions/btc/${txHash}`;
    case "ltc":
      return `https://blockchair.com/litecoin/transaction/${txHash}`;
    case "sol":
      return `https://solscan.io/tx/${txHash}`;
    default:
      return null;
  }
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawRequests, setWithdrawRequests] = useState([]);
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
      loadDepositRequests(pwd);
      loadWithdrawRequests(pwd);
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function loadDepositRequests(pwd) {
    try {
      const res = await fetch("/admin-list-deposit-requests", {
        headers: { "x-admin-password": pwd },
      });
      const data = await res.json();
      if (res.ok) setDepositRequests(data.requests);
    } catch (e) {
      console.error("Failed to load deposit requests:", e);
    }
  }

  async function reviewDeposit(requestId, action) {
    await fetch("/admin-review-deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ requestId, action }),
    });
    loadDepositRequests(password);
  }

  async function loadWithdrawRequests(pwd) {
    try {
      const res = await fetch("/admin-list-demo-withdraw-requests", {
        headers: { "x-admin-password": pwd },
      });
      const data = await res.json();
      if (res.ok) setWithdrawRequests(data.requests);
    } catch (e) {
      console.error("Failed to load withdrawal requests:", e);
    }
  }

  async function reviewWithdraw(requestId, action) {
    await fetch("/admin-review-demo-withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ requestId, action }),
    });
    loadWithdrawRequests(password);
  }

  async function updateWallet(walletAddress, demoMode, demoBalanceUsd) {
    await fetch("/admin-update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ walletAddress, demoMode, demoBalanceUsd }),
    });
    loadWallets(password);
  }

  async function resetPortfolio(walletAddress) {
    await fetch("/admin-reset-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ walletAddress }),
    });
    loadWallets(password);
  }

  async function deleteWallet(walletAddress) {
    await fetch("/admin-delete-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ walletAddress }),
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
      <h1 className="serif" style={{ fontSize: 26, marginBottom: 12 }}>Admin — Pending deposit requests</h1>
      <div style={{ fontSize: 13, color: "rgba(237,231,218,0.5)", marginBottom: 24 }}>
        Site Credit deposits go to the fixed addresses in src/walletAddresses.js — there's no
        automatic way to confirm a payment or know who sent it, so nothing is credited until you
        verify the tx hash on a block explorer and approve it here.
      </div>

      {depositRequests.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "rgba(237,231,218,0.45)", marginBottom: 32 }}>
          No pending deposit requests.
        </div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {depositRequests.map((r) => (
            <div key={r.id} style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 600 }}>
                    ${Number(r.amount_usd).toFixed(2)} — {r.currency.toUpperCase()}
                  </div>
                  <div className="num" style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)", marginTop: 4 }}>
                    {r.wallet_address}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(237,231,218,0.4)", marginTop: 4 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.tx_hash ? (
                    <a
                      href={explorerUrl(r.currency, r.tx_hash)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12.5, color: "var(--brass-bright)", marginTop: 8, display: "inline-block" }}
                    >
                      View tx on block explorer →
                    </a>
                  ) : (
                    <div style={{ fontSize: 12.5, color: "var(--rust)", marginTop: 8 }}>
                      No tx hash submitted — verify manually before approving.
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={() => reviewDeposit(r.id, "approve")}>
                    Approve
                  </button>
                  <button className="btn-secondary" onClick={() => reviewDeposit(r.id, "reject")}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h1 className="serif" style={{ fontSize: 26, marginBottom: 12 }}>Admin — Pending demo withdrawal requests</h1>
      <div style={{ fontSize: 13, color: "rgba(237,231,218,0.5)", marginBottom: 24 }}>
        Demo Mode is fake money, but withdrawals still go through the same review step as real deposits — the
        requested amount is already held aside from that wallet's cash balance. Approve just marks it reviewed;
        reject refunds the amount back to their demo cash.
      </div>

      {withdrawRequests.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "rgba(237,231,218,0.45)", marginBottom: 32 }}>
          No pending withdrawal requests.
        </div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {withdrawRequests.map((r) => (
            <div key={r.id} style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 600 }}>
                    ${Number(r.amount_usd).toFixed(2)} — demo cash
                  </div>
                  <div className="num" style={{ fontSize: 12.5, color: "rgba(237,231,218,0.5)", marginTop: 4 }}>
                    {r.wallet_address}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(237,231,218,0.4)", marginTop: 4 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={() => reviewWithdraw(r.id, "approve")}>
                    Approve
                  </button>
                  <button className="btn-secondary" onClick={() => reviewWithdraw(r.id, "reject")}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h1 className="serif" style={{ fontSize: 26, marginBottom: 24 }}>Admin — Wallet Overrides</h1>
      <div style={{ fontSize: 13, color: "rgba(237,231,218,0.5)", marginBottom: 24 }}>
        Toggling Demo Mode gives the account a demo cash balance they can use
        to buy/sell across stocks, forex, and crypto on the Markets tab —
        simulated trades only, never real money or real assets. Set the
        starting cash balance here; "Reset portfolio" clears their bought
        positions back to a clean cash-only state (their cash balance is
        left as-is — adjust it separately if needed).
      </div>

      {wallets.map((w) => (
        <WalletRow key={w.wallet_address} wallet={w} onUpdate={updateWallet} onReset={resetPortfolio} onDelete={deleteWallet} />
      ))}
    </div>
  );
}

function WalletRow({ wallet, onUpdate, onReset, onDelete }) {
  const [demoMode, setDemoMode] = useState(wallet.demo_mode);
  const [demoBalance, setDemoBalance] = useState(wallet.demo_balance_usd);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
          <div style={{ fontSize: 11.5, color: "rgba(237,231,218,0.45)", marginBottom: 4 }}>Demo cash balance (USD)</div>
          <input
            type="number"
            value={demoBalance}
            onChange={(e) => setDemoBalance(parseFloat(e.target.value) || 0)}
            style={{ width: 120, background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 3, padding: 8, color: "var(--paper)" }}
          />
        </div>

        <button
          className="btn-secondary"
          style={{ alignSelf: "flex-end" }}
          onClick={() => onUpdate(wallet.wallet_address, demoMode, demoBalance)}
        >
          Save
        </button>

        <button
          className="btn-secondary"
          style={{ alignSelf: "flex-end" }}
          onClick={() => onReset(wallet.wallet_address)}
        >
          Reset portfolio
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        {confirmingDelete ? (
          <>
            <span style={{ fontSize: 12.5, color: "var(--rust)" }}>
              Delete this account and all its data (demo positions/orders, Site Credit balance, deposit
              requests)? This can't be undone.
            </span>
            <button
              className="btn-secondary"
              style={{ borderColor: "var(--rust)", color: "var(--rust)" }}
              onClick={() => onDelete(wallet.wallet_address)}
            >
              Confirm delete
            </button>
            <button className="btn-secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            className="btn-secondary"
            style={{ borderColor: "var(--rust)", color: "var(--rust)" }}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete account
          </button>
        )}
      </div>
    </div>
  );
}
