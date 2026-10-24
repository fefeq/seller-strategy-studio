CREATE TABLE public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'company' CHECK (scope IN ('company','user','account')),
  kind text NOT NULL DEFAULT 'business' CHECK (kind IN ('business','preference','account','outcome','task')),
  user_id uuid DEFAULT auth.uid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 3 AND 600),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('chat','meeting','decision','suggestion','manual')),
  learned boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  supersedes uuid REFERENCES public.memories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scope <> 'account' OR account_id IS NOT NULL)
);
CREATE INDEX memories_org_scope ON public.memories (org_id, scope, active);
CREATE INDEX memories_account ON public.memories (account_id) WHERE account_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.memories TO authenticated;
GRANT DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read company/account or own" ON public.memories FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id) AND (scope <> 'user' OR user_id = auth.uid()));
CREATE POLICY "insert as member" ON public.memories FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND public.is_org_member(org_id) AND user_id = auth.uid());
CREATE POLICY "edit own or as leader" ON public.memories FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND (user_id = auth.uid() OR (scope <> 'user' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = memories.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','sales_leader')))));
CREATE POLICY "owner deletes" ON public.memories FOR DELETE TO authenticated
  USING (org_id = public.current_org() AND (scope = 'user' AND user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = memories.org_id AND m.user_id = auth.uid() AND m.role = 'owner')));