// Client access to the change log (migration 0060, not applied anywhere yet): the generated types do not know
// field_edit_log or undo_field_edit until it is applied and the types are regenerated, so this is the one place
// with a narrow typed cast. Remove the cast then.
import { supabase } from "@/integrations/supabase/client";
import { UNDO_HOURS, type ChangeEntry } from "@/lib/delete-rules";

type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type LogClient = {
  from(table: "field_edit_log"): {
    select(columns: string): {
      gte(column: string, value: string): { is(column: string, value: null): { order(column: string, o: { ascending: boolean }): Result<ChangeEntry[]> } };
      eq(column: string, value: string): { is(column: string, value: null): { order(column: string, o: { ascending: boolean }): { limit(n: number): Result<ChangeEntry[]> } } };
    };
  };
  rpc(fn: "undo_field_edit", args: { _log: string }): Promise<{ error: { message: string } | null }>;
};
const log = supabase as unknown as LogClient;
const COLUMNS = "id,table_name,row_id,op,before,changed_at,undone_at";

/** Changes of the last 24 hours that have not been undone, newest first. */
export async function recentChanges(now = new Date()): Promise<ChangeEntry[]> {
  const since = new Date(now.getTime() - UNDO_HOURS * 3_600_000).toISOString();
  const { data, error } = await log.from("field_edit_log").select(COLUMNS).gte("changed_at", since).is("undone_at", null).order("changed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The latest change logged for a row (right after deleting it, to offer «Deshacer» in the toast). */
export async function latestChangeFor(rowId: string): Promise<ChangeEntry | null> {
  const { data, error } = await log.from("field_edit_log").select(COLUMNS).eq("row_id", rowId).is("undone_at", null).order("changed_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function undoChange(id: string): Promise<void> {
  const { error } = await log.rpc("undo_field_edit", { _log: id });
  if (error) throw new Error(error.message);
}
