import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page, Empty, ScreenState } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  canUseAdvisor,
  HORIZONS,
  LEVELS,
  sortRecommendations,
  WINDOWS,
  type AdvisorRecommendation,
  type AdvisorResult,
} from "@/lib/advisor";
import { ROLES, type Role } from "@/lib/roles";
import { generateGtmAdvice } from "@/lib/ai.functions";
import { errorText } from "@/lib/errors";
import { PrimaryLineNote } from "@/components/primary-line-note";
import { StrategyReviewPanel } from "@/components/strategy-review";

const TITLE = "Asesor GTM — Nokko";
const DESC =
  "Describe un objetivo o problema comercial y recibe recomendaciones de go-to-market priorizadas a partir de tu pipeline, métricas y segmentos.";

export const Route = createFileRoute("/_authenticated/advisor")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Advisor,
});

const EXAMPLES = [
  "Tenemos que crecer un 30% el ARR este año sin ampliar el equipo comercial.",
  "Nuestro win rate en Mid-market ha caído y los ciclos se alargan. ¿Qué cambiamos?",
  "Queremos entrar en Enterprise. ¿Estamos preparados y por dónde empezamos?",
  "La cobertura de pipeline para el trimestre es baja. ¿Cómo la recuperamos en 60 días?",
];

// Below lg the columns stack; bring the result into view after it arrives or is picked.
function revealOnMobile(el: HTMLElement | null) {
  if (el && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

const TONE: Record<string, string> = {
  high: "bg-signal/15 text-signal",
  medium: "bg-warning/25 text-foreground",
  low: "bg-muted text-muted-foreground",
};

function Advisor() {
  const { data: me } = useMe();
  const allowed = canUseAdvisor(me?.roles ?? []);
  const qc = useQueryClient();
  const run = useServerFn(generateGtmAdvice);
  const [goal, setGoal] = useState("");
  const [horizon, setHorizon] = useState("quarter");
  const [busy, setBusy] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["gtm_advisories"],
    enabled: allowed,
    queryFn: async () =>
      (
        await supabase
          .from("gtm_advisories")
          .select("id,goal,horizon,result,created_at")
          .order("created_at", { ascending: false })
          .limit(30)
      ).data ?? [],
  });
  const current = history.find((h) => h.id === selId) ?? (selId === null ? history[0] : undefined);

  async function analyze() {
    setBusy(true);
    try {
      const r = await run({ data: { goal, horizon } });
      await qc.invalidateQueries({ queryKey: ["gtm_advisories"] });
      setSelId(r.id);
      revealOnMobile(resultRef.current);
      toast.success("Recomendaciones listas.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (me && !allowed) {
    return (
      <Page eyebrow="Dirección comercial" title="Asesor GTM">
        <ScreenState
          isPending={false}
          error={null}
          refetch={() => undefined}
          forbidden="Solo el Owner y el Sales Leader de la empresa pueden usar el Asesor GTM. Pídeselo a uno de ellos."
        >
          {null}
        </ScreenState>
      </Page>
    );
  }

  return (
    <Page eyebrow="Dirección comercial · IA" title="Asesor GTM">
      <PrimaryLineNote className="mb-6" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.7fr]">
        {/* Phones: form → result → history (the left column is `contents` below lg). */}
        <div className="contents lg:block lg:space-y-4">
          <div className="order-1 space-y-3 rounded-lg border bg-card p-5 lg:order-none">
            <Field label="Objetivo o problema comercial">
              <Textarea
                rows={6}
                maxLength={4000}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ej.: Necesitamos 400K de nuevo negocio este trimestre y la cobertura está en 2x."
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setGoal(ex)}
                  className="rounded-none border px-2.5 py-2 text-left text-xs hover:border-signal md:py-1"
                >
                  {ex}
                </button>
              ))}
            </div>
            <Field label="Horizonte">
              <Pick value={horizon} options={HORIZONS} onChange={setHorizon} />
            </Field>
            <Button
              className="h-auto min-h-10 w-full whitespace-normal py-2 text-center md:min-h-0 md:whitespace-nowrap"
              onClick={analyze}
              disabled={busy || goal.trim().length < 10}
            >
              {busy ? "Analizando pipeline, métricas y segmentos…" : "Generar recomendaciones"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Se analizan tus deals, la conversión por etapa, la cobertura del trimestre, el win
              rate por fuente y por segmento, los benchmarks de cada segmento, el posicionamiento y
              el ICP. Puede tardar hasta un minuto.
            </p>
          </div>
          {history.length > 0 && (
            <div className="order-3 space-y-2 lg:order-none">
              <p className="eyebrow">Análisis anteriores</p>
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setSelId(h.id);
                    revealOnMobile(resultRef.current);
                  }}
                  className={`block w-full min-w-0 break-words rounded-md border bg-card p-3 text-left text-sm ${current?.id === h.id ? "border-signal" : ""}`}
                >
                  <span className="line-clamp-2">{h.goal}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("es-ES", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {HORIZONS[h.horizon] ?? h.horizon}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={resultRef} className="order-2 min-w-0 scroll-mt-20 lg:order-none">
          {busy && !current ? (
            <Empty>Analizando…</Empty>
          ) : current ? (
            <AdviceView goal={current.goal} result={current.result as unknown as AdvisorResult} />
          ) : (
            <Empty>
              Describe un objetivo o un problema y obtendrás un diagnóstico basado en tus datos y un
              plan de acción priorizado.
            </Empty>
          )}
        </div>
      </div>
      <section className="mt-10 space-y-3">
        <p className="eyebrow">Revisión estratégica con IA</p>
        <StrategyReviewPanel />
      </section>
    </Page>
  );
}

function AdviceView({ goal, result }: { goal: string; result: AdvisorResult }) {
  const recs = sortRecommendations(result.recommendations ?? []);
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <p className="eyebrow">Objetivo</p>
        <p className="mt-1 break-words text-sm">{goal}</p>
        <p className="eyebrow mt-4">Resumen</p>
        <p className="mt-1 font-display text-[22px] leading-snug">{result.summary}</p>
      </div>
      {result.diagnosis?.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Diagnóstico</p>
          <div className="grid gap-3 md:grid-cols-2">
            {result.diagnosis.map((d, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 text-sm">
                <p className="font-medium">{d.finding}</p>
                <p className="mt-1 text-xs text-muted-foreground">{d.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="eyebrow mb-2">Recomendaciones priorizadas</p>
        <div className="space-y-3">
          {recs.map((r, i) => (
            <RecCard key={i} rec={r} index={i} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <ListBox title="Riesgos" items={result.risks} />
        <ListBox title="Datos que faltan" items={result.data_gaps} />
        <ListBox title="Preguntas para el equipo" items={result.questions} />
      </div>
    </div>
  );
}

function RecCard({ rec, index }: { rec: AdvisorRecommendation; index: number }) {
  const [saved, setSaved] = useState(false);
  async function toPrototype() {
    const { error } = await supabase.from("gtm_experiments").insert({
      title: rec.title,
      hypothesis: rec.rationale,
      prototype: rec.actions.join("\n"),
      metric: rec.kpi,
      target: rec.target,
    });
    if (error) return toast.error(errorText(error));
    setSaved(true);
    toast.success("Añadido a Theory U → Prototipos.");
  }
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="font-display text-3xl leading-none text-signal">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 break-words">
            <p className="font-display text-[22px] leading-tight">{rec.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{rec.rationale}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-xs uppercase">
          <span className={`rounded px-1.5 py-0.5 ${TONE[rec.impact]}`}>
            Impacto {LEVELS[rec.impact]}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5">Esfuerzo {LEVELS[rec.effort]}</span>
          <span className="rounded bg-muted px-1.5 py-0.5">{WINDOWS[rec.window]}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {rec.actions.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-signal">→</span>
            {a}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="min-w-0 break-words text-muted-foreground">
          <b className="text-foreground">
            {ROLES[rec.owner_role as Role]?.label ?? rec.owner_role}
          </b>{" "}
          · KPI: {rec.kpi} · Objetivo: {rec.target}
        </span>
        <Button size="sm" variant="outline" onClick={toPrototype} disabled={saved}>
          {saved ? "En Prototipos" : "Convertir en prototipo"}
        </Button>
      </div>
    </div>
  );
}

function ListBox({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-1.5 text-sm">
        {items.map((x, i) => (
          <li key={i}>· {x}</li>
        ))}
      </ul>
    </div>
  );
}
