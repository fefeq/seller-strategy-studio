-- Onboarding sources: per-source read status and org-scoped storage for uploaded documents.
-- Rollback:
--   DROP POLICY IF EXISTS "onboarding sources read" ON storage.objects;
--   DROP POLICY IF EXISTS "onboarding sources upload" ON storage.objects;
--   DROP POLICY IF EXISTS "onboarding sources delete" ON storage.objects;
--   DROP FUNCTION IF EXISTS public.onboarding_source_path_ok(text, boolean);
--   ALTER TABLE public.onboarding_sessions DROP COLUMN IF EXISTS source_status;
ALTER TABLE public.onboarding_sessions ADD COLUMN IF NOT EXISTS source_status jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Path = <org_id>/<user_id>/<file>. Members of the org read; only the uploader writes/deletes under their own folder.
CREATE OR REPLACE FUNCTION public.onboarding_source_path_ok(_name text, _own boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[] := string_to_array(_name, '/');
BEGIN
  IF array_length(parts, 1) IS DISTINCT FROM 3 THEN RETURN false; END IF;
  IF parts[1] !~ '^[0-9a-fA-F-]{36}$' THEN RETURN false; END IF;
  IF NOT public.is_org_member(parts[1]::uuid) THEN RETURN false; END IF;
  IF _own AND parts[2] IS DISTINCT FROM auth.uid()::text THEN RETURN false; END IF;
  RETURN true;
END;
$$;

CREATE POLICY "onboarding sources read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'onboarding-sources' AND public.onboarding_source_path_ok(name, false));
CREATE POLICY "onboarding sources upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'onboarding-sources' AND public.onboarding_source_path_ok(name, true));
CREATE POLICY "onboarding sources delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'onboarding-sources' AND public.onboarding_source_path_ok(name, true));