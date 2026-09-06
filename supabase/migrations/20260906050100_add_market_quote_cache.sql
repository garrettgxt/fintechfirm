-- Fallback for when Twelve Data's free-tier daily credit cap is
-- exhausted (a recurring problem — see CLAUDE.md): functions/
-- market-quote.js now persists every successful quote here, and falls
-- back to the last cached value per symbol when Twelve Data itself
-- rejects the request. Demo Mode trading doesn't need a perfectly fresh
-- price, just *a* real one, so a stale cached quote is an acceptable
-- fallback — this only ever feeds Demo Mode math, never real money.
create table if not exists market_quote_cache (
  symbol text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seeded with the last real quotes this session actually observed from
-- Twelve Data (via the browser, before the daily cap was hit) so Demo
-- Mode buys for these symbols work immediately rather than waiting for
-- the next successful fetch — not fabricated, just not live-fresh.
insert into market_quote_cache (symbol, data) values
  ('AAPL', '{"symbol":"AAPL","price":319.97,"changePct":-2.51,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('TSLA', '{"symbol":"TSLA","price":354.08,"changePct":-5.92,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('NVDA', '{"symbol":"NVDA","price":230.36,"changePct":0.84,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb),
  ('NFLX', '{"symbol":"NFLX","price":78.25,"changePct":-5.35,"open":null,"high":null,"low":null,"previousClose":null,"volume":null,"avgVolume":null,"fiftyTwoWeekHigh":null,"fiftyTwoWeekLow":null,"exchange":null}'::jsonb)
on conflict (symbol) do nothing;
