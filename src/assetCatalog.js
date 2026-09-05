// Coinstate Capital — tradable asset catalog (Demo Mode only for now;
// real-money stock/forex trading is not built — see CLAUDE.md).
//
// type: "crypto" uses the existing Coinbase/Binance pipeline
// (src/hooks/useLivePrices.js, Binance klines in PriceChart.jsx).
// type: "stock" | "etf" | "forex" uses Twelve Data via
// functions/market-quote.js and functions/market-history.js.

export const STOCKS = [
  { symbol: "AAPL", name: "Apple", type: "stock" },
  { symbol: "MSFT", name: "Microsoft", type: "stock" },
  { symbol: "GOOGL", name: "Alphabet", type: "stock" },
  { symbol: "AMZN", name: "Amazon", type: "stock" },
  { symbol: "NVDA", name: "Nvidia", type: "stock" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "META", name: "Meta Platforms", type: "stock" },
  { symbol: "NFLX", name: "Netflix", type: "stock" },
  { symbol: "JPM", name: "JPMorgan Chase", type: "stock" },
  { symbol: "V", name: "Visa", type: "stock" },
  { symbol: "WMT", name: "Walmart", type: "stock" },
  { symbol: "DIS", name: "Disney", type: "stock" },
  { symbol: "KO", name: "Coca-Cola", type: "stock" },
  { symbol: "PEP", name: "PepsiCo", type: "stock" },
  { symbol: "XOM", name: "Exxon Mobil", type: "stock" },
  { symbol: "BA", name: "Boeing", type: "stock" },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "stock" },
  { symbol: "PG", name: "Procter & Gamble", type: "stock" },
  { symbol: "MA", name: "Mastercard", type: "stock" },
  { symbol: "HD", name: "Home Depot", type: "stock" },
  { symbol: "ORCL", name: "Oracle", type: "stock" },
  { symbol: "CRM", name: "Salesforce", type: "stock" },
  { symbol: "AMD", name: "AMD", type: "stock" },
  { symbol: "INTC", name: "Intel", type: "stock" },
];

export const ETFS = [
  { symbol: "SPY", name: "S&P 500 ETF", type: "etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", type: "etf" },
  { symbol: "DIA", name: "Dow Jones ETF", type: "etf" },
];

export const FOREX = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", type: "forex" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", type: "forex" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", type: "forex" },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", type: "forex" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", type: "forex" },
];

export const CRYPTO = [
  { symbol: "BTC", name: "Bitcoin", type: "crypto" },
  { symbol: "ETH", name: "Ethereum", type: "crypto" },
  { symbol: "LTC", name: "Litecoin", type: "crypto" },
  { symbol: "SOL", name: "Solana", type: "crypto" },
  { symbol: "XRP", name: "XRP", type: "crypto" },
  { symbol: "DOGE", name: "Dogecoin", type: "crypto" },
  { symbol: "ADA", name: "Cardano", type: "crypto" },
  { symbol: "AVAX", name: "Avalanche", type: "crypto" },
  { symbol: "DOT", name: "Polkadot", type: "crypto" },
  { symbol: "LINK", name: "Chainlink", type: "crypto" },
  { symbol: "BNB", name: "BNB", type: "crypto" },
  { symbol: "UNI", name: "Uniswap", type: "crypto" },
];

export const ASSET_CATALOG = [...STOCKS, ...ETFS, ...FOREX, ...CRYPTO];

// Every symbol that goes through Twelve Data (functions/market-quote.js)
// rather than the crypto pipeline — used to make a single batched quote
// request instead of one per visible card.
export const NON_CRYPTO_SYMBOLS = [...STOCKS, ...ETFS, ...FOREX].map((a) => a.symbol);

export function findAsset(symbol) {
  return ASSET_CATALOG.find((a) => a.symbol === symbol);
}
