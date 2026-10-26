import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMe } from "@/hooks/use-me";
import { deletePlan, type DeleteKind, type UsageLine } from "@/lib/delete-rules";
import { errorText } from "@/lib/errors";
import { latestChangeFor, undoChange } from "@/lib/field-undo";
import { confirmed } from "@/lib/save";

/** What deleting a segment does to the rest of the data, counted before the person confirms. */
export const KEPT_WITHOUT_SEGMENT = [["deals", "deals"], ["accounts", "cuentas"], ["leads", "leads"], ["icp_profiles", "ICP"], ["trials", "pruebas"], ["finance_cost_lines", "líneas de coste"]] as const;
export const DELETED_WITH_SEGMENT = [["segment_targets", "objetivos"], ["cac_costs", "costes de CAC"], ["segment_budget_quarters", "trimestres de presupuesto"], ["account_assignment_rules", "reglas de reparto"]] as const;

const TABLE: Record<DeleteKind, "segments" | "icp_profiles" | "messaging_pillars"> = { segment: "segments", icp: "icp_profiles", pillar: "messaging_pillars" };
const NOUN: Record<DeleteKind, string> = { segment: "Segmento", icp: "ICP", pillar: "Pilar" };

type Usage = { kept: UsageLine[]; gone: UsageLine[] };

async function usageOf(kind: DeleteKind, target: { id: string; segment_id?: string | null }): Promise<Usage> {
  const count = async (table: (typeof KEPT_WITHOUT_SEGMENT)[number][0] | (typeof DELETED_WITH_SEGMENT)[number][0], segmentId: string) =>
    (await supabase.from(table).select("id", { count: "exact", head: true }).eq("segment_id", segmentId)).count ?? 0;
  if (kind === "segment") {
    const [kept, gone] = await Promise.all([
      Promise.all(KEPT_WITHOUT_SEGMENT.map(async ([t, l]) => ({ label: l, count: await count(t, target.id) }))),
      Promise.all(DELETED_WITH_SEGMENT.map(async ([t, l]) => ({ label: l, count: await count(t, target.id) }))),
    ]);
    return { kept, gone };
  }
  // An ICP is in use through its segment: the accounts and leads it scores and searches for.
  if (kind === "icp" && target.segment_id) {
    const [accounts, leads] = await Promise.all([count("accounts", target.segment_id), count("leads", target.segment_id)]);
    return { kept: [{ label: "cuentas", count: accounts }, { label: "leads", count: leads }], gone: [] };
  }
  return { kept: [], gone: [] };
}

/**
 * Delete or archive a segment, ICP or pillar: says what is lost and where it is used (CA-4), blocks what is in use
 * (CA-6) and what the role may not delete (CA-7), and offers «Deshacer» for 24 hours (CA-5).
 */
export function DeleteElement({ kind, target, onClose, onDone }: {
  kind: DeleteKind; target: { id: string; name: string; segment_id?: string | null } | null; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { data: me } = useMe();
  const { data: usage } = useQuery({ queryKey: ["delete-usage", kind, target?.id], enabled: !!target, queryFn: () => usageOf(kind, target!) });
  const plan = target && usage ? deletePlan(kind, target.name, usage, me?.roles ?? []) : null;
  async function remove() {
    if (!target) return;
    setBusy(true);
    try {
      await confirmed(supabase.from(TABLE[kind]).delete().eq("id", target.id).select("id"));
      const id = target.id;
      toast.success(`${NOUN[kind]} «${target.name}» ${plan?.confirmLabel === "Archivar" ? "archivado" : "borrado"}.`, {
        duration: 15000,
        action: { label: "Deshacer", onClick: async () => {
          try { const e = await latestChangeFor(id); if (!e) throw new Error("No encuentro el cambio para deshacerlo."); await undoChange(e.id); toast.success("Deshecho."); onDone(); }
          catch (err) { toast.error(errorText(err)); }
        } },
      });
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{plan?.title ?? `¿Borrar «${target?.name}»?`}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              {!plan ? <p>Comprobando qué datos dependen de esto…</p> : plan.lines.map((l, i) => <p key={i} className={plan.blocked === "in_use" && l.startsWith("Borrarlo") ? "text-destructive" : undefined}>{l}</p>)}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{plan?.allowed ? "Cancelar" : "Cerrar"}</AlertDialogCancel>
          {plan?.allowed && (
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); remove(); }} className="bg-destructive text-destructive-foreground">
              {busy ? "Un momento…" : plan.confirmLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
