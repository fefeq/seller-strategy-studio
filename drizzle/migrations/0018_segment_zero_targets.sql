-- A target of 0 is a real answer ("we don't sell to this segment"), not a missing value.
-- The old checks rejected 0, so the save failed and the field came back empty on reload.
alter table public.segments drop constraint if exists segments_win_rate_target_check;
alter table public.segments add constraint segments_win_rate_target_check check (win_rate_target is null or (win_rate_target >= 0 and win_rate_target <= 100));
alter table public.segments drop constraint if exists segments_gross_margin_pct_check;
alter table public.segments add constraint segments_gross_margin_pct_check check (gross_margin_pct is null or (gross_margin_pct >= 0 and gross_margin_pct <= 100));
