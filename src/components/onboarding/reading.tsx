import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { askConfirm, askText, askUnsaved } from "@/components/confirm-dialog";
import { FieldActions } from "@/components/field-actions";
import { useMe } from "@/hooks/use-me";
import { confirmedText } from "@/lib/field-actions";
import type { Finding } from "@/lib/onboarding";
import { canRestore, confirmFinding, discardFinding, editFinding, findingsDependingOn, removeSource, restoreFinding } from "@/lib/onboarding-sources";

/**
 * «Nokko lee»: the live ticker of what the background reading finds, each line with its source. Once the reading is
 * done each finding can be confirmed, edited or discarded (discarding is undoable for 24 hours) and each source can be
 * removed, saying which findings depend on it (SDD field-actions, U-4). While it runs nothing is editable: the job is
 * still writing the list.
 */
export function ReadingStep({ jobId, findings, sources, onNext, onBack, onSkip, onChange }: {
  jobId: string | null; findings: Finding[]; sources: string[]; onNext: () => void; onBack: () => void; onSkip?: () => void;
  onChange: (patch: { sources?: string[]; findings?: Finding[] }) => Promise<unknown>;
}) {
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const userId = me?.user.id;
  const { data: job } = useQuery({
    queryKey: ["onboarding-job", jobId],
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && ["done", "failed", "cancelled"].includes(q.state.data.status) ? false : 2000),
    queryFn: async () => (await supabase.from("background_jobs").select("status,step,error").eq("id", jobId!).maybeSingle()).data,
  });
  const done = job?.status === "done";
  const failed = job?.status === "failed" || job?.status === "cancelled";
  const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const now = () => new Date().toISOString();
  const live = findings.flatMap((f, i) => (f.discardedAt ? [] : [{ f, i }]));
  const discarded = findings.flatMap((f, i) => (f.discardedAt ? [{ f, i }] : []));

  async function dropSource(s: string) {
    const deps = findingsDependingOn(s, findings);
    let choice: "keep" | "discard" = "keep";
    if (deps.length) {
      const c = await askUnsaved(`Vas a quitar «${s}»`, {
        body: `${deps.length === 1 ? "Un hallazgo viene" : `${deps.length} hallazgos vienen`} de esta fuente: ${deps.slice(0, 3).map((i) => `«${findings[i]!.text}»`).join(", ")}${deps.length > 3 ? "…" : ""}. ¿Los mantienes o los descartas? La propuesta no se recalcula: si quieres que esta fuente deje de influir, vuelve a leer.`,
        saveLabel: "Mantener hallazgos", discardLabel: "Descartar hallazgos", stayLabel: "Cancelar",
      });
      if (c === "stay") return;
      choice = c === "save" ? "keep" : "discard";
    } else if (!(await askConfirm(`¿Quitar «${s}»?`, { body: "Ningún hallazgo depende de ella.", confirmLabel: "Quitar" }))) return;
    const next = removeSource({ sources, findings }, s, choice, now());
    await onChange({ sources: next.sources, findings: next.findings });
  }
  async function edit(i: number) {
    if (!userId) return;
    const text = await askText("Editar hallazgo", { initial: findings[i]!.text, maxLength: 300, confirmLabel: "Guardar" });
    const next = text ? editFinding(findings, i, text, userId, now()) : null;
    if (next) await onChange({ findings: next });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <p className="smallcaps text-ink-mid">{done ? "Leído" : failed ? "Sin terminar" : `Leyendo · ${job?.step ?? "en cola"}`}</p>
        <ol className="mt-3 border-t border-hairline font-mono text-sm" aria-live="polite">
          {live.map(({ f, i }) => (
            <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-hairline py-2">
              <span className="text-ink-faint">{time(f.at)}</span>
              <span>
                {f.text}{f.source && <span className="text-ink-mid"> · {f.source}</span>}
                {f.sourceRemoved && <span className="text-ink-mid"> · fuente quitada</span>}
                {f.edited && <span className="text-ink-mid"> · editado</span>}
                {done && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 font-sans text-xs">
                    <span className="text-ink-mid">{confirmedText(f.confirmedAt ? { confirmed: true, confirmedAt: f.confirmedAt } : undefined, f.confirmedBy && f.confirmedBy === userId ? "ti" : null) ?? "Sin confirmar"}</span>
                    <FieldActions kind="finding" roles={roles} confirmed={!!f.confirmedAt} labels={{ delete: "Descartar" }}
                      handlers={{ edit: () => edit(i), confirm: () => userId && onChange({ findings: confirmFinding(findings, i, userId, now()) }), delete: () => onChange({ findings: discardFinding(findings, i, now()) }) }} />
                  </span>
                )}
              </span>
            </li>
          ))}
          {!live.length && <li className="py-2 text-ink-faint">{findings.length ? "Has descartado todos los hallazgos." : "Esperando a empezar…"}</li>}
        </ol>
        {done && discarded.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-mid">{discarded.length} {discarded.length === 1 ? "descartado" : "descartados"}</summary>
            <ul className="mt-2 space-y-1">
              {discarded.map(({ f, i }) => (
                <li key={i} className="flex flex-wrap items-center gap-2"><span className="text-ink-mid">{f.text}</span>
                  {canRestore(f, new Date()) ? <Button size="sm" variant="ghost" onClick={() => onChange({ findings: restoreFinding(findings, i) })}>Recuperar</Button> : <span className="text-xs text-ink-faint">Ya no es posible recuperarlo: pasaron más de 24 horas.</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        {failed && <p className="mt-4 text-sm text-destructive">{job?.error ?? "La lectura se canceló."}</p>}
      </div>
      <div className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps">Fuentes</p>
        <ul className="mt-2 space-y-1 text-sm">
          {sources.map((s) => (
            <li key={s} className="flex flex-wrap items-center gap-2">{s} <span className="text-ink-faint">{done ? "leído" : failed ? "sin acceso" : "leyendo"}</span>
              {done && <FieldActions kind="onboarding_source" roles={roles} labels={{ delete: "Quitar" }} handlers={{ delete: () => dropSource(s) }} />}
            </li>
          ))}
        </ul>
        {done && <Button className="mt-4 w-full" onClick={onNext}>Seguir a tu diagnóstico</Button>}
        {failed && <Button variant="outline" className="mt-4 w-full" onClick={onBack}>Volver a tus fuentes</Button>}
        {failed && onSkip && (
          <>
            <Button variant="outline" className="mt-2 w-full" onClick={onSkip}>Hacer solo el diagnóstico</Button>
            <p className="mt-2 text-xs text-ink-mid">Sin fuentes, Nokko no te propone ICP ni posicionamiento: los completas después en Estrategia.</p>
          </>
        )}
        {!done && !failed && <p className="mt-4 text-xs text-ink-mid">Puedes salir: el aviso te traerá de vuelta aquí.</p>}
      </div>
    </div>
  );
}
