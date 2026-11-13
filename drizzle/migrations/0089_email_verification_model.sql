-- Rollback: stop verification writers/readers first; retire this table and triggers in a separate authorized migration, never delete verification data implicitly.
CREATE TABLE public.email_verifications (
 org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
 email text NOT NULL CHECK (email = lower(btrim(email)) AND length(email) > 0),
 status text NOT NULL CHECK (status IN ('verified','catch_all','unverifiable','invalid','unverified')),
 provider_status text CHECK (length(provider_status) <= 120),
 provider text NOT NULL CHECK (provider = 'apollo'),
 source text NOT NULL CHECK (source = 'revelado_apollo'),
 checked_at timestamptz NOT NULL,
 requested_by uuid,
 PRIMARY KEY (org_id,email)
);
REVOKE ALL ON public.email_verifications FROM anon, authenticated;
GRANT SELECT ON public.email_verifications TO authenticated;
GRANT ALL ON public.email_verifications TO service_role;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company verification read" ON public.email_verifications FOR SELECT TO authenticated USING (org_id = public.current_org() AND public.is_org_member(org_id));
CREATE FUNCTION public.email_verification_contact_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_email text;
BEGIN
 old_email := lower(btrim(OLD.email));
 IF old_email IS NULL OR old_email = '' THEN RETURN NULL; END IF;
 DELETE FROM public.email_verifications v WHERE v.org_id = OLD.org_id AND v.email = old_email
 AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.org_id = OLD.org_id AND lower(btrim(p.email)) = old_email)
 AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.org_id = OLD.org_id AND lower(btrim(l.email)) = old_email)
 AND NOT EXISTS (SELECT 1 FROM public.stakeholders s WHERE s.org_id = OLD.org_id AND lower(btrim(s.email)) = old_email);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.email_verification_contact_cleanup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER people_verification_cleanup AFTER DELETE OR UPDATE OF email, org_id ON public.people FOR EACH ROW EXECUTE FUNCTION public.email_verification_contact_cleanup();
CREATE TRIGGER leads_verification_cleanup AFTER DELETE OR UPDATE OF email, org_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.email_verification_contact_cleanup();
CREATE TRIGGER stakeholders_verification_cleanup AFTER DELETE OR UPDATE OF email, org_id ON public.stakeholders FOR EACH ROW EXECUTE FUNCTION public.email_verification_contact_cleanup();