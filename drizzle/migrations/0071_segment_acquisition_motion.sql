-- SDD-20261027-segment-motion-aarrr-diagnosis, T-1 and T-3.
-- NOT applied to the real database and NOT yet run on a local Postgres: the session that wrote it could not install the
-- dependencies (proxy 403), so src/lib/migrations.pg.test.ts (PGlite) has not run. Run it before applying, then try it on a copy.
-- Numbering: other branches reserve 0059, 0062, 0064-0070; check the journal and renumber on merge if needed.
--
-- segments.motion already exists (sales model by ACV: plg, inside, field, strategic) and feeds the capacity calculator, so it is
-- NOT touched. This adds the acquisition motion as a separate, nullable column: existing segments stay empty («sin definir»),
-- nothing is inferred.
--
-- Rollback: ALTER TABLE public.segments DROP COLUMN acquisition_motion; and restore create_organization_full from 0056.

ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS acquisition_motion text;
ALTER TABLE public.segments DROP CONSTRAINT IF EXISTS segments_acquisition_motion_check;
ALTER TABLE public.segments ADD CONSTRAINT segments_acquisition_motion_check
  CHECK (acquisition_motion IS NULL OR acquisition_motion IN ('plg', 'slg', 'marketing', 'partner'));
COMMENT ON COLUMN public.segments.acquisition_motion IS 'How the segment acquires customers: plg, slg, marketing or partner; null = sin definir. Not the sales model (segments.motion).';

-- Templates: a new company that starts from the low-ticket template gets plg for Self-service and slg for Venta asistida; the ACV
-- template gets slg for Enterprise. Done here, after create_organization, so the live create_organization (applied before the
-- migration history, only its commented copy is in the repo) is not replaced. Only the segments created by this very call are
-- touched (org o is new) and only when still empty.
CREATE OR REPLACE FUNCTION public.create_organization_full(_name text, _segments text DEFAULT 'empty', _website text DEFAULT NULL, _currency text DEFAULT 'EUR')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o uuid;
begin
  if _currency !~ '^[A-Z]{3}$' then raise exception 'Moneda no válida'; end if;
  o := public.create_organization(_name, _segments);
  update public.organizations set currency = _currency, website = nullif(left(trim(coalesce(_website, '')), 300), '') where id = o;
  if _segments in ('template', 'low_ticket') then
    update public.segments set acquisition_motion = case name
      when 'Self-service' then 'plg'
      when 'Venta asistida' then 'slg'
      when 'Enterprise' then 'slg'
    end
    where org_id = o and acquisition_motion is null and name in ('Self-service', 'Venta asistida', 'Enterprise');
  end if;
  return o;
end $$;
REVOKE ALL ON FUNCTION public.create_organization_full(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_full(text, text, text, text) TO authenticated;
