// A flat 2-decimal format reads as "$0.00" for sub-cent coins (PEPE,
// SHIB, BONK, WIF, etc.) even though the real price is non-zero — this
// picks enough decimals to actually show a meaningful value at any scale,
// while keeping normal-priced assets (stocks, BTC, ETH) at the familiar
// 2 decimals.
export function formatPrice(price) {
  if (price == null || !Number.isFinite(price)) return null;
  let decimals = 2;
  if (price < 1 && price >= 0.01) decimals = 4;
  else if (price < 0.01 && price >= 0.0001) decimals = 6;
  else if (price < 0.0001) decimals = 8;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
