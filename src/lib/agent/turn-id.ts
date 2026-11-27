// turn_id (migration 0109) on inserts that must keep working while that migration is not applied
// (SDD-20261121-agent-turn-metrics, NK-0191, CA-7 and CA-9). Proposing an action and saving the tool trace matter more
// than linking them to their turn: when the column is not there yet, the insert is repeated once without it.
// Pure: the caller builds the insert.

/** PostgREST (column not in its schema cache) and Postgres (undefined_column). Read from the code, never the text. */
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

export function missingColumn(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" && MISSING_COLUMN.has(code);
}

/** Runs an insert that carries turn_id (`run(true)`); if it fails because a column does not exist, repeats it once
 *  without turn_id (`run(false)`). Any other error, and a second failure, come back as they are. */
export async function withTurnId<R extends { error: unknown }>(
  run: (withTurn: boolean) => PromiseLike<R>,
): Promise<R> {
  const first = await run(true);
  return first.error && missingColumn(first.error) ? await run(false) : first;
}
