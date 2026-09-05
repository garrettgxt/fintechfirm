-- Demo Mode paper-trading portfolio.
--
-- wallet_overrides.demo_balance_usd is repurposed as the demo CASH
-- balance (previously "total shown on dashboard"). demo_asset /
-- demo_asset_amount (the old single fixed holding) are superseded by
-- real positions here and are no longer written to, but left in place —
-- not worth a destructive migration for a demo feature.
create table if not exists demo_positions (
  wallet_address text not null,
  symbol text not null,
  asset_type text not null,
  quantity numeric not null,
  avg_cost_usd numeric not null,
  updated_at timestamptz not null default now(),
  primary key (wallet_address, symbol)
);

-- Applies one buy or sell atomically: validates demo_mode + funds/position,
-- moves cash, and upserts/deletes the position — all in one statement so a
-- webhook-style race (or a double-click) can't corrupt the ledger.
create or replace function apply_demo_trade(
  p_wallet text,
  p_symbol text,
  p_asset_type text,
  p_side text,
  p_quantity numeric,
  p_price numeric
)
returns jsonb
language plpgsql
as $$
declare
  v_demo_mode boolean;
  v_cash numeric;
  v_cost numeric := p_quantity * p_price;
  v_existing_qty numeric;
  v_existing_cost numeric;
  v_new_qty numeric;
  v_new_avg_cost numeric;
begin
  if p_quantity <= 0 or p_price <= 0 then
    raise exception 'invalid_quantity_or_price';
  end if;

  select demo_mode, coalesce(demo_balance_usd, 0) into v_demo_mode, v_cash
  from wallet_overrides where wallet_address = p_wallet
  for update;

  if not found or not v_demo_mode then
    raise exception 'demo_mode_not_active';
  end if;

  if p_side = 'buy' then
    if v_cash < v_cost then
      raise exception 'insufficient_cash';
    end if;

    select quantity, avg_cost_usd into v_existing_qty, v_existing_cost
    from demo_positions where wallet_address = p_wallet and symbol = p_symbol
    for update;

    if found then
      v_new_qty := v_existing_qty + p_quantity;
      v_new_avg_cost := ((v_existing_qty * v_existing_cost) + v_cost) / v_new_qty;
      update demo_positions
        set quantity = v_new_qty, avg_cost_usd = v_new_avg_cost, updated_at = now()
        where wallet_address = p_wallet and symbol = p_symbol;
    else
      insert into demo_positions (wallet_address, symbol, asset_type, quantity, avg_cost_usd)
      values (p_wallet, p_symbol, p_asset_type, p_quantity, p_price);
    end if;

    update wallet_overrides set demo_balance_usd = v_cash - v_cost, updated_at = now()
      where wallet_address = p_wallet;

  elsif p_side = 'sell' then
    select quantity, avg_cost_usd into v_existing_qty, v_existing_cost
    from demo_positions where wallet_address = p_wallet and symbol = p_symbol
    for update;

    if not found or v_existing_qty < p_quantity then
      raise exception 'insufficient_position';
    end if;

    v_new_qty := v_existing_qty - p_quantity;
    if v_new_qty <= 0 then
      delete from demo_positions where wallet_address = p_wallet and symbol = p_symbol;
    else
      update demo_positions
        set quantity = v_new_qty, updated_at = now()
        where wallet_address = p_wallet and symbol = p_symbol;
    end if;

    update wallet_overrides set demo_balance_usd = v_cash + v_cost, updated_at = now()
      where wallet_address = p_wallet;

  else
    raise exception 'invalid_side';
  end if;

  return jsonb_build_object(
    'cashUsd', (select demo_balance_usd from wallet_overrides where wallet_address = p_wallet)
  );
end;
$$;
