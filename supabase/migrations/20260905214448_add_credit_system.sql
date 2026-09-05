-- Crypto-to-site-credit payment system (NOWPayments-backed).
--
-- credit_payments is the audit trail + idempotency guard: the webhook that
-- credits a balance must never do so twice for the same payment_id, even if
-- NOWPayments retries the callback.
create table if not exists credit_payments (
  payment_id text primary key,
  wallet_address text not null,
  price_amount_usd numeric not null,
  pay_currency text not null,
  status text not null default 'waiting',
  credited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_payments_wallet_address_idx
  on credit_payments (wallet_address);

-- user_credits is the actual custodial balance shown to the user.
create table if not exists user_credits (
  wallet_address text primary key,
  balance_usd numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- Atomic upsert-and-add, so concurrent webhook calls can't race a
-- read-then-write and lose an increment.
create or replace function increment_credit_balance(p_wallet text, p_amount numeric)
returns void
language sql
as $$
  insert into user_credits (wallet_address, balance_usd, updated_at)
  values (p_wallet, p_amount, now())
  on conflict (wallet_address)
  do update set
    balance_usd = user_credits.balance_usd + excluded.balance_usd,
    updated_at = now();
$$;
