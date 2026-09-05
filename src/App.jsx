import { Routes, Route, Navigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import Landing from "./pages/Landing.jsx";
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";

function RequireAuth({ children }) {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(237,231,218,0.5)" }}>
        Loading…
      </div>
    );
  }
  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
