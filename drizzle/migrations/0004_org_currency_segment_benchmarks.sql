alter table public.organizations add column currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$');
alter table public.segments add column win_rate_target numeric check (win_rate_target is null or (win_rate_target > 0 and win_rate_target <= 100));
alter table public.segments add column ae_quota numeric check (ae_quota is null or ae_quota >= 0);
alter table public.segments add column gross_margin_pct numeric default 80 check (gross_margin_pct is null or (gross_margin_pct > 0 and gross_margin_pct <= 100));