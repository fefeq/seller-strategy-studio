-- Signals also cover success stories (case studies) published by or about the account.
alter table public.account_signals drop constraint if exists account_signals_kind_check;
alter table public.account_signals add constraint account_signals_kind_check
  check (kind in ('funding', 'hiring', 'launch', 'leadership', 'partnership', 'expansion', 'results', 'case_study', 'risk', 'other'));