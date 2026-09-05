import { useLivePrices } from "../hooks/useLivePrices.js";
import Sparkline from "./Sparkline.jsx";

const SYMBOLS = ["BTC", "ETH", "SOL", "LTC"];

export default function TickerStrip() {
  const prices = useLivePrices();

  return (
    <div className="ticker-strip">
      {SYMBOLS.map((symbol) => {
        const live = prices[symbol];
        const isUp = (live?.changePct24h ?? 0) >= 0;
        return (
          <div className="ticker-item" key={symbol}>
            <div className="ticker-symbol">{symbol}</div>
            <div className="ticker-price num">
              {live?.price != null
                ? `$${live.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
            </div>
            <Sparkline history={live?.history} isUp={isUp} width={64} height={22} />
            {live?.changePct24h != null && (
              <div className="ticker-change num" style={{ color: isUp ? "var(--sage)" : "var(--rust)" }}>
                {isUp ? "+" : ""}
                {live.changePct24h.toFixed(2)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
