-- Root cause of a real reported bug: a wallet's demo_balance_usd could
-- drift into an ugly value like 121.99999999999999 instead of a clean
-- 122.00. `numeric` in Postgres is arbitrary-precision, not floating
-- point, but a trade's cost is computed from a price that arrived as a
-- JS double from a live feed (e.g. 182.4300000000000068...) — that full
-- decimal expansion gets stored verbatim. The balance still DISPLAYED as
-- "$122.00" (toFixed(2) in the UI), but the true stored value wasn't
-- exactly that, so hitting "Max" on Withdraw filled in the ugly full-
-- precision figure, and typing the clean, displayed "122" back in then
-- failed as "more than your cash balance" because it actually was.
--
-- Fix: cash is always dollars, so round it to cents on every write.
-- Positions' quantity is deliberately left alone (that's shares/coins,
-- not USD — display-rounded client-side already, see AssetDetailPanel).
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

    update wallet_overrides set demo_balance_usd = round(v_cash - v_cost, 2), updated_at = now()
      where wallet_address = p_wallet;

  elsif p_side = 'sell' then
    select quantity, avg_cost_usd into v_existing_qty, v_existing_cost
    from demo_positions where wallet_address = p_wallet and symbol = p_symbol
    for update;

    if not found or v_existing_qty < p_quantity then
      raise exception 'insufficient_position';
    end if;

    v_new_qty := v_existing_qty - p_quantity;
    if v_new_qty <= 1e-8 then
      delete from demo_positions where wallet_address = p_wallet and symbol = p_symbol;
    else
      update demo_positions
        set quantity = v_new_qty, updated_at = now()
        where wallet_address = p_wallet and symbol = p_symbol;
    end if;

    update wallet_overrides set demo_balance_usd = round(v_cash + v_cost, 2), updated_at = now()
      where wallet_address = p_wallet;

  else
    raise exception 'invalid_side';
  end if;

  return jsonb_build_object(
    'cashUsd', (select demo_balance_usd from wallet_overrides where wallet_address = p_wallet)
  );
end;
$$;

create or replace function add_demo_funds(p_wallet text, p_amount numeric)
returns jsonb
language plpgsql
as $$
declare
  v_demo_mode boolean;
  v_cash numeric;
  v_new_cash numeric;
begin
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select demo_mode, coalesce(demo_balance_usd, 0) into v_demo_mode, v_cash
  from wallet_overrides where wallet_address = p_wallet
  for update;

  if not found or not v_demo_mode then
    raise exception 'demo_mode_not_active';
  end if;

  v_new_cash := round(v_cash + p_amount, 2);
  update wallet_overrides set demo_balance_usd = v_new_cash, updated_at = now()
    where wallet_address = p_wallet;

  return jsonb_build_object('cashUsd', v_new_cash);
end;
$$;

create or replace function create_demo_withdraw_request(p_wallet text, p_amount numeric)
returns jsonb
language plpgsql
as $$
declare
  v_demo_mode boolean;
  v_cash numeric;
  v_pending_count int;
  v_id bigint;
  v_new_cash numeric;
begin
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select demo_mode, coalesce(demo_balance_usd, 0) into v_demo_mode, v_cash
  from wallet_overrides where wallet_address = p_wallet
  for update;

  if not found or not v_demo_mode then
    raise exception 'demo_mode_not_active';
  end if;

  select count(*) into v_pending_count
  from demo_withdraw_requests where wallet_address = p_wallet and status = 'pending';

  if v_pending_count > 0 then
    raise exception 'withdrawal_already_pending';
  end if;

  if v_cash < p_amount then
    raise exception 'insufficient_cash';
  end if;

  v_new_cash := round(v_cash - p_amount, 2);
  update wallet_overrides set demo_balance_usd = v_new_cash, updated_at = now()
    where wallet_address = p_wallet;

  insert into demo_withdraw_requests (wallet_address, amount_usd)
    values (p_wallet, p_amount)
    returning id into v_id;

  return jsonb_build_object('cashUsd', v_new_cash, 'requestId', v_id);
end;
$$;

-- One-time cleanup of every wallet already carrying a dust-affected
-- balance from before this fix.
update wallet_overrides set demo_balance_usd = round(demo_balance_usd, 2)
  where demo_balance_usd is not null;
