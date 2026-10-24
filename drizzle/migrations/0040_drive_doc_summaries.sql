-- AI summaries of the Google Drive documents in each account folder, cached per file and Drive modification
-- time so the Conocimiento tab «Drive por cuenta» does not re-read every document on each visit.
CREATE TABLE public.drive_doc_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  file_id text NOT NULL CHECK (file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  file_modified_at timestamptz,
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 2000),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, file_id)
);
CREATE INDEX drive_doc_summaries_account ON public.drive_doc_summaries (org_id, account_id);
GRANT SELECT, INSERT, UPDATE ON public.drive_doc_summaries TO authenticated;
GRANT ALL ON public.drive_doc_summaries TO service_role;
ALTER TABLE public.drive_doc_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.drive_doc_summaries FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE POLICY "org insert" ON public.drive_doc_summaries FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE POLICY "org update" ON public.drive_doc_summaries FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id))
  WITH CHECK (org_id = public.current_org() AND public.is_org_member(org_id));