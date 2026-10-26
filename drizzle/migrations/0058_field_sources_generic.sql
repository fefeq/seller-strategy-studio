-- NOT VERIFIED: written without a database to run it on (SDD universal-field-definitions, U-3).
-- Dani: apply it first on a test environment and check, with two fictional companies, that
--   1. an authenticated edit of accounts.industry / size / country stamps field_sources with kind persona and confirmed true;
--   2. clearing the value removes the mark instead of stamping it;
--   3. an update from the service role (auth.uid() is null) that does not touch field_sources drops the mark, as before;
--   4. an update that also changes field_sources (applyAutoChanges, FitFields) is kept exactly as sent;
--   5. icp_profiles behaves the same for countries, geography, min_employees, max_employees and company_size;
--   6. a member of company A cannot read or update icp_profiles of company B (the existing policies are not touched).
-- It changes no existing data: one new column with a default, and one trigger function that replaces the accounts one.

ALTER TABLE public.icp_profiles ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.icp_profiles.field_sources IS 'Origin and confirmation per field: {field:{source,kind,confirmed,at,quote?}}; a value with no mark is unknown, never a person''s.';

-- An update that changes a tracked field without touching field_sources was not stamped by Nokko's own fills.
-- From a signed-in person it is theirs: marked persona and confirmed. From a service path (no auth.uid()) we cannot
-- tell who wrote it, so the mark is dropped and the value stays «sin dato». An emptied value never gets a person mark.
CREATE OR REPLACE FUNCTION public.track_field_sources()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  f text;
  v jsonb;
  person boolean := auth.uid() IS NOT NULL;
BEGIN
  IF NEW.field_sources IS DISTINCT FROM OLD.field_sources THEN RETURN NEW; END IF;
  FOREACH f IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) -> f) IS DISTINCT FROM (to_jsonb(OLD) -> f) THEN
      v := to_jsonb(NEW) -> f;
      IF person AND v IS NOT NULL AND v <> 'null'::jsonb AND v <> '""'::jsonb AND v <> '[]'::jsonb THEN
        NEW.field_sources := NEW.field_sources || jsonb_build_object(f, jsonb_build_object(
          'source', 'persona', 'kind', 'persona', 'confirmed', true,
          'at', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
      ELSE
        NEW.field_sources := NEW.field_sources - f;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS accounts_clear_field_sources ON public.accounts;
DROP FUNCTION IF EXISTS public.accounts_clear_field_sources();

DROP TRIGGER IF EXISTS accounts_track_field_sources ON public.accounts;
CREATE TRIGGER accounts_track_field_sources BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.track_field_sources('industry', 'size', 'country', 'notes', 'linkedin_url');

DROP TRIGGER IF EXISTS icp_profiles_track_field_sources ON public.icp_profiles;
CREATE TRIGGER icp_profiles_track_field_sources BEFORE UPDATE ON public.icp_profiles
FOR EACH ROW EXECUTE FUNCTION public.track_field_sources('countries', 'geography', 'min_employees', 'max_employees', 'company_size');
