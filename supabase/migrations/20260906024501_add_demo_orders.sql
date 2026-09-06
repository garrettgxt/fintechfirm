-- Demo Mode limit orders. A market order still executes immediately via
-- the existing apply_demo_trade() (see add_demo_positions migration) — a
-- limit order instead sits here as 'pending' until something (the
-- client, while that wallet's Dashboard is open — see CLAUDE.md for why
-- there's no background scheduler) calls fill_demo_order() once the
-- price crosses.
create table if not exists demo_orders (
  id bigserial primary key,
  wallet_address text not null,
  symbol text not null,
  asset_type text not null,
  side text not null,
  quantity numeric not null,
  limit_price numeric not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  filled_at timestamptz,
  filled_price numeric
);

create index if not exists demo_orders_wallet_status_idx on demo_orders (wallet_address, status);

-- Validates demo_mode and inserts a pending order. Deliberately does NOT
-- escrow cash/position up front (kept simple) — sufficiency is
-- re-checked at fill time by fill_demo_order, via apply_demo_trade.
create or replace function create_demo_order(
  p_wallet text,
  p_symbol text,
  p_asset_type text,
  p_side text,
  p_quantity numeric,
  p_limit_price numeric
)
returns bigint
language plpgsql
as $$
declare
  v_demo_mode boolean;
  v_id bigint;
begin
  if p_quantity <= 0 or p_limit_price <= 0 then
    raise exception 'invalid_quantity_or_price';
  end if;
  if p_side not in ('buy', 'sell') then
    raise exception 'invalid_side';
  end if;

  select demo_mode into v_demo_mode from wallet_overrides where wallet_address = p_wallet;
  if not found or not v_demo_mode then
    raise exception 'demo_mode_not_active';
  end if;

  insert into demo_orders (wallet_address, symbol, asset_type, side, quantity, limit_price)
  values (p_wallet, p_symbol, p_asset_type, p_side, p_quantity, p_limit_price)
  returning id into v_id;

  return v_id;
end;
$$;

-- Executes a pending order at p_fill_price by delegating to
-- apply_demo_trade (same cash/position logic as a market order). Returns
-- a status instead of raising, so a no-longer-affordable order fails
-- gracefully (marked 'failed') rather than erroring the HTTP call.
create or replace function fill_demo_order(p_order_id bigint, p_fill_price numeric)
returns jsonb
language plpgsql
as $$
declare
  v_order demo_orders%rowtype;
  v_trade_result jsonb;
begin
  select * into v_order from demo_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_order.status <> 'pending' then
    return jsonb_build_object('status', v_order.status);
  end if;
  if p_fill_price <= 0 then
    return jsonb_build_object('status', 'invalid_fill_price');
  end if;

  begin
    select apply_demo_trade(
      v_order.wallet_address, v_order.symbol, v_order.asset_type, v_order.side, v_order.quantity, p_fill_price
    ) into v_trade_result;
  exception when others then
    update demo_orders set status = 'failed' where id = p_order_id;
    return jsonb_build_object('status', 'failed', 'error', sqlerrm);
  end;

  update demo_orders
    set status = 'filled', filled_at = now(), filled_price = p_fill_price
    where id = p_order_id;

  return jsonb_build_object('status', 'filled', 'cashUsd', v_trade_result->'cashUsd');
end;
$$;

-- Cancels a wallet's own pending order. Scoped to (id, wallet_address) so
-- one wallet can't cancel another's order.
create or replace function cancel_demo_order(p_order_id bigint, p_wallet text)
returns jsonb
language plpgsql
as $$
declare
  v_updated int;
begin
  update demo_orders
    set status = 'cancelled'
    where id = p_order_id and wallet_address = p_wallet and status = 'pending';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_not_pending');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
