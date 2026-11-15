ALTER TABLE public.lead_settings ADD COLUMN IF NOT EXISTS autopilot_action_threshold numeric NOT NULL DEFAULT 0 CHECK (autopilot_action_threshold >= 0 AND autopilot_action_threshold <> 'NaN'::numeric);
CREATE OR REPLACE FUNCTION public.guard_autopilot_threshold() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.autopilot_action_threshold <> 0) OR (TG_OP = 'UPDATE' AND (NEW.autopilot_action_threshold IS DISTINCT FROM OLD.autopilot_action_threshold OR NEW.org_id IS DISTINCT FROM OLD.org_id)) THEN
    IF auth.uid() IS NULL OR NEW.org_id <> public.current_org() OR NOT (public.has_org_role(NEW.org_id,'owner') OR public.has_org_role(NEW.org_id,'sales_leader')) THEN
      RAISE EXCEPTION 'Solo Owner y Sales Leader pueden cambiar el umbral del piloto';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lead_settings_autopilot_threshold_guard BEFORE INSERT OR UPDATE ON public.lead_settings FOR EACH ROW EXECUTE FUNCTION public.guard_autopilot_threshold();
CREATE UNIQUE INDEX agent_pending_autopilot_operation_uidx ON public.agent_pending_actions(org_id,(args->>'autopilot_key')) WHERE source='autopilot' AND args ? 'autopilot_key';
COMMENT ON COLUMN public.lead_settings.autopilot_action_threshold IS 'Per-action AI threshold in organization currency; zero always requires confirmation. Unknown or noncomparable currency costs require confirmation.';