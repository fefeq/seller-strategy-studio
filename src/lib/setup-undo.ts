// What a saved batch of the AI setup created, so it can be undone. Only records the batch created
// are undoable (deleting them leaves things as they were); fields it updated in place (positioning,
// an existing segment, the currency) are not, because their previous value was not kept.

export const UNDO_TABLES = [
  "icp_profiles",
  "messaging_pillars",
  "accounts",
  "segments",
  "deals",
] as const;
export type UndoTable = (typeof UNDO_TABLES)[number];
export type UndoRef = { table: UndoTable; id: string };

const CREATES: Record<string, UndoTable> = {
  create_icp: "icp_profiles",
  create_pillar: "messaging_pillars",
  create_account: "accounts",
  create_deal: "deals",
};

/** The record a tool call created, or null when it updated something or returned no id. */
export function undoRefFor(
  tool: string,
  args: Record<string, unknown>,
  result: unknown,
): UndoRef | null {
  const id =
    result && typeof result === "object" && typeof (result as { id?: unknown }).id === "string"
      ? (result as { id: string }).id
      : null;
  if (!id) return null;
  if (tool === "upsert_segment") return args.segment_id ? null : { table: "segments", id };
  const table = CREATES[tool];
  return table ? { table, id } : null;
}

export function isUndoRef(x: unknown): x is UndoRef {
  return (
    !!x &&
    typeof x === "object" &&
    (UNDO_TABLES as readonly string[]).includes((x as UndoRef).table) &&
    typeof (x as UndoRef).id === "string" &&
    /^[0-9a-f-]{36}$/i.test((x as UndoRef).id)
  );
}
