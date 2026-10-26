-- VERIFIED LOCALLY 2026-10-26 on an in-process Postgres (PGlite) with two fictional companies: src/lib/migrations.pg.test.ts runs
-- every check below on a replica of the real catalog (tables, NOT NULLs, defaults, set_audit, positioning_copy_guard, the
-- foreign keys into segments and the policies, read from the real database, schema only). NOT yet applied to the real
-- database: apply it on a copy first, since the replica is not the database itself.
-- Depends on 0058 (public.track_field_sources). Checks, for positioning, messaging_pillars and segments (all pass in the test):
--   1. a signed-in edit of a tracked column stamps field_sources {kind persona, confirmed true, confirmedBy};
--   2. clearing a value removes its mark; a service-role update that does not touch field_sources drops it;
--   3. an update that also sends field_sources (confirming a field) is kept exactly as sent;
--   4. existing rows get field_sources = '{}' (every value stays «sin dato», none is read as a person's);
--   5. the existing policies and the audit trigger still work (nothing here changes them);
--   6. numbering: other branches also add migrations; renumber on merge if needed (not a SQL check).
-- It changes no existing data: three new columns with a default, and three triggers.

ALTER TABLE public.positioning ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.messaging_pillars ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.positioning.field_sources IS 'Origin and confirmation per field: {field:{source,kind,confirmed,confirmedBy,confirmedAt,at}}; a value with no mark is unknown.';
COMMENT ON COLUMN public.messaging_pillars.field_sources IS 'Origin and confirmation per field; see positioning.field_sources.';
COMMENT ON COLUMN public.segments.field_sources IS 'Origin and confirmation per field; see positioning.field_sources.';

DROP TRIGGER IF EXISTS positioning_track_field_sources ON public.positioning;
CREATE TRIGGER positioning_track_field_sources BEFORE UPDATE ON public.positioning
FOR EACH ROW EXECUTE FUNCTION public.track_field_sources(
  'best_customers', 'alternatives', 'differentiation', 'value', 'trend', 'target_customer', 'need', 'product_name',
  'category', 'key_benefit', 'competitive_alternative', 'differentiator', 'tagline', 'one_liner', 'short_pitch', 'elevator_pitch');

DROP TRIGGER IF EXISTS messaging_pillars_track_field_sources ON public.messaging_pillars;
CREATE TRIGGER messaging_pillars_track_field_sources BEFORE UPDATE ON public.messaging_pillars
FOR EACH ROW EXECUTE FUNCTION public.track_field_sources('title', 'pain', 'message', 'proof');

DROP TRIGGER IF EXISTS segments_track_field_sources ON public.segments;
CREATE TRIGGER segments_track_field_sources BEFORE UPDATE ON public.segments
FOR EACH ROW EXECUTE FUNCTION public.track_field_sources(
  'name', 'motion', 'acv_min', 'acv_max', 'win_rate_target', 'ae_quota', 'cac_target', 'cycle_days',
  'gross_margin_pct', 'payback_months', 'sdr_per_ae', 'ae_per_se', 'notes');
