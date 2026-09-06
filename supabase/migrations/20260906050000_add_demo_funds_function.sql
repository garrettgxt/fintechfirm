-- Self-service "add demo funds" — previously only the /admin panel could
-- top up a wallet's demo cash balance. This lets a demo user do it
-- themselves from the Dashboard (see functions/add-demo-funds.js), same
-- validation shape as apply_demo_trade: only ever touches a wallet that
-- already has demo_mode = true, so it can never inflate a real account's
-- Site Credit.
create or replace function add_demo_funds(p_wallet text, p_amount numeric)
returns jsonb
language plpgsql
as $$
declare
  v_demo_mode boolean;
  v_cash numeric;
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

  update wallet_overrides set demo_balance_usd = v_cash + p_amount, updated_at = now()
    where wallet_address = p_wallet;

  return jsonb_build_object('cashUsd', v_cash + p_amount);
end;
$$;
