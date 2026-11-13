import { statusLabel, type SourceStatus } from "@/lib/onboarding-source-refs";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { askConfirm, askText, askUnsaved } from "@/components/confirm-dialog";
import { FieldActions } from "@/components/field-actions";
import { useMe } from "@/hooks/use-me";
import { confirmedText } from "@/lib/field-actions";
import type { Finding } from "@/lib/onboarding";
import {
  canRestore,
  confirmFinding,
  discardFinding,
  editFinding,
  findingsDependingOn,
  removeSource,
  restoreFinding,
  summarizeSources,
} from "@/lib/onboarding-sources";

/**
 * «Nokko lee»: the live ticker of what the background reading finds, each line with its source. Once the reading is
 * done each finding can be confirmed, edited or discarded (discarding is undoable for 24 hours) and each source can be
 * removed, saying which findings depend on it (SDD field-actions, U-4). While it runs nothing is editable: the job is
 * still writing the list.
 */
export function ReadingStep({
  jobId,
  findings,
  sources,
  onNext,
  onBack,
  onSkip,
  onChange,
  statuses = [],
}: {
  statuses?: SourceStatus[];
  jobId: string | null;
  findings: Finding[];
  sources: string[];
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  onChange: (patch: { sources?: string[]; findings?: Finding[] }) => Promise<unknown>;
}) {
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const userId = me?.user.id;
  const { data: job } = useQuery({
    queryKey: ["onboarding-job", jobId],
    enabled: !!jobId,
    refetchInterval: (q) =>
      q.state.data && ["done", "failed", "cancelled"].includes(q.state.data.status) ? false : 2000,
    queryFn: async () =>
      (
        await supabase
          .from("background_jobs")
          .select("status,step,error")
          .eq("id", jobId!)
          .maybeSingle()
      ).data,
  });
  const done = job?.status === "done";
  const failed = job?.status === "failed" || job?.status === "cancelled";
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const now = () => new Date().toISOString();
  // A step that already says «Leyendo…»/«Leí…» would repeat the word, so the header drops it.
  const step = job?.step ?? null;
  const headline = done
    ? "Lectura terminada"
    : job?.status === "failed"
      ? "No pude terminar la lectura"
      : job?.status === "cancelled"
        ? "Se canceló la lectura"
        : !step
          ? "Estoy leyendo · esperando turno"
          : /^(leyendo|leí)/i.test(step.trim())
            ? "Estoy leyendo"
            : `Estoy leyendo · ${step}`;
  const uid = useId();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (s: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(s)) next.add(s);
      return next;
    });
  // Counts only once the reading is done: until then the list is still being written (or is partial).
  const summary = summarizeSources(sources, findings);
  const live = findings.flatMap((f, i) => (f.discardedAt ? [] : [{ f, i }]));
  const discarded = findings.flatMap((f, i) => (f.discardedAt ? [{ f, i }] : []));

  async function dropSource(s: string) {
    const deps = findingsDependingOn(s, findings);
    let choice: "keep" | "discard" = "keep";
    if (deps.length) {
      const c = await askUnsaved(`Vas a quitar «${s}»`, {
        body: `${deps.length === 1 ? "Un hallazgo viene" : `${deps.length} hallazgos vienen`} de esta fuente: ${deps
          .slice(0, 3)
          .map((i) => `«${findings[i]!.text}»`)
          .join(
            ", ",
          )}${deps.length > 3 ? "…" : ""}. ¿Los mantienes o los descartas? La propuesta no se recalcula: si quieres que esta fuente deje de influir, vuelve a leer.`,
        saveLabel: "Mantener hallazgos",
        discardLabel: "Descartar hallazgos",
        stayLabel: "Cancelar",
      });
      if (c === "stay") return;
      choice = c === "save" ? "keep" : "discard";
    } else if (
      !(await askConfirm(`¿Quitar «${s}»?`, {
        body: "Ningún hallazgo depende de ella.",
        confirmLabel: "Quitar",
      }))
    )
      return;
    const next = removeSource({ sources, findings }, s, choice, now());
    await onChange({ sources: next.sources, findings: next.findings });
  }
  async function edit(i: number) {
    if (!userId) return;
    const text = await askText("Editar hallazgo", {
      initial: findings[i]!.text,
      maxLength: 300,
      confirmLabel: "Guardar",
    });
    const next = text ? editFinding(findings, i, text, userId, now()) : null;
    if (next) await onChange({ findings: next });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <p data-testid="reading-headline" className="smallcaps text-ink-mid">
          {headline}
        </p>
        {done && (
          <p className="mt-2 text-sm text-ink-mid">
            Cada línea es algo que encontré; si sale de una fuente, la verás al final. Confírmalo,
            edítalo o descártalo.
          </p>
        )}
        <ol className="mt-3 border-t border-hairline font-mono text-sm" aria-live="polite">
          {live.map(({ f, i }) => (
            <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-hairline py-2">
              <span className="text-ink-faint">{time(f.at)}</span>
              <span>
                {f.text}
                {!!f.source && <span className="text-ink-mid"> · {f.source}</span>}
                {!!f.sourceRemoved && <span className="text-ink-mid"> · fuente quitada</span>}
                {!!f.edited && <span className="text-ink-mid"> · editado</span>}
                {done && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 font-sans text-xs">
                    <span className="text-ink-mid">
                      {confirmedText(
                        f.confirmedAt ? { confirmed: true, confirmedAt: f.confirmedAt } : undefined,
                        f.confirmedBy && f.confirmedBy === userId ? "ti" : null,
                      ) ?? "Sin confirmar"}
                    </span>
                    <FieldActions
                      kind="finding"
                      roles={roles}
                      confirmed={!!f.confirmedAt}
                      labels={{ delete: "Descartar" }}
                      handlers={{
                        edit: () => edit(i),
                        confirm: () =>
                          userId &&
                          onChange({ findings: confirmFinding(findings, i, userId, now()) }),
                        delete: () => onChange({ findings: discardFinding(findings, i, now()) }),
                      }}
                    />
                  </span>
                )}
              </span>
            </li>
          ))}
          {!live.length && (
            <li className="py-2 text-ink-faint">
              {findings.length ? "Has descartado todos los hallazgos." : "Esperando a empezar…"}
            </li>
          )}
        </ol>
        {done && discarded.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-mid">
              {discarded.length} {discarded.length === 1 ? "descartado" : "descartados"}
            </summary>
            <ul className="mt-2 space-y-1">
              {discarded.map(({ f, i }) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-mid">{f.text}</span>
                  {canRestore(f, new Date()) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onChange({ findings: restoreFinding(findings, i) })}
                    >
                      Recuperar
                    </Button>
                  ) : (
                    <span className="text-xs text-ink-faint">
                      Ya no es posible recuperarlo: pasaron más de 24 horas.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
        {failed && job?.error && <p className="mt-4 text-sm text-destructive">{job.error}</p>}
      </div>
      <div className="border-t-2 border-hairline-firm pt-4">
        <p id={`${uid}-sources`} className="smallcaps">
          Fuentes
        </p>
        <ul aria-labelledby={`${uid}-sources`} className="mt-2 space-y-2 text-sm">
          {summary.map(({ source: s, indexes, count }, n) => {
            const panelId = `${uid}-findings-${n}`;
            const hintId = `${uid}-hint-${n}`;
            const isOpen = open.has(s);
            // The real read status (NK-0165): an unread or partly read document says so instead of a counter.
            const real = statuses.find((x) => x.name === s);
            const counter = count === 1 ? "1 hallazgo" : `${count} hallazgos`;
            const hint =
              done && count === null
                ? "No cuento por separado los hallazgos de una web; búscalos en la lista."
                : done && count === 0
                  ? "No atribuí ningún hallazgo a esta fuente por separado."
                  : null;
            return (
              <li key={s} aria-describedby={hint ? hintId : undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{s}</span>
                  <span data-testid="source-status" className="text-ink-faint">
                    {done && real && real.state !== "full" ? (
                      statusLabel(real)
                    ) : done && count ? (
                      <button
                        type="button"
                        id={`${uid}-toggle-${n}`}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={`${counter} · ${s}`}
                        onClick={() => toggle(s)}
                        className="min-h-11 min-w-11 text-ink-mid underline underline-offset-2"
                      >
                        {counter}
                      </button>
                    ) : done ? (
                      count === null ? (
                        "Sin recuento para webs"
                      ) : (
                        "Sin hallazgos propios"
                      )
                    ) : failed ? (
                      "Sin terminar"
                    ) : (
                      "leyendo"
                    )}
                  </span>
                  {done && (
                    <FieldActions
                      kind="onboarding_source"
                      roles={roles}
                      labels={{ delete: "Quitar" }}
                      handlers={{ delete: () => dropSource(s) }}
                    />
                  )}
                </div>
                {hint && (
                  <p id={hintId} data-testid="source-hint" className="mt-1 text-xs text-ink-mid">
                    {hint}
                  </p>
                )}
                {done && !!count && isOpen && (
                  <div
                    id={panelId}
                    data-testid="source-findings"
                    className="mt-1 space-y-1 border-l border-hairline pl-3 text-xs text-ink-mid"
                  >
                    {indexes.map((i) => (
                      <p key={i}>{findings[i]!.text}</p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {done && (
          <Button className="mt-4 w-full" onClick={onNext}>
            Seguir a tu diagnóstico
          </Button>
        )}
        {failed && (
          <Button variant="outline" className="mt-4 w-full" onClick={onBack}>
            Volver a tus fuentes
          </Button>
        )}
        {failed && onSkip && (
          <>
            <Button variant="outline" className="mt-2 w-full" onClick={onSkip}>
              Hacer solo el diagnóstico
            </Button>
            <p className="mt-2 text-xs text-ink-mid">
              Sin fuentes, Nokko no te propone ICP ni posicionamiento: los completas después en
              Estrategia.
            </p>
          </>
        )}
        {!done && !failed && (
          <p className="mt-4 text-xs text-ink-mid">
            Puedes salir: el aviso te traerá de vuelta aquí.
          </p>
        )}
      </div>
    </div>
  );
}
