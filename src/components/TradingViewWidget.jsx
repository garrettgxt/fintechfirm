import { useEffect, useRef } from "react";

// Embeds TradingView's free "Symbol Overview" widget in chartOnly mode
// for a stock/ETF/forex symbol (tvSymbol is exchange-prefixed, e.g.
// "NASDAQ:AAPL" — see TV_SYMBOLS in src/assetCatalog.js). This replaced
// our own Twelve-Data-backed chart history for non-crypto assets:
// TradingView renders the chart from its own infrastructure via this
// embed script, so it costs zero API credits and has no rate limit on
// our side. The tradeoff is the widget is a sandboxed iframe with no
// public JS API on the free tier — we can't read a numeric price out of
// it. That's fine here: the numeric price used for Buy/Sell math still
// comes from functions/market-quote.js (Twelve Data), passed in
// separately by the caller.
//
// chartOnly:true strips the widget down to a bare chart line — no name/
// price/percent row and no date-range tabs, which otherwise duplicate
// our own header (tried both the default Symbol Overview and the "Mini
// Chart" product first; both render their own ticker+name label). The
// active range is set by appending "|<rangeCode>" to the symbol itself
// (TradingView's own range ids: 1d, 1m, 3m, 12m, 60m, all) — see
// MARKET_RANGES in PriceChart.jsx / AssetDetailPanel.jsx for the buttons
// that drive `rangeCode`, styled to match our own crypto range toggle.
export default function TradingViewWidget({ tvSymbol, height = 220, rangeCode = "1d" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tvSymbol) return;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[`${tvSymbol}|${rangeCode}`]],
      chartOnly: true,
      width: "100%",
      height,
      locale: "en",
      colorTheme: "dark",
      isTransparent: true,
      autosize: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "Inter, sans-serif",
      fontSize: "11",
      chartType: "area",
      lineWidth: 2,
      lineType: 0,
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [tvSymbol, height, rangeCode]);

  return <div className="tradingview-widget-container" ref={containerRef} style={{ height }} />;
}
