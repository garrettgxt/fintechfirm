// Coinstate Capital — tradable asset catalog (Demo Mode only for now;
// real-money stock/forex trading is not built — see CLAUDE.md).
//
// type: "crypto" uses the existing Coinbase/Binance pipeline
// (src/hooks/useLivePrices.js, Binance klines in PriceChart.jsx).
// type: "stock" | "etf" | "forex" uses Twelve Data via
// functions/market-quote.js and functions/market-history.js.

// Trimmed 2026-09-06 from 24 stocks/5 forex pairs down to this shorter
// list (32 -> 11 non-crypto symbols) after Twelve Data's free-tier daily
// credit cap (800/day, metered per symbol per request) got exhausted by
// real usage twice in one day — see the Twelve Data section in
// CLAUDE.md. This was the user's explicit choice among the options
// presented (upgrade plan / wait for reset / shrink catalog): stay on
// the free tier and reduce exposure instead of paying or waiting. A
// smaller catalog means more Markets-tab views fit in the daily budget
// before hitting the cap — it does not remove the cap. Crypto is
// unaffected (Coinbase/Binance aren't credit-metered this way), which is
// why that catalog stayed broad while this one got cut.
export const STOCKS = [
  { symbol: "AAPL", name: "Apple", type: "stock" },
  { symbol: "MSFT", name: "Microsoft", type: "stock" },
  { symbol: "AMZN", name: "Amazon", type: "stock" },
  { symbol: "NVDA", name: "Nvidia", type: "stock" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "NFLX", name: "Netflix", type: "stock" },
];

export const ETFS = [
  { symbol: "SPY", name: "S&P 500 ETF", type: "etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", type: "etf" },
  { symbol: "DIA", name: "Dow Jones ETF", type: "etf" },
];

export const FOREX = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", type: "forex" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", type: "forex" },
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
  // Everything below was added to broadly match the range of coins a
  // major retail platform (e.g. Wealthsimple Crypto) lists. Every symbol
  // here was verified, before adding, against Coinbase Exchange's live
  // /products list (for the real-time WS ticker in useLivePrices.js) AND
  // Binance's USDT trading pairs (for chart history in useAssetHistory.js)
  // — both required, or a coin looks "added" but silently never loads.
  { symbol: "BCH", name: "Bitcoin Cash", type: "crypto" },
  { symbol: "XLM", name: "Stellar", type: "crypto" },
  { symbol: "ALGO", name: "Algorand", type: "crypto" },
  { symbol: "ATOM", name: "Cosmos", type: "crypto" },
  { symbol: "FIL", name: "Filecoin", type: "crypto" },
  { symbol: "AAVE", name: "Aave", type: "crypto" },
  { symbol: "GRT", name: "The Graph", type: "crypto" },
  { symbol: "MANA", name: "Decentraland", type: "crypto" },
  { symbol: "SAND", name: "The Sandbox", type: "crypto" },
  { symbol: "XTZ", name: "Tezos", type: "crypto" },
  { symbol: "COMP", name: "Compound", type: "crypto" },
  { symbol: "CRV", name: "Curve DAO", type: "crypto" },
  { symbol: "YFI", name: "Yearn Finance", type: "crypto" },
  { symbol: "SUSHI", name: "SushiSwap", type: "crypto" },
  { symbol: "BAT", name: "Basic Attention Token", type: "crypto" },
  { symbol: "ZRX", name: "0x Protocol", type: "crypto" },
  { symbol: "SHIB", name: "Shiba Inu", type: "crypto" },
  { symbol: "APE", name: "ApeCoin", type: "crypto" },
  { symbol: "OP", name: "Optimism", type: "crypto" },
  { symbol: "ARB", name: "Arbitrum", type: "crypto" },
  { symbol: "NEAR", name: "Near Protocol", type: "crypto" },
  { symbol: "ICP", name: "Internet Computer", type: "crypto" },
  { symbol: "HBAR", name: "Hedera", type: "crypto" },
  { symbol: "VET", name: "VeChain", type: "crypto" },
  { symbol: "ZEC", name: "Zcash", type: "crypto" },
  { symbol: "DASH", name: "Dash", type: "crypto" },
  { symbol: "ETC", name: "Ethereum Classic", type: "crypto" },
  { symbol: "ENS", name: "Ethereum Name Service", type: "crypto" },
  { symbol: "LDO", name: "Lido DAO", type: "crypto" },
  { symbol: "PEPE", name: "Pepe", type: "crypto" },
  { symbol: "SUI", name: "Sui", type: "crypto" },
  { symbol: "SEI", name: "Sei", type: "crypto" },
  { symbol: "INJ", name: "Injective", type: "crypto" },
  { symbol: "RENDER", name: "Render", type: "crypto" },
  { symbol: "IMX", name: "Immutable", type: "crypto" },
  { symbol: "FLOW", name: "Flow", type: "crypto" },
  { symbol: "CHZ", name: "Chiliz", type: "crypto" },
  { symbol: "SNX", name: "Synthetix", type: "crypto" },
  { symbol: "STX", name: "Stacks", type: "crypto" },
  { symbol: "POL", name: "Polygon", type: "crypto" },
  { symbol: "MINA", name: "Mina Protocol", type: "crypto" },
  { symbol: "KSM", name: "Kusama", type: "crypto" },
  { symbol: "JASMY", name: "JasmyCoin", type: "crypto" },
  { symbol: "MASK", name: "Mask Network", type: "crypto" },
  { symbol: "GMT", name: "STEPN", type: "crypto" },
  { symbol: "TIA", name: "Celestia", type: "crypto" },
  { symbol: "PYTH", name: "Pyth Network", type: "crypto" },
  { symbol: "JTO", name: "Jito", type: "crypto" },
  { symbol: "WIF", name: "dogwifhat", type: "crypto" },
  { symbol: "BONK", name: "Bonk", type: "crypto" },
];

export const ASSET_CATALOG = [...STOCKS, ...ETFS, ...FOREX, ...CRYPTO];

// Every symbol that goes through Twelve Data (functions/market-quote.js)
// rather than the crypto pipeline — used to make a single batched quote
// request instead of one per visible card.
export const NON_CRYPTO_SYMBOLS = [...STOCKS, ...ETFS, ...FOREX].map((a) => a.symbol);

export function findAsset(symbol) {
  return ASSET_CATALOG.find((a) => a.symbol === symbol);
}
