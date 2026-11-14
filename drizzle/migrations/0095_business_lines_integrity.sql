CREATE TABLE public.business_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
 model text NOT NULL CHECK (model IN ('b2b','b2c','marketplace')),
 acv numeric NOT NULL CHECK (acv > 0 AND acv NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
 friction text NOT NULL CHECK (friction IN ('self_serve','committee')),
 stage text NOT NULL CHECK (stage IN ('idea','early','scale')),
 name text CHECK (char_length(name) <= 200),
 is_primary boolean NOT NULL DEFAULT false,
 position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
 origin text NOT NULL DEFAULT 'user' CHECK (origin IN ('user','migrated')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,org_id)
);
REVOKE ALL ON public.business_lines FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.business_lines TO authenticated;
GRANT ALL ON public.business_lines TO service_role;
ALTER TABLE public.business_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_lines_read ON public.business_lines FOR SELECT TO authenticated USING (org_id=public.current_org() AND public.is_org_member(org_id));
CREATE POLICY business_lines_insert ON public.business_lines FOR INSERT TO authenticated WITH CHECK (org_id=public.current_org() AND (public.has_org_role(org_id,'owner') OR public.has_org_role(org_id,'sales_leader')));
CREATE POLICY business_lines_update ON public.business_lines FOR UPDATE TO authenticated USING (org_id=public.current_org() AND (public.has_org_role(org_id,'owner') OR public.has_org_role(org_id,'sales_leader'))) WITH CHECK (org_id=public.current_org() AND (public.has_org_role(org_id,'owner') OR public.has_org_role(org_id,'sales_leader')));
CREATE POLICY business_lines_delete ON public.business_lines FOR DELETE TO authenticated USING (org_id=public.current_org() AND public.has_org_role(org_id,'owner'));
CREATE UNIQUE INDEX business_lines_one_primary ON public.business_lines(org_id) WHERE is_primary;
CREATE INDEX business_lines_org_idx ON public.business_lines(org_id,position);
CREATE FUNCTION public.guard_business_line() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid; n integer;
BEGIN
 target := CASE WHEN TG_OP='DELETE' THEN OLD.org_id ELSE NEW.org_id END;
 IF TG_OP='UPDATE' AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
  RAISE EXCEPTION 'No puedes mover una línea a otra empresa' USING ERRCODE='23514';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(target::text,167));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='INSERT' THEN
  SELECT count(*) INTO n FROM public.business_lines WHERE org_id=target;
  IF n >= 4 THEN RAISE EXCEPTION 'Puedes guardar hasta cuatro líneas' USING ERRCODE='23514'; END IF;
  IF n=0 THEN NEW.is_primary:=true; END IF;
  IF auth.uid() IS NOT NULL AND NEW.origin <> 'user' THEN
   RAISE EXCEPTION 'El origen de copia no se puede asignar manualmente' USING ERRCODE='42501';
  END IF;
 ELSE
  IF auth.uid() IS NOT NULL THEN NEW.origin:='user'; END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_business_line() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER business_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON public.business_lines FOR EACH ROW EXECUTE FUNCTION public.guard_business_line();
CREATE FUNCTION public.check_business_line_primary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid; total integer; principals integer;
BEGIN
 target:=CASE WHEN TG_OP='DELETE' THEN OLD.org_id ELSE NEW.org_id END;
 SELECT count(*),count(*) FILTER(WHERE is_primary) INTO total,principals FROM public.business_lines WHERE org_id=target;
 IF total>0 AND principals<>1 THEN RAISE EXCEPTION 'Selecciona una línea principal' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.check_business_line_primary() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER business_lines_primary AFTER INSERT OR UPDATE OR DELETE ON public.business_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_business_line_primary();
CREATE FUNCTION public.set_primary_business_line(_line uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE company uuid:=public.current_org(); changed integer;
BEGIN
 IF company IS NULL OR NOT (public.has_org_role(company,'owner') OR public.has_org_role(company,'sales_leader')) THEN
  RAISE EXCEPTION 'Solo Owner y Sales Leader pueden cambiar la principal' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(company::text,167));
 IF NOT EXISTS(SELECT 1 FROM public.business_lines WHERE id=_line AND org_id=company) THEN
  RAISE EXCEPTION 'No se encuentra esta línea en tu empresa' USING ERRCODE='P0002';
 END IF;
 UPDATE public.business_lines SET is_primary=false WHERE org_id=company AND is_primary AND id<>_line;
 UPDATE public.business_lines SET is_primary=true WHERE id=_line AND org_id=company;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'No se pudo cambiar la principal. Recarga e inténtalo de nuevo'; END IF;
 RETURN _line;
END $$;
REVOKE ALL ON FUNCTION public.set_primary_business_line(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_primary_business_line(uuid) TO authenticated,service_role;
CREATE FUNCTION public.remove_business_line(_line uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE company uuid:=public.current_org(); principal boolean; successor uuid; changed integer;
BEGIN
 IF company IS NULL OR NOT public.has_org_role(company,'owner') THEN
  RAISE EXCEPTION 'Solo el Owner puede quitar líneas' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(company::text,167));
 SELECT is_primary INTO principal FROM public.business_lines WHERE org_id=company AND id=_line;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se encuentra esta línea en tu empresa' USING ERRCODE='P0002'; END IF;
 SELECT id INTO successor FROM public.business_lines WHERE org_id=company AND id<>_line ORDER BY position,created_at,id LIMIT 1;
 IF successor IS NULL THEN RAISE EXCEPTION 'No puedes quitar la última línea' USING ERRCODE='23514'; END IF;
 DELETE FROM public.business_lines WHERE org_id=company AND id=_line;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'No se pudo quitar la línea. Recarga e inténtalo de nuevo'; END IF;
 IF principal THEN PERFORM public.set_primary_business_line(successor); END IF;
 RETURN _line;
END $$;
REVOKE ALL ON FUNCTION public.remove_business_line(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_business_line(uuid) TO authenticated,service_role;
ALTER TABLE public.segments ADD COLUMN business_line_id uuid;
ALTER TABLE public.segments ADD CONSTRAINT segments_business_line_org_required CHECK (business_line_id IS NULL OR org_id IS NOT NULL);
ALTER TABLE public.segments ADD CONSTRAINT segments_business_line_same_org FOREIGN KEY(business_line_id,org_id) REFERENCES public.business_lines(id,org_id) ON DELETE SET NULL (business_line_id);
CREATE INDEX segments_business_line_idx ON public.segments(business_line_id);
COMMENT ON TABLE public.business_lines IS 'NK-0167: hasta cuatro líneas por empresa, una principal; diagnósticos personales conservados. Copia explícita fuera de DDL.';