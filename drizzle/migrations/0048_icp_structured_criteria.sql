ALTER TABLE public.icp_profiles
  ADD COLUMN IF NOT EXISTS min_employees integer,
  ADD COLUMN IF NOT EXISTS max_employees integer,
  ADD COLUMN IF NOT EXISTS countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_titles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seniorities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pains text;