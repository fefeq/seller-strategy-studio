-- Found testing 0060 in the live app: undoing an edit restored the whole row, field_sources included, so a confirmation
-- made on ANOTHER field after the edit was lost with it. An edit now gives back only what it changed: the reverted fields
-- get the mark they had before (or none), and every other mark stays. Deleting is unchanged (the whole row comes back).
-- Replaces undo_field_edit from 0060; privileges are kept (CREATE OR REPLACE). Verified locally in migrations.pg.test.ts.

CREATE OR REPLACE FUNCTION public.undo_field_edit(_log uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    IF (cur - 'updated_at' - 'updated_by' - 'field_sources') IS DISTINCT FROM (l.after - 'updated_at' - 'updated_by' - 'field_sources') THEN
      RAISE EXCEPTION 'Ese elemento cambió después: deshacer ahora perdería lo último que se escribió';
    END IF;
    -- the fields this edit changed
    SELECT coalesce(array_agg(k), ARRAY[]::text[]) INTO changed
    FROM jsonb_object_keys(l.after) k
    WHERE k NOT IN ('updated_at', 'updated_by', 'field_sources') AND (l.before -> k) IS DISTINCT FROM (l.after -> k);
    SELECT string_agg(format('%I = r.%I', column_name, column_name), ', ') INTO setlist
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = l.table_name AND column_name NOT IN ('id', 'org_id', 'created_at', 'created_by', 'field_sources');
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
