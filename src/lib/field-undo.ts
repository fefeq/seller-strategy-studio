// Client access to the change log (migration 0060): changes of the last 24 hours and undoing one.
import { supabase } from "@/integrations/supabase/client";
import { toChangeEntry, UNDO_HOURS, type ChangeEntry } from "@/lib/delete-rules";

const COLUMNS = "id,table_name,row_id,op,before,changed_at,undone_at";

/** Changes of the last 24 hours that have not been undone, newest first. */
export async function recentChanges(now = new Date()): Promise<ChangeEntry[]> {
  const since = new Date(now.getTime() - UNDO_HOURS * 3_600_000).toISOString();
  const { data, error } = await supabase.from("field_edit_log").select(COLUMNS).gte("changed_at", since).is("undone_at", null).order("changed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toChangeEntry);
}

/** The latest change logged for a row (right after deleting it, to offer «Deshacer» in the toast). */
export async function latestChangeFor(rowId: string): Promise<ChangeEntry | null> {
  const { data, error } = await supabase.from("field_edit_log").select(COLUMNS).eq("row_id", rowId).is("undone_at", null).order("changed_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ? toChangeEntry(data[0]) : null;
}

export async function undoChange(id: string): Promise<void> {
  const { error } = await supabase.rpc("undo_field_edit", { _log: id });
  if (error) throw new Error(error.message);
}
