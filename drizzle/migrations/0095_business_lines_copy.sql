CREATE OR REPLACE FUNCTION public.guard_business_line() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  IF auth.uid() IS NOT NULL OR current_setting('nokko.business_lines_copy',true) IS DISTINCT FROM 'authorized' THEN NEW.origin:='user'; END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.copy_business_lines() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE company uuid; candidate record; existing record; n integer; made integer:=0; refreshed integer:=0;
BEGIN
 IF current_user NOT IN ('service_role','postgres') OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'La copia requiere autorización administrativa' USING ERRCODE='42501';
 END IF;
 FOR company IN SELECT id FROM public.organizations ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(company::text,167));
  SELECT count(*) INTO n FROM public.business_lines WHERE org_id=company;
  IF n>0 AND EXISTS(SELECT 1 FROM public.business_lines WHERE org_id=company AND origin='user') THEN CONTINUE; END IF;
  SELECT s.diagnosis->'input' AS input INTO candidate
  FROM public.onboarding_sessions s JOIN public.organizations o ON o.id=s.org_id
  WHERE s.org_id=company
   AND (NOT EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id=s.user_id) OR s.user_id=o.created_by)
   AND jsonb_typeof(s.diagnosis->'result'->'archetype')='string'
   AND length(s.diagnosis->'result'->>'archetype')>0
   AND jsonb_typeof(s.diagnosis->'input')='object'
   AND s.diagnosis->'input'->>'model' IN ('b2b','b2c','marketplace')
   AND s.diagnosis->'input'->>'friction' IN ('self_serve','committee')
   AND s.diagnosis->'input'->>'stage' IN ('idea','early','scale')
   AND CASE WHEN jsonb_typeof(s.diagnosis->'input'->'acv')='number' THEN (s.diagnosis->'input'->>'acv')::numeric>0 ELSE false END
  ORDER BY EXISTS(SELECT 1 FROM public.org_members m WHERE m.org_id=company AND m.user_id=s.user_id AND m.role='owner') DESC,
   s.updated_at DESC NULLS LAST,s.id ASC LIMIT 1;
  IF NOT FOUND THEN CONTINUE; END IF;
  IF n=0 THEN
   INSERT INTO public.business_lines(org_id,model,acv,friction,stage,is_primary,origin,position)
    VALUES(company,candidate.input->>'model',(candidate.input->>'acv')::numeric,candidate.input->>'friction',candidate.input->>'stage',true,'migrated',0);
   made:=made+1;
  ELSIF n=1 THEN
   SELECT * INTO existing FROM public.business_lines WHERE org_id=company AND origin='migrated';
   IF FOUND AND ROW(existing.model,existing.acv,existing.friction,existing.stage) IS DISTINCT FROM
    ROW(candidate.input->>'model',(candidate.input->>'acv')::numeric,candidate.input->>'friction',candidate.input->>'stage') THEN
    PERFORM set_config('nokko.business_lines_copy','authorized',true);
    UPDATE public.business_lines SET model=candidate.input->>'model',acv=(candidate.input->>'acv')::numeric,
     friction=candidate.input->>'friction',stage=candidate.input->>'stage' WHERE id=existing.id AND origin='migrated';
    PERFORM set_config('nokko.business_lines_copy','',true);
    refreshed:=refreshed+1;
   END IF;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('created',made,'refreshed',refreshed);
END $$;
REVOKE ALL ON FUNCTION public.copy_business_lines() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.copy_business_lines() TO service_role;
COMMENT ON FUNCTION public.copy_business_lines() IS 'NK-0167: administrative authorized copy only; idempotent; preserves personal diagnoses and user edits; count-only output.';