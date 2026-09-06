// Carries "which asset was the visitor trying to look at" across the
// logged-out -> /auth -> logged-in redirect. Landing.jsx's search bar and
// chart Buy buttons send a logged-out visitor straight to /auth (there's
// no session yet to open the asset detail view in), so without this the
// visitor lands on the plain Dashboard with no memory of what they
// clicked — Dashboard.jsx reads this once on mount and opens that asset's
// detail view instead.
const KEY = "coinstate_pending_asset";

export function setPendingAsset(asset) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(asset));
  } catch {
    // Storage can be unavailable (private browsing, etc.) — worst case,
    // the visitor just lands on the plain dashboard after login.
  }
}

// Reads and clears in one step — this is a one-time "resume where you
// left off," not a persistent redirect rule.
export function consumePendingAsset() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
