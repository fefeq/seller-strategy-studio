// Moving a deal or a lead between stages without dragging (SDD-20261031-ux-move-without-drag): which stages the menu
// offers, which moves can be undone, what «Deshacer» restores, and how the keyboard walks between columns. Pure and tested.
import { DISQUALIFIED, LEAD_STAGES, OPEN_LEAD_STAGES } from "@/lib/lead-funnel";
import { sortStages, type Stage } from "@/lib/stages";

export type Entity = "deal" | "lead";
export type MoveOption = { key: string; label: string; current: boolean };

/** How long «Deshacer» stays available, like the Sugerencias deck. */
export const UNDO_MS = 5000;

export const MOVE_COPY = {
  menu: "Mover a…",
  moved: (label: string) => `Movido a ${label}`,
  undo: "Deshacer",
  undone: (label: string) => `Vuelve a ${label}`,
  changedMeanwhile: "Ya cambió de etapa: no se ha podido deshacer.",
  noUndoWon: "Mover a Ganado requiere aprobación: sigue la solicitud en Aprobaciones.",
  leadIsOpportunity: "Este lead ya es una oportunidad: síguelo desde Pipeline.",
} as const;

/** Every stage of the company, in order, for a deal's «Mover a…». */
export function dealMoveOptions(
  stages: Stage[] | null | undefined,
  currentKey: string,
): MoveOption[] {
  return sortStages(stages).map((s) => ({
    key: s.key,
    label: s.label,
    current: s.key === currentKey,
  }));
}

/** Every lead stage (earlier ones and «Descartado» included) for a lead's «Mover a…». */
export function leadMoveOptions(currentKey: string): MoveOption[] {
  return [...LEAD_STAGES, DISQUALIFIED].map((s) => ({
    key: s.id,
    label: s.label,
    current: s.id === currentKey,
  }));
}

/** A lead that already is an opportunity is followed from Pipeline: it cannot be moved from the lead board. */
export const canMoveLead = (stageKey: string) => stageKey !== "opportunity";

/**
 * A move can be undone when both ends are open stages: nothing else happens besides the stage (and probability).
 * Moves from or to Ganado (an approval request), Perdido (a closing is recorded), Oportunidad (a deal is created)
 * or Descartado (a final state) are not reversible.
 */
export function isReversibleMove(
  a:
    | { entity: "deal"; from: string; to: string; stages: Stage[] | null | undefined }
    | { entity: "lead"; from: string; to: string },
): boolean {
  if (a.from === a.to) return false;
  if (a.entity === "lead")
    return (
      (OPEN_LEAD_STAGES as readonly string[]).includes(a.from) &&
      (OPEN_LEAD_STAGES as readonly string[]).includes(a.to)
    );
  const kind = (k: string) => sortStages(a.stages).find((s) => s.key === k)?.kind;
  return kind(a.from) === "open" && kind(a.to) === "open";
}

/** What «Deshacer» writes for a deal, and the condition that keeps it from overwriting someone else's change. */
export const undoDeal = (a: {
  prevStage: string;
  prevProbability: number | null;
  movedTo: string;
}) => ({
  patch: { stage: a.prevStage, probability: a.prevProbability },
  onlyIfStage: a.movedTo,
});

/** The same for a lead: only the stage comes back. */
export const undoLead = (a: { prevStage: string; movedTo: string }) => ({
  patch: { stage: a.prevStage },
  onlyIfStage: a.movedTo,
});

// ——— keyboard: Space lifts, ← → change stage, Space drops, Esc cancels (see board-dnd.tsx) ———
export type ColumnRect = { id: string; left: number; width: number };

/** The column next to the current one in the given direction, or the same one at the ends. */
export function adjacentColumn(columns: ColumnRect[], currentId: string, dir: -1 | 1): string {
  const sorted = [...columns].sort((x, y) => x.left - y.left);
  const i = sorted.findIndex((c) => c.id === currentId);
  if (i < 0) return sorted[0]?.id ?? currentId;
  return sorted[Math.min(sorted.length - 1, Math.max(0, i + dir))]!.id;
}

/** The column whose center is closest to a horizontal point (where the lifted card is now). */
export function columnAt(columns: ColumnRect[], centerX: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const c of columns) {
    const d = Math.abs(c.left + c.width / 2 - centerX);
    if (!best || d < best.d) best = { id: c.id, d };
  }
  return best?.id ?? null;
}

/** Spanish messages for screen readers (SDD CA-12): lifting says where it is, moving and dropping say where it goes. */
export function boardAnnouncements(
  cardLabel: (id: string) => string,
  columnLabel: (id: string) => string,
) {
  return {
    onDragStart: ({
      active,
    }: {
      active: { id: string | number; data: { current?: { column?: string } } };
    }) =>
      `Has levantado «${cardLabel(String(active.id))}», que está en ${columnLabel(active.data.current?.column ?? "")}. Usa las flechas izquierda y derecha para cambiar de etapa, Espacio para soltar y Escape para cancelar.`,
    // Over its own stage (right after lifting) says nothing, so the lifting message with the instructions is not overwritten.
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number; data: { current?: { column?: string } } };
      over: { id: string | number } | null;
    }) =>
      over
        ? String(over.id) === active.data.current?.column
          ? undefined
          : `«${cardLabel(String(active.id))}» está sobre ${columnLabel(String(over.id))}.`
        : `«${cardLabel(String(active.id))}» no está sobre ninguna etapa.`,
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number; data: { current?: { column?: string } } };
      over: { id: string | number } | null;
    }) =>
      over && String(over.id) !== active.data.current?.column
        ? `Has soltado «${cardLabel(String(active.id))}» en ${columnLabel(String(over.id))}.`
        : `Has soltado «${cardLabel(String(active.id))}» en su misma etapa: no cambia nada.`,
    onDragCancel: ({ active }: { active: { id: string | number } }) =>
      `Cancelado: «${cardLabel(String(active.id))}» vuelve a su sitio.`,
  };
}

export const BOARD_INSTRUCTIONS =
  "Para mover la tarjeta pulsa Espacio, cambia de etapa con las flechas izquierda y derecha, suelta con Espacio o cancela con Escape. También puedes usar el menú «Mover a…».";
