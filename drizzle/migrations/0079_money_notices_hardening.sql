-- NK-0030 hardening (independent review, 2026-11-08): the two trigger functions of 0078 kept the default EXECUTE of PUBLIC.
-- They return trigger, so they cannot be called as RPC, but money_notify is closed and these should be too. A trigger function's
-- EXECUTE privilege is checked when the trigger is created, not when it fires, so the existing triggers keep working.
-- Safe to run twice.
revoke execute on function public.money_lead_sql_trg() from public, anon, authenticated;
revoke execute on function public.money_deal_won_trg() from public, anon, authenticated;
