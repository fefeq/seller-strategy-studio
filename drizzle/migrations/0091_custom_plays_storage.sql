-- NK-0171 U-2: storage for custom plays. Members read their company; only the privileged client writes (PRD).
-- Retention: evidence lives while the play exists (decision 21); costs survive play deletion (no FK).
-- Rollback (manual): DROP TABLE public.custom_play_evidence; DROP TABLE public.custom_play_costs; DROP TABLE public.custom_plays;
CREATE TABLE public.custom_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^custom:[a-z0-9_-]+$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);
GRANT SELECT ON public.custom_plays TO authenticated;
GRANT ALL ON public.custom_plays TO service_role;
ALTER TABLE public.custom_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company custom plays read" ON public.custom_plays FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));

CREATE TABLE public.custom_play_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  play_id uuid NOT NULL REFERENCES public.custom_plays(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (url ~ '^https?://'),
  quote text NOT NULL CHECK (
    length(quote) BETWEEN 1 AND 280
    AND quote !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
    AND quote !~ '\+?[0-9][0-9 ().-]{7,}[0-9]'
  ),
  event_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_play_evidence TO authenticated;
GRANT ALL ON public.custom_play_evidence TO service_role;
ALTER TABLE public.custom_play_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company custom play evidence read" ON public.custom_play_evidence FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));

CREATE TABLE public.custom_play_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  play_key text NOT NULL,
  provider text,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_play_costs TO authenticated;
GRANT ALL ON public.custom_play_costs TO service_role;
ALTER TABLE public.custom_play_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company custom play costs read" ON public.custom_play_costs FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));