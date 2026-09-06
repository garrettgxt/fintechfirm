-- Reverts just the demo_balance_usd part of the earlier
-- 20260906060000_default_new_accounts_to_demo_mode.sql migration — new
-- accounts still default to demo_mode = true, but now start with $0
-- demo cash instead of $10,000 (explicit user request). They can top up
-- via the self-service "Add funds" flow (functions/add-demo-funds.js) or
-- an admin can set a starting balance via /admin.
alter table wallet_overrides alter column demo_balance_usd set default 0;
