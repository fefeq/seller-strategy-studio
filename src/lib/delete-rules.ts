// Deleting with use, archiving and undo (SDD field-actions-edit-delete-confirm, U-2). Pure and tested.
// Decided by Fede: only the Owner deletes; a segment that is in use is not deleted (deleting it would take its
// targets, budgets and costs with it); archiving an ICP or a pillar is deleting it with an undo for 24 hours,
// recorded in field_edit_log (migration 0060), so no screen has to filter archived rows.
import type { Json } from "@/integrations/supabase/types";
import { canDo, canUndo, type ElementKind } from "@/lib/field-actions";
import { jsonObject } from "@/lib/json";

/** Undo window, decided by Fede. */
export const UNDO_HOURS = 24;

export type UsageLine = { label: string; count: number };
export type DeleteKind = Extract<ElementKind, "segment" | "icp" | "pillar">;

export type DeletePlan = {
  /** The delete button works. */
  allowed: boolean;
  /** Why it does not: the role, or the element is in use. */
  blocked: null | "role" | "in_use";
  /** «Borrar» when nothing depends on it, «Archivar» when something does (same operation, undo for 24 hours). */
  confirmLabel: "Borrar" | "Archivar";
  title: string;
  /** What the person reads before confirming: what is lost and where it is used. */
  lines: string[];
};

const list = (xs: UsageLine[]) => xs.filter((x) => x.count > 0).map((x) => `${x.count} ${x.label}`).join(", ");

/**
 * «Vas a borrar X. Se usa en Y.» For a segment, any use blocks the delete; for an ICP, use means archive;
 * a pillar has no dependencies we can count, so it only says what it feeds.
 */
export function deletePlan(kind: DeleteKind, name: string, usage: { kept: UsageLine[]; gone: UsageLine[] }, roles: readonly string[]): DeletePlan {
  const noun = kind === "segment" ? "el segmento" : kind === "icp" ? "el ICP" : "el pilar de mensaje";
  const role = canDo(kind, "delete", roles);
  if (!role.allowed) return { allowed: false, blocked: "role", confirmLabel: "Borrar", title: `No puedes borrar ${noun} «${name}»`, lines: [role.reason ?? "Solo el Owner puede borrar."] };
  const kept = list(usage.kept);
  const gone = list(usage.gone);
  const undo = `Puedes deshacerlo durante ${UNDO_HOURS} horas.`;
  if (kind === "segment") {
    if (kept || gone) {
      return {
        allowed: false, blocked: "in_use", confirmLabel: "Borrar", title: `No se puede borrar ${noun} «${name}»`,
        lines: [
          `Se usa en: ${[kept, gone].filter(Boolean).join(", ")}.`,
          ...(gone ? [`Borrarlo se llevaría por delante: ${gone}.`] : []),
          "Mientras esté en uso no se borra. Pasa esos datos a otro segmento desde sus pantallas y vuelve a intentarlo.",
        ],
      };
    }
    return { allowed: true, blocked: null, confirmLabel: "Borrar", title: `¿Borrar ${noun} «${name}»?`, lines: ["No hay datos asociados.", undo] };
  }
  if (kind === "icp") {
    const where = list([...usage.kept, ...usage.gone]);
    return where
      ? { allowed: true, blocked: null, confirmLabel: "Archivar", title: `¿Archivar ${noun} «${name}»?`, lines: [`Se usa para puntuar y buscar con: ${where}.`, "Archivar lo retira y esos datos dejan de usarlo.", undo] }
      : { allowed: true, blocked: null, confirmLabel: "Borrar", title: `¿Borrar ${noun} «${name}»?`, lines: ["Ningún segmento con cuentas ni leads lo usa.", undo] };
  }
  return { allowed: true, blocked: null, confirmLabel: "Archivar", title: `¿Archivar ${noun} «${name}»?`, lines: ["Alimenta los mensajes y las plantillas.", "Archivarlo lo retira de ellos.", undo] };
}

// ---- Undo (CA-5) ----

export type ChangeEntry = { id: string; table_name: string; row_id: string; op: "update" | "delete"; before: Record<string, unknown>; changed_at: string; undone_at: string | null };

/** A field_edit_log row as the rules read it (the log stores the row as jsonb). */
export function toChangeEntry(r: { id: string; table_name: string; row_id: string; op: string; before: Json; changed_at: string; undone_at: string | null }): ChangeEntry {
  return { ...r, op: r.op === "delete" ? "delete" : "update", before: jsonObject(r.before) ?? {} };
}

const TABLE_NOUN: Record<string, DeleteKind | "positioning"> = { segments: "segment", icp_profiles: "icp", messaging_pillars: "pillar", positioning: "positioning" };
const NOUN_LABEL: Record<string, string> = { segment: "el segmento", icp: "el ICP", pillar: "el pilar", positioning: "el posicionamiento" };

const nameOf = (before: Record<string, unknown>) => String(before["name"] ?? before["title"] ?? before["product_name"] ?? "").trim();

/** «Borraste el ICP «Agencias»», «Cambiaste el posicionamiento». */
export function changeText(e: Pick<ChangeEntry, "table_name" | "op" | "before">): string {
  const noun = NOUN_LABEL[TABLE_NOUN[e.table_name] ?? ""] ?? "un elemento";
  const name = nameOf(e.before);
  return `${e.op === "delete" ? "Borraste" : "Cambiaste"} ${noun}${name ? ` «${name}»` : ""}`;
}

export type UndoStatus = { possible: boolean; until: Date; text: string };

/** Within the window: until when. After it: that it is no longer possible (§8). An undone change cannot be undone twice. */
export function undoStatus(e: Pick<ChangeEntry, "changed_at" | "undone_at">, now: Date): UndoStatus {
  const until = new Date(new Date(e.changed_at).getTime() + UNDO_HOURS * 3_600_000);
  if (e.undone_at) return { possible: false, until, text: "Ya lo deshiciste." };
  if (now.getTime() > until.getTime()) return { possible: false, until, text: `Ya no es posible deshacerlo: pasaron más de ${UNDO_HOURS} horas.` };
  return { possible: true, until, text: `Puedes deshacerlo hasta el ${until.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}, ${until.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}.` };
}

/** Whether this person can undo it now: in the window, and undoing a delete is the Owner's. */
export function canUndoChange(e: ChangeEntry, roles: readonly string[], now: Date): { allowed: boolean; reason: string | null } {
  const st = undoStatus(e, now);
  if (!st.possible) return { allowed: false, reason: st.text };
  const kind = TABLE_NOUN[e.table_name];
  if (!kind) return { allowed: false, reason: "Este cambio no se puede deshacer desde aquí." };
  const who = canUndo(kind, e.op === "delete" ? "delete" : "edit", roles);
  return { allowed: who.allowed, reason: who.reason };
}
