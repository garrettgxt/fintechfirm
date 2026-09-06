import { useEffect, useRef } from "react";

// Embeds TradingView's free "Mini Chart" widget for a stock/ETF/forex
// symbol (tvSymbol is exchange-prefixed, e.g. "NASDAQ:AAPL" — see
// TV_SYMBOLS in src/assetCatalog.js). This replaced our own
// Twelve-Data-backed chart history for non-crypto assets: TradingView
// renders the chart from its own infrastructure via this embed script,
// so it costs zero API credits and has no rate limit on our side. The
// tradeoff is the widget is a sandboxed iframe with no public JS API on
// the free tier — we can't read a numeric price out of it. That's fine
// here: the numeric price used for Buy/Sell math still comes from
// functions/market-quote.js (Twelve Data), passed in separately by the
// caller.
//
// Deliberately the "Mini Chart" product (not "Symbol Overview", used
// here before) — Symbol Overview repeats the full company name inside
// the widget, duplicating our own header, and has its own built-in
// multi-tab date-range row. Mini Chart shows just a bare chart with no
// name label, so `dateRange` is a single value we control from the
// outside — see RANGE_OPTIONS in PriceChart.jsx / AssetDetailPanel.jsx
// for the buttons that drive it, styled to match our own range toggle
// instead of relying on the widget's internal one.
export default function TradingViewWidget({ tvSymbol, height = 220, dateRange = "1D" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tvSymbol) return;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      width: "100%",
      height,
      locale: "en",
      dateRange,
      colorTheme: "dark",
      isTransparent: true,
      autosize: false,
      largeChartUrl: "",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [tvSymbol, height, dateRange]);

  return <div className="tradingview-widget-container" ref={containerRef} style={{ height }} />;
}
