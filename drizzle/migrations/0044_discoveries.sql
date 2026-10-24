CREATE TABLE public.discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('company','contact','competitor')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 300),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  dismiss_reason text,
  decided_by uuid,
  decided_at timestamptz,
  result_id uuid,
  week date NOT NULL DEFAULT (date_trunc('week', now()))::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, dedupe_key)
);
CREATE INDEX discoveries_org_status ON public.discoveries (org_id, status, kind);
GRANT SELECT ON public.discoveries TO authenticated;
GRANT UPDATE (status, dismiss_reason, decided_by, decided_at, result_id) ON public.discoveries TO authenticated;
GRANT DELETE ON public.discoveries TO authenticated;
GRANT ALL ON public.discoveries TO service_role;
ALTER TABLE public.discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.discoveries FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE POLICY "members decide" ON public.discoveries FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id))
  WITH CHECK (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE POLICY "owner deletes" ON public.discoveries FOR DELETE TO authenticated
  USING (org_id = public.current_org() AND public.has_org_role(org_id, 'owner'));
COMMENT ON TABLE public.discoveries IS 'Weekly «Descubiertos» inbox: companies, contacts and competitors found by Nokko; rows are written only by server code, members accept or dismiss.';