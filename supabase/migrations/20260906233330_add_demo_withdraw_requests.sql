-- Demo Mode "Withdraw" — mirrors the Site Credit deposit-request pattern
-- (submit -> admin reviews -> approve/reject) rather than instant
-- self-service like add_demo_funds, per explicit user request: a
-- withdrawal should require the same admin approval step in /admin that
-- real Site Credit deposits already do, even though this is fake money.
--
-- The requested amount is escrowed (subtracted from demo_balance_usd)
-- the moment the request is created, not on approval — same as a real
-- brokerage holding withdrawn funds unavailable while pending. If
-- rejected, it's refunded back via add_demo_funds. If approved, nothing
-- further happens to the balance (it's already deducted).
create table if not exists demo_withdraw_requests (
  id bigserial primary key,
  wallet_address text not null,
  amount_usd numeric not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create or replace function create_demo_withdraw_request(p_wallet text, p_amount numeric)
returns jsonb
language plpgsql
as $$
declare
  v_demo_mode boolean;
  v_cash numeric;
  v_pending_count int;
  v_id bigint;
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

  update wallet_overrides set demo_balance_usd = v_cash - p_amount, updated_at = now()
    where wallet_address = p_wallet;

  insert into demo_withdraw_requests (wallet_address, amount_usd)
    values (p_wallet, p_amount)
    returning id into v_id;

  return jsonb_build_object('cashUsd', v_cash - p_amount, 'requestId', v_id);
end;
$$;
