-- NK-0171 SDD 4: play state (P-3), first activation (C-12), test results (G-3) and cost kind (6.5).
ALTER TABLE public.custom_plays
  ADD COLUMN status text NOT NULL DEFAULT 'aprobado' CHECK (status IN ('aprobado','activo','pausado','archivado')),
  ADD COLUMN first_activated_at timestamptz,
  ADD COLUMN test_sample integer CHECK (test_sample IS NULL OR test_sample > 0),
  ADD COLUMN test_successes integer CHECK (test_successes IS NULL OR test_successes >= 0),
  ADD COLUMN test_recorded_at timestamptz;
ALTER TABLE public.custom_play_costs
  ADD COLUMN cost_kind text NOT NULL DEFAULT 'provider_estimated' CHECK (cost_kind IN ('ai_measured','ai_sin_dato','provider_estimated'));
UPDATE public.custom_play_costs SET cost_kind = 'ai_sin_dato' WHERE provider = 'ai:sin_dato';