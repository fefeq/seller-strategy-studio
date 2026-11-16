import { statusLabel, type SourceStatus } from "@/lib/onboarding-source-refs";
import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ReadingGuide, SourcePurpose } from "./reading-guide";
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
    queryFn: async () => {
      if (!jobId) return null;
      return (
        await supabase
          .from("background_jobs")
          .select("status,step,error")
          .eq("id", jobId)
          .maybeSingle()
      ).data;
    },
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
  // NK-0181: a source left without findings closes its panel, so restoring a discarded finding never brings it back open.
  const emptied = summary
    .filter((x) => !x.count && open.has(x.source))
    .map((x) => x.source)
    .join("\n");
  useEffect(() => {
    if (!emptied) return;
    setOpen((prev) => {
      const next = new Set(prev);
      for (const z of emptied.split("\n")) next.delete(z);
      return next;
    });
  }, [emptied]);
  const discarded = findings.flatMap((f, i) => (f.discardedAt ? [{ f, i }] : []));

  async function dropSource(s: string) {
    const deps = findingsDependingOn(s, findings);
    let choice: "keep" | "discard" = "keep";
    if (deps.length) {
      const c = await askUnsaved(`Vas a quitar «${s}»`, {
        body: `${deps.length === 1 ? "Un hallazgo viene" : `${deps.length} hallazgos vienen`} de esta fuente: ${deps
          .slice(0, 3)
          .map((i) => `«${findings[i]?.text ?? ""}»`)
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
    const finding = findings[i];
    if (!userId || !finding) return;
    const text = await askText("Editar hallazgo", {
      initial: finding.text,
      maxLength: 300,
      confirmLabel: "Guardar",
    });
    const next = text ? editFinding(findings, i, text, userId, now()) : null;
    if (next) await onChange({ findings: next });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <p data-testid="reading-headline" className="smallcaps text-ink-mid">
          {headline}
        </p>
        {done && <ReadingGuide />}
        {done && (
          <p className="mt-2 text-xs text-ink-mid">
            Cada línea es algo que encontré; si sale de una fuente, la verás al final. Confírmalo,
            edítalo o descártalo.
          </p>
        )}
        <ol className="mt-3 border-t border-hairline text-sm" aria-live="polite">
          {live.map(({ f, i }) => (
            <li
              key={i}
              className="grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-hairline py-5"
            >
              {!done && <span className="font-mono text-xs text-ink-faint">{time(f.at)}</span>}
              {/* NK-0180: a long source without spaces wraps instead of widening the page. */}
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="block font-medium leading-relaxed text-ink">{f.text}</span>
                {!!f.source && (
                  <span className="mt-2 block text-xs text-ink-mid">Fuente: {f.source}</span>
                )}
                {!f.source && done && (
                  <span className="mt-2 block text-xs text-ink-mid">
                    Sin fuente atribuida: contrasta este dato antes de confirmarlo.
                  </span>
                )}
                {!!f.sourceRemoved && <span className="text-ink-mid"> · fuente quitada</span>}
                {!!f.edited && <span className="text-ink-mid"> · editado</span>}
                {done && (
                  <span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
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
      <div className="min-w-0 border-t-2 border-hairline-firm pt-4">
        <p id={`${uid}-sources`} className="smallcaps">
          Fuentes
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-mid">
          La fuente explica de dónde viene el contexto; confirmar un hallazgo solo valida ese dato
          concreto.
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
              <li
                key={s}
                className="border-b border-hairline pb-4 pt-2"
                aria-describedby={hint ? hintId : undefined}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{s}</span>
                  <span data-testid="source-status" className="text-ink-faint">
                    {done && real && real.state !== "full" ? (
                      statusLabel(real)
                    ) : done && count ? (
                      <Button
                        type="button"
                        id={`${uid}-toggle-${n}`}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={`${counter} · ${s}`}
                        onClick={() => toggle(s)}
                        className="min-h-11 min-w-11 text-ink-mid underline underline-offset-2"
                      >
                        {counter}
                      </Button>
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
                <SourcePurpose source={s} />
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
                      <p key={i}>{findings[i]?.text}</p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {done && (
          <Button className="mt-4 h-auto min-h-11 w-full whitespace-normal" onClick={onNext}>
            Seguir a tu diagnóstico
          </Button>
        )}
        {done && (
          <p className="mt-2 text-xs leading-relaxed text-ink-mid">
            Puedes continuar sin confirmar todo. Aquí no apruebas tu estrategia: revisarás los
            bloques más adelante.
          </p>
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
