import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";

export default function Auth() {
  const { ready, authenticated, login } = usePrivy();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && authenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [ready, authenticated, navigate]);

  return (
    <div className="authpage">
      <div className="auth-side">
        <a href="/" className="brand"><span className="brand-mark"></span>Coinstate Capital</a>
        <div className="auth-quote">
          <h2 className="serif">Everything you own, in one place — nowhere else but with you.</h2>
          <p>
            Logging in creates a secure wallet automatically, held only by you.
            Coinstate Capital never has access to it — Privy's key-splitting
            technology means your keys never fully exist in one place, including
            in our systems.
          </p>
        </div>
        <div></div>
      </div>

      <div className="auth-main">
        <div className="auth-box">
          <a href="/" className="brand" style={{ textDecoration: "none" }}>
            <span className="brand-mark"></span>Coinstate Capital
          </a>
          <h1 className="serif">Welcome</h1>
          <div className="sub">Log in or create an account — a secure wallet is set up for you automatically.</div>

          <button className="btn-primary" onClick={login} disabled={!ready}>
            {ready ? "Continue" : "Loading…"}
          </button>

          <div className="auth-fine">
            Continuing lets you sign in with email, Google, or Apple, and
            creates your self-custodial Coinstate Capital wallet if you don't
            already have one.
          </div>
        </div>
      </div>
    </div>
  );
}
