-- Replaces the NOWPayments-backed Site Credit flow with fixed deposit
-- addresses (src/walletAddresses.js) + manual admin review — see
-- CLAUDE.md for why: the user asked to remove NOWPayments entirely,
-- which means nothing automatically confirms a payment or knows which
-- customer sent it (Ethereum and friends have no memo/payment-ID field).
-- A human verifying via a block explorer before crediting replaces that
-- automated confirmation.
create table if not exists credit_deposit_requests (
  id bigserial primary key,
  wallet_address text not null,
  amount_usd numeric not null,
  currency text not null,
  tx_hash text,
  status text not null default 'pending', -- pending | approved | rejected
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists credit_deposit_requests_status_idx
  on credit_deposit_requests (status, created_at desc);
