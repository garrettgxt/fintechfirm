import { useEffect, useRef } from "react";

// Embeds TradingView's free "Symbol Overview" widget for a stock/ETF/
// forex symbol (tvSymbol is exchange-prefixed, e.g. "NASDAQ:AAPL" — see
// TV_SYMBOLS in src/assetCatalog.js). This replaced our own
// Twelve-Data-backed chart history for non-crypto assets: TradingView
// renders the chart from its own infrastructure via this embed script,
// so it costs zero API credits and has no rate limit on our side. The
// tradeoff is the widget is a sandboxed iframe with no public JS API on
// the free tier — we can't read a numeric price out of it. That's fine
// here: the numeric price used for Buy/Sell math still comes from
// functions/market-quote.js (Twelve Data), which is passed in
// separately by the caller and shown in our own header, not derived
// from this widget.
export default function TradingViewWidget({ tvSymbol, height = 220 }) {
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
      symbols: [[tvSymbol]],
      chartOnly: false,
      width: "100%",
      height,
      locale: "en",
      colorTheme: "dark",
      isTransparent: true,
      autosize: false,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: true,
      hideSymbolLogo: true,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "Inter, sans-serif",
      fontSize: "11",
      noTimeScale: false,
      valuesTracking: "1",
      changeMode: "price-and-percent",
      chartType: "area",
      lineWidth: 2,
      lineType: 0,
      dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [tvSymbol, height]);

  return <div className="tradingview-widget-container" ref={containerRef} style={{ height }} />;
}
