import { Button } from "@/components/ui/button";
import { FieldActions } from "@/components/field-actions";
import { confirmedText, confirmSummary } from "@/lib/field-actions";
import { readSources, sourceText } from "@/lib/provenance";

/**
 * The origin line of a value with «Confirmar» beside it (CA-8). Shows nothing for an empty value or when the row
 * has no provenance column yet (`enabled` false), so a screen never offers what it cannot save.
 */
export function ConfirmMark({ field, value, marks, roles, userId, enabled = true, onConfirm }: {
  field: string; value: string | null | undefined; marks: unknown; roles: readonly string[]; userId: string | undefined;
  enabled?: boolean; onConfirm: (fields: string[]) => void;
}) {
  if (!enabled || !value?.trim()) return null;
  const m = readSources(marks)[field];
  const who = confirmedText(m, m?.confirmedBy && m.confirmedBy === userId ? "ti" : null);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3">
      <p className="font-mono text-xs text-muted-foreground" title={[m?.quote ? `«${m.quote}»` : "", who ?? ""].filter(Boolean).join(" · ") || undefined}>{sourceText(m) ?? "Sin origen"}</p>
      <FieldActions kind="company_field" roles={roles} confirmed={!!m?.confirmed} handlers={{ confirm: () => onConfirm([field]) }} />
    </div>
  );
}

/** «Confirmado» or «2 de 5 confirmados» with a button that confirms the pending ones at once (CA-9, CA-10). */
export function ConfirmBar({ fields, marks, enabled = true, onConfirm }: { fields: string[]; marks: unknown; enabled?: boolean; onConfirm: (fields: string[]) => void }) {
  const summary = confirmSummary(fields, marks);
  if (!enabled || summary.total === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{summary.allConfirmed ? "Confirmado" : `${summary.confirmed} de ${summary.total} confirmados`}</span>
      {!summary.allConfirmed && <Button size="sm" variant="ghost" onClick={() => onConfirm(summary.pending)}>Confirmar los {summary.pending.length} pendientes</Button>}
    </span>
  );
}
