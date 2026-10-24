ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.lead_settings ADD COLUMN IF NOT EXISTS auto_enrich boolean NOT NULL DEFAULT true;

-- A person editing a field Nokko filled (same update does not touch field_sources) drops its automatic mark.
CREATE OR REPLACE FUNCTION public.accounts_clear_field_sources()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE f text;
BEGIN
  IF NEW.field_sources IS DISTINCT FROM OLD.field_sources THEN RETURN NEW; END IF;
  FOREACH f IN ARRAY ARRAY['industry','size','country','notes','linkedin_url'] LOOP
    IF (to_jsonb(NEW) -> f) IS DISTINCT FROM (to_jsonb(OLD) -> f) THEN
      NEW.field_sources := NEW.field_sources - f;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS accounts_clear_field_sources ON public.accounts;
CREATE TRIGGER accounts_clear_field_sources BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.accounts_clear_field_sources();