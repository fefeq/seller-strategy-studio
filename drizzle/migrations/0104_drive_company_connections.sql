-- C2 (SDD-20261025-drive-per-company-account): one Google Drive account per company, connected by its Owner.
-- The connection key is stored encrypted (AES-GCM, server-side) and is never readable from the browser:
-- members read only the safe columns through drive_company_connection_status().
CREATE TABLE public.drive_company_connections (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_key_enc text NOT NULL,
  account_email text,
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reconnect')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.drive_company_connections TO service_role;
ALTER TABLE public.drive_company_connections ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: only server code with the privileged client writes or reads the key.

-- Transition backup: the builder-Drive folders of a company are copied here before it switches account. Nothing is deleted.
CREATE TABLE public.drive_folders_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_row jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.drive_folders_backup TO authenticated;
GRANT ALL ON public.drive_folders_backup TO service_role;
ALTER TABLE public.drive_folders_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read their company drive backup" ON public.drive_folders_backup
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

-- Safe status for members (no key).
CREATE OR REPLACE FUNCTION public.drive_company_connection_status(_org uuid)
RETURNS TABLE (account_email text, connected_by uuid, connected_at timestamptz, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.account_email, c.connected_by, c.connected_at, c.status
  FROM public.drive_company_connections c
  WHERE c.org_id = _org AND public.is_org_member(_org);
$$;
REVOKE ALL ON FUNCTION public.drive_company_connection_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.drive_company_connection_status(uuid) TO authenticated;
