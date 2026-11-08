import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Empty, ScreenState } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EXPERIMENT_STATUS } from "@/lib/theory-u";
import { errorText } from "@/lib/errors";
import { DateField } from "@/components/date-field";
import { useMe } from "@/hooks/use-me";
import {
  CHANGE_ELEMENTS,
  CHANGE_LABEL,
  DECISION_LABEL,
  missingCriteria,
  suggestedReviewOn,
  type ChangeElement,
  type ExperimentDecision,
} from "@/lib/experiments";
import { decideExperiment } from "@/lib/experiments-core";
import { ExplanationFold } from "@/components/explanation-fold";

// Below lg the list/editor stack, so bring the editor into view after a tap.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

const TEXT_FIELDS = [
  ["hypothesis", "Hipótesis", "Creemos que [segmento] responderá a [cambio] porque [razón]."],
  ["prototype", "Prototipo", "La versión mínima que podemos probar esta semana."],
  ["audience", "Con quién lo probamos", ""],
  ["metric", "Métrica", "Ej.: tasa de respuesta, reuniones agendadas, win rate"],
  ["target", "Objetivo", "Ej.: >8% respuesta en 50 cuentas"],
  ["success_threshold", "Umbral de éxito", "Ej.: 8 % de respuesta o más. Con menos, no escalamos."],
  [
    "close_rule",
    "Regla de cierre",
    "Ej.: lo cerramos a los 30 días o al llegar a 50 cuentas contactadas.",
  ],
  ["result", "Resultado", ""],
  ["learning", "Aprendizaje", "¿Qué haríamos distinto? ¿Escalamos, iteramos o soltamos?"],
] as const;

export function Prototypes() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Tables<"gtm_experiments"> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isSuccess, error, refetch } = useQuery({
    queryKey: ["gtm_experiments"],
    queryFn: async () => {
      const [e, j] = await Promise.all([
        supabase.from("gtm_experiments").select("*").order("created_at", { ascending: false }),
        supabase.from("u_journeys").select("id,title").order("created_at", { ascending: false }),
      ]);
      const failed = e.error ?? j.error;
      if (failed) throw failed;
      return { exps: e.data ?? [], journeys: j.data ?? [] };
    },
  });
  const exps = data?.exps ?? [];
  const { data: me } = useMe();
  const [dec, setDec] = useState<{
    decision: ExperimentDecision;
    next_review_on: string | null;
    change_element: ChangeElement | "";
    change_note: string;
  }>({ decision: "close", next_review_on: null, change_element: "", change_note: "" });
  const gaps = sel ? missingCriteria(sel) : [];

  async function decide() {
    if (!sel || !me?.currentOrg?.org_id) return;
    try {
      const r = await decideExperiment(
        { db: supabase, orgId: me.currentOrg.org_id, userId: me.user.id },
        sel.id,
        {
          decision: dec.decision,
          result: sel.result ?? "",
          learning: sel.learning ?? "",
          next_review_on: dec.next_review_on,
          change_element: dec.change_element || null,
          change_note: dec.change_note,
        },
      );
      toast.success(
        r.proposed
          ? "Decisión guardada. Te dejé el cambio propuesto en Sugerencias, pendiente de tu decisión."
          : "Decisión guardada.",
      );
      setSel(null);
      qc.invalidateQueries({ queryKey: ["gtm_experiments"] });
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  async function add() {
    const { data: row, error } = await supabase
      .from("gtm_experiments")
      .insert({ title: "Nuevo prototipo" })
      .select()
      .single();
    if (error) return toast.error(errorText(error));
    setSel(row);
    qc.invalidateQueries({ queryKey: ["gtm_experiments"] });
    revealOnMobile(editorRef.current);
  }
  async function save() {
    if (!sel) return;
    const {
      id,
      org_id: _o,
      created_at: _c,
      updated_at: _u,
      created_by: _cb,
      updated_by: _ub,
      ...rest
    } = sel;
    const { error } = await supabase
      .from("gtm_experiments")
      .update({
        ...rest,
        journey_id: rest.journey_id || null,
        starts_on: rest.starts_on || null,
        ends_on: rest.ends_on || null,
        review_on: rest.review_on || null,
      })
      .eq("id", id);
    if (error) return toast.error(errorText(error));
    toast.success("Prototipo guardado.");
    qc.invalidateQueries({ queryKey: ["gtm_experiments"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ExplanationFold kind="metodo" className="max-w-3xl">
          <p className="text-sm text-muted-foreground">
            Co-crear en Theory U es explorar el futuro haciendo: prototipos pequeños, feedback
            temprano y aprender rápido en vez de planificar de más. Lo que funciona pasa a los
            playbooks y a la estrategia.
          </p>
        </ExplanationFold>
        <Button size="sm" onClick={add}>
          + Prototipo
        </Button>
      </div>
      {/* Phones: the 5 status columns scroll sideways with snap instead of stacking. */}
      <ScreenState isPending={isPending} error={error} refetch={refetch} skeleton="cards">
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 md:mx-0 md:grid md:snap-none md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0">
          {Object.entries(EXPERIMENT_STATUS).map(([k, label]) => {
            const col = exps.filter((e) => e.status === k);
            return (
              <div
                key={k}
                className="min-h-24 w-[70vw] max-w-64 shrink-0 snap-start space-y-2 rounded-lg bg-muted/40 p-2 md:w-auto md:max-w-none"
              >
                <p className="eyebrow px-1">
                  {label} <span className="font-mono">({col.length})</span>
                </p>
                {col.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSel(e);
                      revealOnMobile(editorRef.current);
                    }}
                    className={`block min-h-10 w-full break-words rounded-md border bg-card p-2 text-left text-xs md:min-h-0 ${sel?.id === e.id ? "border-signal" : ""}`}
                  >
                    <span className="font-medium">{e.title}</span>
                    {e.metric && <span className="block text-muted-foreground">{e.metric}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </ScreenState>
      <div ref={editorRef} className="scroll-mt-20">
        {sel ? (
          <div className="space-y-4 rounded-lg border bg-card p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="col-span-2">
                <Field label="Título">
                  <Input
                    value={sel.title}
                    onChange={(e) => setSel({ ...sel, title: e.target.value })}
                  />
                </Field>
              </div>
              <div className="col-span-2 md:col-span-1">
                <Field label="Estado">
                  <Pick
                    value={sel.status}
                    options={EXPERIMENT_STATUS}
                    onChange={(v) => setSel({ ...sel, status: v })}
                  />
                </Field>
              </div>
              <Field label="Inicio">
                <DateField
                  value={sel.starts_on}
                  onChange={(iso) => setSel({ ...sel, starts_on: iso })}
                />
              </Field>
              <Field label="Fin">
                <DateField
                  value={sel.ends_on}
                  onChange={(iso) => setSel({ ...sel, ends_on: iso })}
                />
              </Field>
            </div>
            <Field label="Recorrido U">
              <Pick
                value={sel.journey_id ?? ""}
                options={Object.fromEntries([
                  ["", "Sin recorrido"],
                  ...(data?.journeys ?? []).map((j) => [j.id, j.title]),
                ])}
                onChange={(v) => setSel({ ...sel, journey_id: v })}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              {TEXT_FIELDS.map(([k, label, ph]) => (
                <Field key={k} label={label}>
                  <Textarea
                    rows={2}
                    placeholder={ph}
                    value={sel[k] ?? ""}
                    onChange={(e) => setSel({ ...sel, [k]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <Field label="Fecha de revisión">
              <DateField
                value={sel.review_on ?? suggestedReviewOn(sel)}
                onChange={(iso) => setSel({ ...sel, review_on: iso })}
              />
            </Field>
            {gaps.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Falta por definir: {gaps.join(", ")}. Todo es editable.
              </p>
            )}
            <Button onClick={save}>Guardar</Button>
            {sel.status === "running" && (
              <div className="space-y-3 rounded-md border p-4">
                <p className="eyebrow">Decidir: escalar, ajustar o cerrar</p>
                <p className="text-sm text-muted-foreground">
                  Escribe antes el resultado y el aprendizaje y guarda. Para ajustar, elige una
                  nueva fecha de revisión.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Decisión">
                    <Pick
                      value={dec.decision}
                      options={DECISION_LABEL}
                      onChange={(v) => setDec({ ...dec, decision: v as ExperimentDecision })}
                    />
                  </Field>
                  {dec.decision === "adjust" ? (
                    <Field label="Nueva fecha de revisión">
                      <DateField
                        value={dec.next_review_on}
                        onChange={(iso) => setDec({ ...dec, next_review_on: iso })}
                      />
                    </Field>
                  ) : (
                    <Field label="Propone un cambio en">
                      <Pick
                        value={dec.change_element}
                        options={{
                          "": "Ninguno",
                          ...Object.fromEntries(CHANGE_ELEMENTS.map((k) => [k, CHANGE_LABEL[k]])),
                        }}
                        onChange={(v) =>
                          setDec({ ...dec, change_element: v as ChangeElement | "" })
                        }
                      />
                    </Field>
                  )}
                </div>
                {dec.decision !== "adjust" && dec.change_element && (
                  <Field label="Qué cambiarías">
                    <Textarea
                      rows={2}
                      value={dec.change_note}
                      onChange={(e) => setDec({ ...dec, change_note: e.target.value })}
                    />
                  </Field>
                )}
                <Button variant="outline" onClick={decide}>
                  Registrar decisión
                </Button>
              </div>
            )}
          </div>
        ) : isSuccess && exps.length === 0 ? (
          <Empty>Aún no hay prototipos GTM. Crea el primero.</Empty>
        ) : null}
      </div>
    </div>
  );
}
