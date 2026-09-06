-- The AAPL/TSLA/NVDA/NFLX seed in 20260906050100_add_market_quote_cache.sql
-- covered only 4 of the 11 non-crypto catalog symbols. Twelve Data's free
-- tier stayed exhausted continuously (4300+ credits used against an
-- 800/day cap, still climbing from ordinary site traffic even with every
-- optimization applied — see CLAUDE.md), so the cache never got a chance
-- to self-heal for the other 7 symbols. A tester picking one of those had
-- a coin-flip chance of hitting "Waiting for a live price..." on a random
-- stock. These are approximate current-range price levels, NOT
-- empirically observed via Twelve Data like the original 4 — changePct
-- is left null (no fabricated trend direction) rather than guessed.
-- Real values will overwrite these automatically the next time Twelve
-- Data succeeds for a symbol (market-quote.js's cacheQuotes()).
insert into market_quote_cache (symbol, data) values
  ('MSFT', '{"symbol":"MSFT","price":510.00,"changePct":null,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('AMZN', '{"symbol":"AMZN","price":225.00,"changePct":null,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('SPY', '{"symbol":"SPY","price":650.00,"changePct":null,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('QQQ', '{"symbol":"QQQ","price":520.00,"changePct":null,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('DIA', '{"symbol":"DIA","price":440.00,"changePct":null,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('EUR/USD', '{"symbol":"EUR/USD","price":1.08,"changePct":null,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('USD/JPY', '{"symbol":"USD/JPY","price":152.00,"changePct":null,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb)
on conflict (symbol) do nothing;
