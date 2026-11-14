ALTER TABLE public.custom_plays ADD COLUMN lease_token uuid, ADD COLUMN lease_until timestamptz, ADD COLUMN execution_pause text;
ALTER TABLE public.custom_play_evidence ADD COLUMN run_id uuid, ADD COLUMN step_number integer, ADD COLUMN provider text, ADD COLUMN observed_at timestamptz, ADD COLUMN date_from text;
ALTER TABLE public.custom_play_costs ADD COLUMN run_id uuid, ADD COLUMN step_number integer, ADD COLUMN currency text, ADD COLUMN input_tokens integer, ADD COLUMN output_tokens integer;
CREATE TABLE public.custom_play_runs (
 id uuid PRIMARY KEY, org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
 play_id uuid NOT NULL REFERENCES public.custom_plays(id) ON DELETE CASCADE, user_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'running', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_play_runs TO authenticated;
GRANT ALL ON public.custom_play_runs TO service_role;
ALTER TABLE public.custom_play_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org custom runs read" ON public.custom_play_runs FOR SELECT TO authenticated USING(org_id=public.current_org() AND public.is_org_member(org_id));
CREATE TABLE public.custom_play_steps (
 org_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id) ON DELETE CASCADE,
 run_id uuid NOT NULL REFERENCES public.custom_play_runs(id) ON DELETE CASCADE,
 step_number integer NOT NULL CHECK(step_number>0), status text NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','committed')),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb, evidence_count integer NOT NULL DEFAULT 0, suggestion_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(run_id,step_number)
);
GRANT SELECT ON public.custom_play_steps TO authenticated;
GRANT ALL ON public.custom_play_steps TO service_role;
ALTER TABLE public.custom_play_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org custom steps read" ON public.custom_play_steps FOR SELECT TO authenticated USING(org_id=public.current_org() AND public.is_org_member(org_id));
CREATE FUNCTION public.claim_custom_play(p_org uuid,p_play uuid,p_run uuid,p_user uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE got uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=p_org AND user_id=p_user) OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND archived_at IS NULL) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.custom_play_runs WHERE id=p_run AND (org_id<>p_org OR play_id<>p_play OR user_id<>p_user OR status<>'running')) THEN RETURN false; END IF;
 UPDATE public.custom_plays SET lease_token=p_token,lease_until=now()+interval '15 minutes' WHERE id=p_play AND org_id=p_org AND status='activo' AND execution_pause IS NULL AND (lease_until IS NULL OR lease_until<now()) RETURNING id INTO got;
 IF got IS NULL THEN RETURN false; END IF;
 INSERT INTO public.custom_play_runs(id,org_id,play_id,user_id) VALUES(p_run,p_org,p_play,p_user) ON CONFLICT(id) DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_custom_play(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_custom_play(uuid,uuid,uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.reserve_custom_play_step(p_org uuid,p_play uuid,p_run uuid,p_token uuid,p_step integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE got integer;
BEGIN
 PERFORM 1 FROM public.custom_plays WHERE id=p_play AND org_id=p_org AND lease_token=p_token AND lease_until>now() AND status='activo' AND execution_pause IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.custom_play_runs WHERE id=p_run AND org_id=p_org AND play_id=p_play AND status='running') THEN RETURN false; END IF;
 INSERT INTO public.custom_play_steps(org_id,run_id,step_number) VALUES(p_org,p_run,p_step) ON CONFLICT DO NOTHING RETURNING step_number INTO got;
 RETURN got IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.reserve_custom_play_step(uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_custom_play_step(uuid,uuid,uuid,uuid,integer) TO service_role;
CREATE FUNCTION public.commit_custom_play_step(p_org uuid,p_play uuid,p_run uuid,p_token uuid,p_step integer,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_step public.custom_play_steps; play_key text; x jsonb; ev integer:=0; su integer:=0; added integer;
BEGIN
 SELECT key INTO play_key FROM public.custom_plays WHERE id=p_play AND org_id=p_org AND lease_token=p_token AND lease_until>now() AND status='activo' AND execution_pause IS NULL FOR UPDATE;
 IF play_key IS NULL THEN RAISE EXCEPTION 'La ejecución perdió su reserva. Revisa el play antes de repetir.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.custom_play_runs WHERE id=p_run AND org_id=p_org AND play_id=p_play AND status='running') THEN RAISE EXCEPTION 'Ejecución ajena o terminada'; END IF;
 SELECT * INTO row_step FROM public.custom_play_steps WHERE run_id=p_run AND org_id=p_org AND step_number=p_step FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Paso sin reserva'; END IF;
 IF row_step.status='committed' THEN RETURN jsonb_build_object('step',p_step,'evidenceCount',row_step.evidence_count,'suggestionCount',row_step.suggestion_count); END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'evidence','[]'::jsonb)) LOOP
 INSERT INTO public.custom_play_evidence(org_id,play_id,run_id,step_number,url,quote,event_date,provider,observed_at,date_from) VALUES(p_org,p_play,p_run,p_step,x->>'url',x->>'quote',(x->>'event_date')::date,x->>'provider',now(),x->>'date_from'); ev:=ev+1;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'suggestions','[]'::jsonb)) LOOP
 INSERT INTO public.suggestions(org_id,detector,dedupe_key,title,body,link,priority) VALUES(p_org,'custom_play',x->>'dedupe_key',x->>'title',x->>'body',x->>'link',2) ON CONFLICT(org_id,dedupe_key) DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT; su:=su+added;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'costs','[]'::jsonb)) LOOP
 BEGIN
 INSERT INTO public.custom_play_costs(org_id,play_key,run_id,step_number,provider,amount,cost_kind,currency,input_tokens,output_tokens) VALUES(p_org,play_key,p_run,p_step,x->>'provider',coalesce((x->>'amount')::numeric,0),x->>'cost_kind',x->>'currency',(x->>'input_tokens')::integer,(x->>'output_tokens')::integer);
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'custom_play_cost_registration_failed'; END;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'usage','[]'::jsonb)) LOOP
 BEGIN
 INSERT INTO public.integration_usage(org_id,user_id,service,need,trigger,cost) SELECT p_org,user_id,x->>'service',x->>'need',x->>'trigger',(x->>'cost')::numeric FROM public.custom_play_runs WHERE id=p_run;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'custom_play_usage_registration_failed'; END;
 END LOOP;
 UPDATE public.custom_play_steps SET status='committed',payload=p_payload,evidence_count=ev,suggestion_count=su WHERE run_id=p_run AND step_number=p_step;
 UPDATE public.custom_plays SET lease_until=now()+interval '15 minutes' WHERE id=p_play AND lease_token=p_token;
 RETURN jsonb_build_object('step',p_step,'evidenceCount',ev,'suggestionCount',su);
END $$;
REVOKE ALL ON FUNCTION public.commit_custom_play_step(uuid,uuid,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_custom_play_step(uuid,uuid,uuid,uuid,integer,jsonb) TO service_role;
COMMENT ON TABLE public.custom_play_steps IS 'Private step outputs remain in company-scoped storage, never Inngest history. A reserved step without receipt must not repeat paid calls automatically.';