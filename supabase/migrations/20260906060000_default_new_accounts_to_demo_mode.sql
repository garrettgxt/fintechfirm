-- New accounts should start in Demo Mode by default — the admin has to
-- explicitly toggle it off (via /admin) for a wallet that shouldn't be
-- in Demo Mode, rather than opting each new user in manually.
--
-- register-wallet.js's insert only ever sets wallet_address + email,
-- deliberately omitting demo_mode/demo_balance_usd so Postgres applies
-- whatever the column DEFAULT is — this migration just changes that
-- default. Existing rows are untouched (ALTER COLUMN ... SET DEFAULT
-- only affects future inserts, not rows that already exist), so this
-- has no effect on any account that already exists.
--
-- demo_balance_usd's default also moves from 0 to 10000 — Demo Mode
-- being "on" with $0 to trade would look broken for a brand new user;
-- $10,000 is a standard paper-trading starting balance and is still
-- adjustable per-wallet via the admin panel like any other account.
alter table wallet_overrides alter column demo_mode set default true;
alter table wallet_overrides alter column demo_balance_usd set default 10000;
