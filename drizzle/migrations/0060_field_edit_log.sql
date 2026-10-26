-- VERIFIED LOCALLY 2026-10-26 on an in-process Postgres (PGlite) with two fictional companies: src/lib/migrations.pg.test.ts runs
-- every check below. NOT yet applied to the real database: the test models the touched tables from the generated types
-- (no other NOT NULL, defaults or triggers the real tables may have), so apply it first on a test copy of the database.
-- Checks (all pass in the test):
--   1. editing or deleting a segment, ICP, pillar or the positioning row writes one field_edit_log row with the
--      company, the table, the row id, the op, the row before and (for an update) after, who and when;
--   2. an update that only changes updated_at, updated_by or field_sources writes nothing;
--   3. a member of company A cannot read company B's log, and nobody can insert, update or delete log rows directly;
--   4. undo_field_edit restores an edit while the row still equals the log's «after», and refuses when it changed since;
--   5. only the Owner can undo a delete, and the delete is restored with its original id;
--   6. after 24 hours, or a second time, undo_field_edit refuses with its message;
--   7. an undo writes no new log row (app.undoing), and deleting a whole company (cascade) writes none and does not fail;
--   8. the numbering: another branch (connections) also adds a 0059 and a journal entry; renumber on merge if needed.
-- It changes no existing data: one new table, two functions and four triggers.

CREATE TABLE IF NOT EXISTS public.field_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  table_name text NOT NULL CHECK (table_name IN ('segments', 'icp_profiles', 'positioning', 'messaging_pillars')),
  row_id uuid NOT NULL,
  op text NOT NULL CHECK (op IN ('update', 'delete')),
  before jsonb NOT NULL,
  after jsonb,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid
);
CREATE INDEX IF NOT EXISTS field_edit_log_org_at ON public.field_edit_log (org_id, changed_at DESC);
COMMENT ON TABLE public.field_edit_log IS 'Edits and deletes of strategy rows, kept to undo them for 24 hours. Written only by log_field_edit; undone only by undo_field_edit.';

ALTER TABLE public.field_edit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.field_edit_log TO authenticated;
GRANT ALL ON public.field_edit_log TO service_role;
DROP POLICY IF EXISTS "org read" ON public.field_edit_log;
CREATE POLICY "org read" ON public.field_edit_log FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND public.is_org_member(org_id));

-- Writes the log. Security definer so members need no insert right on the log. An update that only moves
-- updated_at, updated_by or field_sources is not a change a person would undo. app.undoing silences the undo itself.
CREATE OR REPLACE FUNCTION public.log_field_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.undoing', true) = '1' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- Deleting a whole company cascades here after the company row is gone: nothing to log for it.
    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.org_id) THEN
      INSERT INTO public.field_edit_log (org_id, table_name, row_id, op, before)
      VALUES (OLD.org_id, TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD));
    END IF;
    RETURN OLD;
  END IF;
  IF (to_jsonb(NEW) - 'updated_at' - 'updated_by' - 'field_sources') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'updated_by' - 'field_sources') THEN
    INSERT INTO public.field_edit_log (org_id, table_name, row_id, op, before, after)
    VALUES (NEW.org_id, TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['segments', 'icp_profiles', 'positioning', 'messaging_pillars'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_log_edit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_field_edit()', t || '_log_edit', t);
  END LOOP;
END $$;

-- Undoes one logged change within 24 hours. An edit is restored only if the row still equals what the edit left;
-- a delete is restored with its original id, by the Owner only (as deleting is).
CREATE OR REPLACE FUNCTION public.undo_field_edit(_log uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.field_edit_log;
  cur jsonb;
  setlist text;
BEGIN
  SELECT * INTO l FROM public.field_edit_log WHERE id = _log FOR UPDATE;
  IF NOT FOUND OR NOT public.is_org_member(l.org_id) THEN RAISE EXCEPTION 'No encuentro ese cambio'; END IF;
  IF l.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Ya lo deshiciste'; END IF;
  IF l.changed_at < now() - interval '24 hours' THEN RAISE EXCEPTION 'Ya no es posible deshacerlo: pasaron más de 24 horas'; END IF;
  PERFORM set_config('app.undoing', '1', true);
  IF l.op = 'delete' THEN
    IF NOT public.has_org_role(l.org_id, 'owner') THEN RAISE EXCEPTION 'Solo el Owner puede deshacer un borrado'; END IF;
    EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', l.table_name, l.table_name) USING l.before;
  ELSE
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1', l.table_name) INTO cur USING l.row_id;
    IF cur IS NULL THEN RAISE EXCEPTION 'Ese elemento ya no existe'; END IF;
    IF (cur - 'updated_at' - 'updated_by' - 'field_sources') IS DISTINCT FROM (l.after - 'updated_at' - 'updated_by' - 'field_sources') THEN
      RAISE EXCEPTION 'Ese elemento cambió después: deshacer ahora perdería lo último que se escribió';
    END IF;
    SELECT string_agg(format('%I = r.%I', column_name, column_name), ', ') INTO setlist
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = l.table_name AND column_name NOT IN ('id', 'org_id', 'created_at', 'created_by');
    EXECUTE format('UPDATE public.%I t SET %s FROM (SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)) r WHERE t.id = $2', l.table_name, setlist, l.table_name)
      USING l.before, l.row_id;
  END IF;
  UPDATE public.field_edit_log SET undone_at = now(), undone_by = auth.uid() WHERE id = _log;
END $$;
REVOKE ALL ON FUNCTION public.undo_field_edit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.undo_field_edit(uuid) TO authenticated;
