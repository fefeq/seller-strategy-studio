// Executing a strategic suggestion (SDD-20261027 F3): the editable form that turns an accepted «prueba» into an experiment (CA-35) or
// an «acción comercial» into a task (CA-36), and the panel of proposed changes to confirm, reject or undo (CA-32, CA-33, CA-34, CA-38).
// Nothing is saved until the person confirms. «tú», no icons.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Field, Pick } from "@/components/fields";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { askConfirm } from "@/components/confirm-dialog";
import { decideSuggestion } from "@/lib/agent.functions";
import {
  applyStrategyChange,
  doneByHandStrategyChange,
  rejectStrategyChange,
  undoStrategyChange,
} from "@/lib/strategy.functions";
import { errorText } from "@/lib/errors";
import {
  canApplyChange,
  experimentDraft,
  experimentDraftIssues,
  taskDraft,
  type ChangeTable,
} from "@/lib/strategy-execute";
import { parseStrategy, ELEMENT_LABEL } from "@/lib/strategy-suggestions";

type Sug = { id: string; title: string; body: string | null; strategy: unknown };
/** Which accepted suggestions open a form first (CA-35, CA-36); the rest are decided directly. */
export const executeKind = (s: Pick<Sug, "strategy">): "experiment" | "task" | null => {
  const m = parseStrategy(s.strategy);
  return m?.action_type === "experiment"
    ? "experiment"
    : m?.action_type === "commercial_action"
      ? "task"
      : null;
};

export function ExecuteDialog({
  s,
  open,
  onOpenChange,
  reason,
}: {
  s: Sug;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reason?: string;
}) {
  const decide = useServerFn(decideSuggestion);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const kind = executeKind(s);
  const m = parseStrategy(s.strategy);
  const now = new Date();
  const [exp, setExp] = useState(() =>
    experimentDraft({ title: s.title, body: s.body, strategy: m ?? { evidence: [] } }, now),
  );
  const [task, setTask] = useState(() =>
    taskDraft(
      { title: s.title, body: s.body, strategy: m ?? { evidence: [] } },
      me?.user.id ?? "",
      now,
    ),
  );
  const [busy, setBusy] = useState(false);
  const { data: team = [] } = useQuery({
    queryKey: ["strategy-team", me?.currentOrg?.org_id],
    enabled: open && kind === "task" && !!me?.currentOrg?.org_id,
    queryFn: async () => {
      const { data: ms } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", me!.currentOrg!.org_id);
      const ids = (ms ?? []).map((x) => x.user_id);
      const { data: ps } = ids.length
        ? await supabase.from("profiles").select("id,full_name").in("id", ids)
        : { data: [] };
      return (ps ?? []).map((p) => ({ id: p.id, name: p.full_name || "Sin nombre" }));
    },
  });
  if (!kind) return null;
  const issues =
    kind === "experiment" ? experimentDraftIssues(exp) : task.title.trim() ? [] : ["el título"];
  async function save() {
    setBusy(true);
    try {
      const r = await decide({
        data: {
          id: s.id,
          decision: "approve",
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
          execute:
            kind === "experiment"
              ? { kind: "experiment", draft: exp }
              : { kind: "task", draft: task },
        },
      });
      toast.success(
        kind === "experiment"
          ? "Experimento creado como idea, enlazado a la sugerencia."
          : "Tarea creada, enlazada a la sugerencia.",
      );
      void r;
      onOpenChange(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "experiment" ? "Crear el experimento" : "Crear la tarea"}
          </DialogTitle>
          <DialogDescription>
            Está rellenado desde la sugerencia. Edítalo y confirma: hasta entonces no se guarda
            nada.
          </DialogDescription>
        </DialogHeader>
        {kind === "experiment" ? (
          <div className="space-y-3">
            <Field label="Título">
              <Input
                value={exp.title}
                maxLength={200}
                onChange={(e) => setExp({ ...exp, title: e.target.value })}
              />
            </Field>
            <Field label="Hipótesis">
              <Textarea
                rows={3}
                value={exp.hypothesis}
                onChange={(e) => setExp({ ...exp, hypothesis: e.target.value })}
              />
            </Field>
            <Field label="Métrica">
              <Input
                value={exp.metric}
                placeholder="Ej.: tasa de respuesta"
                onChange={(e) => setExp({ ...exp, metric: e.target.value })}
              />
            </Field>
            <Field label="Fecha de revisión">
              <DateField
                value={exp.review_on}
                onChange={(iso) => setExp({ ...exp, review_on: iso ?? "" })}
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Tarea">
              <Input
                value={task.title}
                maxLength={200}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
              />
            </Field>
            <Field label="Responsable">
              <Pick
                value={task.owner_id}
                options={Object.fromEntries(
                  (team.length ? team : [{ id: task.owner_id, name: "Yo" }]).map((t) => [
                    t.id,
                    t.name,
                  ]),
                )}
                onChange={(v) => setTask({ ...task, owner_id: v })}
              />
            </Field>
            <Field label="Fecha">
              <DateField
                value={task.due_date}
                onChange={(iso) => setTask({ ...task, due_date: iso ?? "" })}
              />
            </Field>
          </div>
        )}
        {issues.length > 0 && (
          <p className="text-sm text-muted-foreground">Falta {issues.join(", ")}.</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={busy || issues.length > 0} onClick={save}>
            {kind === "experiment" ? "Aceptar y crear experimento" : "Aceptar y crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Change = {
  id: string;
  suggestion_id: string;
  element: string;
  op: string;
  target_table: string | null;
  values: Record<string, unknown>;
  base: Record<string, unknown>;
  status: string;
  undo_until: string | null;
  created_at: string;
};
const VALUE = (v: unknown) =>
  Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "vacío" : String(v);

/** Proposals waiting for a person (and the last 24 hours of applied ones, to undo). Everyone sees them; only some roles confirm (CA-38). */
export function StrategyChanges() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const orgId = me?.currentOrg?.org_id;
  const roles = me?.roles ?? [];
  const apply = useServerFn(applyStrategyChange),
    reject = useServerFn(rejectStrategyChange),
    undo = useServerFn(undoStrategyChange),
    hand = useServerFn(doneByHandStrategyChange);
  const { data: rows = [] } = useQuery({
    queryKey: ["strategy-changes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const { data } = await supabase
        .from("strategy_changes")
        .select("id,suggestion_id,element,op,target_table,values,base,status,undo_until,created_at")
        .eq("org_id", orgId!)
        .or(`status.eq.pending,and(status.eq.applied,undo_until.gte.${since})`)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as Change[];
    },
  });
  const [busy, setBusy] = useState<string | null>(null);
  if (!rows.length) return null;
  async function run(
    id: string,
    fn: () => Promise<{ ok: boolean; message: string; code?: string; fields?: string[] }>,
    overwrite?: () => Promise<boolean>,
  ) {
    setBusy(id);
    try {
      let r = await fn();
      if (!r.ok && r.code === "needs_confirmation" && overwrite && (await overwrite()))
        r = await apply({ data: { id, overwrite: true } });
      (r.ok ? toast.success : toast.error)(r.message);
      qc.invalidateQueries({ queryKey: ["strategy-changes"] });
      qc.invalidateQueries({ queryKey: ["strategy"] });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-2xl">Cambios propuestos</h2>
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
        Nada de esto se ha aplicado sin ti. Confirma para escribirlo con origen «Revisión
        estratégica»; podrás deshacerlo durante 24 horas.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((c) => {
          const can = canApplyChange(roles, c.target_table as ChangeTable | null);
          const keys = Object.keys(c.values);
          return (
            <div key={c.id} className="rounded-lg border bg-card p-4">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                {ELEMENT_LABEL[
                  (c.element === "competitor"
                    ? "competitor"
                    : c.element) as keyof typeof ELEMENT_LABEL
                ] ?? c.element}{" "}
                · {c.status === "applied" ? "Aplicado" : "Pendiente de confirmar"}
              </p>
              {c.op === "manual" ? (
                <p className="mt-1 text-sm">
                  Propuesta sin valor que escribir: aplícala a mano y márcala como hecha.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {keys.map((k) => (
                    <li key={k} className="break-words">
                      <span className="text-muted-foreground">{k}:</span>{" "}
                      {c.op === "update" ? `${VALUE(c.base[k])} → ` : ""}
                      <span className="font-medium">{VALUE(c.values[k])}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!can && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tu rol puede verla, pero no aplicarla.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {c.status === "pending" && c.op !== "manual" && (
                  <Button
                    size="sm"
                    disabled={!can || busy === c.id}
                    onClick={() =>
                      run(
                        c.id,
                        () => apply({ data: { id: c.id } }),
                        () =>
                          askConfirm("¿Sustituir un valor escrito por una persona?", {
                            body: "Esta propuesta cambia un valor que alguien escribió o confirmó. Se sustituye solo si lo confirmas aquí.",
                            confirmLabel: "Sustituir",
                          }),
                      )
                    }
                  >
                    Confirmar
                  </Button>
                )}
                {c.status === "pending" && c.op === "manual" && (
                  <Button
                    size="sm"
                    disabled={!can || busy === c.id}
                    onClick={() => run(c.id, () => hand({ data: { id: c.id } }))}
                  >
                    Marcar como hecha
                  </Button>
                )}
                {c.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!can || busy === c.id}
                    onClick={() => run(c.id, () => reject({ data: { id: c.id } }))}
                  >
                    Descartar
                  </Button>
                )}
                {c.status === "applied" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!can || busy === c.id}
                    onClick={() => run(c.id, () => undo({ data: { id: c.id } }))}
                  >
                    Deshacer
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
