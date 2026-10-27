-- VERIFIED LOCALLY 2026-10-27 on in-process Postgres (PGlite) applying 0058, 0060, 0061, 0063, 0064 and this one in that order:
-- src/lib/migrations.pg.test.ts. NOT applied to any real database. Depends on 0060, 0063 and 0064.
-- Found by the independent audit: 0064 moves last_human_edit_at on every update by a person, including one that only confirms a field
-- (an UPDATE that touches only field_sources). log_field_edit (0060) then logged it as an edit, and undo_field_edit (0063) refused to undo
-- the earlier edit of another field with «Ese elemento cambió después», because the row no longer equalled the log's «after».
-- last_human_edit_at is bookkeeping like updated_at and updated_by, so it leaves both functions' comparisons the same way, and the undo
-- no longer writes it. Chosen over «do not stamp when only field_sources changes» because confirming a field is still activity of a person
-- for the nudge (CA-6), and because the undo comparison stays right for any other metadata column added later.
-- Replaces log_field_edit and undo_field_edit; privileges and triggers are kept (CREATE OR REPLACE). Bodies are 0060 and 0063 with
-- 'last_human_edit_at' added to the ignored columns, and search_path = public, pg_temp.
-- Checks (all pass in the test):
--   1. editing a field and then confirming another writes one log row, not two;
--   2. the edit can still be undone after the confirmation, and the confirmation is kept;
--   3. last_human_edit_at still moves on the confirmation (it counts as activity);
--   4. a real edit of another field after the first still blocks the undo of the first.

CREATE OR REPLACE FUNCTION public.log_field_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
  IF (to_jsonb(NEW) - 'updated_at' - 'updated_by' - 'field_sources' - 'last_human_edit_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'updated_by' - 'field_sources' - 'last_human_edit_at') THEN
    INSERT INTO public.field_edit_log (org_id, table_name, row_id, op, before, after)
    VALUES (NEW.org_id, TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.undo_field_edit(_log uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  l public.field_edit_log;
  cur jsonb;
  setlist text;
  changed text[];
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
    IF (cur - 'updated_at' - 'updated_by' - 'field_sources' - 'last_human_edit_at') IS DISTINCT FROM (l.after - 'updated_at' - 'updated_by' - 'field_sources' - 'last_human_edit_at') THEN
      RAISE EXCEPTION 'Ese elemento cambió después: deshacer ahora perdería lo último que se escribió';
    END IF;
    -- the fields this edit changed
    SELECT coalesce(array_agg(k), ARRAY[]::text[]) INTO changed
    FROM jsonb_object_keys(l.after) k
    WHERE k NOT IN ('updated_at', 'updated_by', 'field_sources', 'last_human_edit_at') AND (l.before -> k) IS DISTINCT FROM (l.after -> k);
    SELECT string_agg(format('%I = r.%I', column_name, column_name), ', ') INTO setlist
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = l.table_name AND column_name NOT IN ('id', 'org_id', 'created_at', 'created_by', 'field_sources', 'last_human_edit_at');
    EXECUTE format('UPDATE public.%I t SET %s FROM (SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)) r WHERE t.id = $2', l.table_name, setlist, l.table_name)
      USING l.before, l.row_id;
    -- marks: keep the other fields', give the reverted fields back the mark they had (or none)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = l.table_name AND column_name = 'field_sources') THEN
      EXECUTE format(
        'UPDATE public.%I t SET field_sources = (t.field_sources - $1) || coalesce((SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(coalesce($2 -> ''field_sources'', ''{}''::jsonb)) e WHERE e.key = ANY($1)), ''{}''::jsonb) WHERE t.id = $3',
        l.table_name) USING changed, l.before, l.row_id;
    END IF;
  END IF;
  UPDATE public.field_edit_log SET undone_at = now(), undone_by = auth.uid() WHERE id = _log;
END $$;
