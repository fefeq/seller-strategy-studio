import { usePrimaryLine } from "@/hooks/use-business-lines";
import { Trash2 } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOTIONS, recommendMotion, type Motion } from "@/lib/metrics";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { useCurrency, useMe } from "@/hooks/use-me";
import { lastQuarters } from "@/lib/pipeline-real";
import { assignSegment, type SegLike } from "@/lib/segment-coverage";
import { quartersOfYear } from "@/lib/segment-budget";
import { strategyCalculator } from "@/lib/strategy-calculator";
import { MARGIN_REASON, WIN_RATE_WINDOWS, acvFor } from "@/lib/unit-economics";
import { DataMark } from "@/components/metrics/data-mark";
import { FigureNote, FigureValue } from "@/components/metrics/figure";
import { figureMark, noClosedDeals } from "@/components/metrics/mark-text";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { DeleteElement } from "@/components/delete-element";
import { checkAcvRange, checkSegmentField, type SegmentNumericField } from "@/lib/segment-fields";
import {
  ACQUISITION_MOTION_LABEL,
  NO_ACQUISITION_MOTION,
  readAcquisitionMotion,
} from "@/lib/acquisition-motion";
import type { TablesUpdate } from "@/integrations/supabase/types";

export const MOTION_OPTS = Object.fromEntries(
  Object.entries(MOTIONS).map(([k, v]) => [k, v.label]),
);
/** «Sin definir» first: an empty value is a real answer, never filled in for the person. */
const ACQUISITION_OPTS: Record<string, string> = {
  "": NO_ACQUISITION_MOTION,
  ...ACQUISITION_MOTION_LABEL,
};
export const MONEY_COLS = ["acv_min", "acv_max", "cac_target", "ae_quota"];
export const SEG_LABEL: Record<string, string> = {
  priority: "Prioridad",
  acv_min: "ACV mín",
  acv_max: "ACV máx",
  motion: "Modelo de venta",
  acquisition_motion: "Motion de adquisición",
  cycle_days: "Ciclo (días)",
  sdr_per_ae: "SDR por AE",
  ae_per_se: "AE por SE",
  win_rate_target: "Win rate obj. %",
  ae_quota: "Cuota anual AE",
  cac_target: "CAC objetivo",
  gross_margin_pct: "Margen bruto %",
  payback_months: "Payback obj. (m)",
};
// [title, columns, show the «real» columns and actions in this block]
export const SEG_GROUPS = [
  [
    "Económicos",
    [
      "priority",
      "acv_min",
      "acv_max",
      "win_rate_target",
      "ae_quota",
      "cac_target",
      "gross_margin_pct",
      "payback_months",
    ],
    true,
  ],
  [
    "Modelo de venta y capacidad",
    ["motion", "acquisition_motion", "cycle_days", "sdr_per_ae", "ae_per_se"],
    false,
  ],
] as const;
export const SEG_COLS = [
  ["priority", "Prioridad"],
  ["acv_min", "ACV mín"],
  ["acv_max", "ACV máx"],
  ["motion", "Modelo de venta"],
  ["acquisition_motion", "Motion de adquisición"],
  ["cycle_days", "Ciclo (días)"],
  ["sdr_per_ae", "SDR por AE"],
  ["ae_per_se", "AE por SE"],
  ["win_rate_target", "Win rate obj. %"],
  ["ae_quota", "Cuota anual AE"],
  ["cac_target", "CAC objetivo"],
  ["gross_margin_pct", "Margen bruto %"],
  ["payback_months", "Payback obj. (m)"],
] as const;

export function rangeText(r: [number, number | null] | null, fmt: (n: number) => string) {
  if (!r) return "—";
  return r[1] == null ? `${fmt(r[0])}+` : `${fmt(r[0])}–${fmt(r[1])}`;
}

export function Motions() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { currency, symbol, money } = useCurrency();
  const isOwner = me?.roles.includes("owner");
  const canEditMotion = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const { lines, primary } = usePrimaryLine(me?.currentOrg?.org_id);
  const [acvManual, setAcvManual] = useState<number | null>(null);
  const [basis, setBasis] = useState<"target" | "real">("target");
  const [forced, setForced] = useState("");
  // Ranked segments first (1, 2, 3…), then the rest by ACV.
  const { data: segs = [] } = useQuery({
    queryKey: ["segments"],
    queryFn: async () =>
      (
        await supabase
          .from("segments")
          .select("*")
          .order("priority", { ascending: true, nullsFirst: false })
          .order("acv_min")
      ).data ?? [],
  });
  const { data: deals = [] } = useQuery({
    queryKey: ["deals-real"],
    queryFn: async () =>
      (
        await supabase
          .from("deals")
          .select("gross_margin,segment_id,amount,stage,close_date,closed_at,updated_at,created_at")
      ).data ?? [],
  });
  const { data: costs = [] } = useQuery({
    queryKey: ["segment-coverage", "cac-12m"],
    queryFn: async () =>
      (
        await supabase
          .from("cac_costs")
          .select("segment_id,channel,amount,period")
          .in("period", lastQuarters())
      ).data ?? [],
  });
  const year = new Date().getFullYear();
  const { data: budgetRows = [] } = useQuery({
    queryKey: ["segment-coverage", "budget-quarters", year],
    queryFn: async () =>
      (
        await supabase
          .from("segment_budget_quarters")
          .select("*")
          .in("period", quartersOfYear(year))
      ).data ?? [],
  });
  // The calculator is pure (src/lib/strategy-calculator.ts, SDD-20261109 U-4): CAC, ACV, margin and payback come from
  // unit-economics.ts, so the real payback here is the one of Cobertura and Payback real for the same data.
  const calc = useMemo(
    () =>
      strategyCalculator({
        segments: segs as (SegLike & { ae_quota: number | null })[],
        deals,
        costs,
        budgetRows,
        acvManual,
        basis,
        forced,
      }),
    [segs, deals, costs, budgetRows, acvManual, basis, forced],
  );
  const real = calc.actuals;
  const acv = calc.acv.value;
  const seg = calc.seg ? segs.find((s) => s.id === calc.seg!.id) : undefined;
  const { segReal, segCac, margin, paybackReal, winUsed, cacUsed } = calc;
  const rec = recommendMotion(acv ?? 0);
  /** The segment's ACV behind its payback (acvFor), for the «ACV real» cells of the segments tables. */
  const segAcvOf = (s: (typeof segs)[number]) =>
    acvFor(
      s as SegLike,
      deals.filter((d) => assignSegment(d, segs as SegLike[]) === s.id),
    );
  const winRealOf = (n: number | null | undefined) =>
    n != null
      ? { value: n, state: "real", reason: null }
      : noClosedDeals(WIN_RATE_WINDOWS.ultimos365.label.toLowerCase());
  const missing = seg
    ? [
        !seg.ae_quota && "cuota anual AE",
        !winUsed && "win rate objetivo",
        !cacUsed && "CAC objetivo",
      ].filter(Boolean)
    : [];
  const pctTarget = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
  const pct = (n: number) => `${Math.round(n)}%`;
  const days = (n: number | null | undefined) => (n == null ? "—" : `${n} días`);

  // Cells whose last value was refused, so the person sees which one to fix.
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  async function upd(id: string, patch: TablesUpdate<"segments">) {
    try {
      await confirmed(supabase.from("segments").update(patch).eq("id", id).select("id"));
      return true;
    } catch (e) {
      toast.error(errorText(e));
      return false;
    } finally {
      qc.invalidateQueries({ queryKey: ["segments"] });
      qc.invalidateQueries({ queryKey: ["setup"] });
    }
  }
  /** Validates a typed benchmark, saves it and puts the saved value back in the cell if it was refused. */
  async function updNumber(
    s: (typeof segs)[number],
    k: SegmentNumericField,
    input: HTMLInputElement,
  ) {
    const cell = `${s.id}:${k}`;
    const previous = s[k];
    const check = checkSegmentField(k, input.value, s.name);
    const next = check.ok ? check.value : null;
    const rangeError = check.ok
      ? checkAcvRange(
          k === "acv_min" ? next : s.acv_min,
          k === "acv_max" ? next : s.acv_max,
          s.name,
        )
      : null;
    const error = !check.ok ? check.error : rangeError;
    if (error) {
      setInvalid((m) => ({ ...m, [cell]: error }));
      toast.error(`${error} No se ha guardado.`);
      input.value = previous == null ? "" : String(previous);
      return;
    }
    setInvalid((m) => {
      const { [cell]: _, ...rest } = m;
      return rest;
    });
    if ((previous == null ? null : Number(previous)) === next) return;
    if (!(await upd(s.id, { [k]: next }))) input.value = previous == null ? "" : String(previous);
  }
  async function add() {
    try {
      await confirmed(supabase.from("segments").insert({ name: "Nuevo segmento" }).select("id"));
    } catch (e) {
      toast.error(errorText(e));
    }
    qc.invalidateQueries({ queryKey: ["segments"] });
    qc.invalidateQueries({ queryKey: ["setup"] });
  }
  async function setCurrency(c: string) {
    const { error } = await supabase
      .from("organizations")
      .update({ currency: c })
      .eq("id", me!.currentOrg!.org_id);
    if (error) return toast.error(errorText(error));
    await qc.invalidateQueries({ queryKey: ["me"] });
    toast.success(
      `Moneda: ${CURRENCIES[c]}. Las cifras no se han convertido: revisa importes y benchmarks.`,
    );
  }
  const fmt1 = (n: number | null) =>
    n == null ? "—" : n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  // One editable cell, shared by the mobile cards and the desktop table.
  const segCell = (s: (typeof segs)[number], k: (typeof SEG_COLS)[number][0]) => {
    if (k === "motion") {
      const suggested = recommendMotion(Number(s.acv_min ?? 0));
      return (
        <>
          <Pick value={s.motion} options={MOTION_OPTS} onChange={(v) => upd(s.id, { motion: v })} />
          {s.motion !== suggested && (
            <p className="mt-1 text-xs text-muted-foreground">
              Referencia de mercado: {MOTIONS[suggested].label}
            </p>
          )}
        </>
      );
    }
    if (k === "acquisition_motion") {
      // Only Owner and Sales Leader edit it (the same people who may save segments through the agent).
      return (
        <Pick
          aria-label={`Motion de adquisición de ${s.name}`}
          disabled={!canEditMotion}
          value={readAcquisitionMotion(s.acquisition_motion) ?? ""}
          options={ACQUISITION_OPTS}
          onChange={(v) => upd(s.id, { acquisition_motion: v === "" ? null : v })}
        />
      );
    }
    const error = invalid[`${s.id}:${k}`];
    return (
      <>
        {/* Text with a decimal keyboard, not type=number: a number field hands back "" for «97,5» in some browsers, which read as «empty» and wiped the value. */}
        <Input
          type="text"
          inputMode="decimal"
          aria-invalid={!!error}
          title={error}
          defaultValue={s[k] ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => updNumber(s, k, e.currentTarget)}
        />
        {error && <p className="mt-1 text-xs text-destructive md:hidden">{error}</p>}
      </>
    );
  };

  return (
    <div className="space-y-8">
      {lines.length > 0 && segs.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <p className="eyebrow">Segmentos por línea de negocio</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sin línea, un segmento usa la principal
            {primary ? ` (${primary.label}, arquetipo ${primary.result.archetype})` : ""}.
            {!canEditMotion && " Solo Owner y Sales Leader los asignan."}
          </p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {segs.map((s) => {
              const own = lines.find((l) => l.id === s.business_line_id);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Pick
                    aria-label={`Línea de negocio de ${s.name}`}
                    disabled={!canEditMotion}
                    value={own?.id ?? ""}
                    options={{
                      "": "Principal (por defecto)",
                      ...Object.fromEntries(
                        lines.map((l) => [l.id, l.name || `Línea ${l.position + 1}`]),
                      ),
                    }}
                    onChange={(v) => upd(s.id, { business_line_id: v === "" ? null : v })}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="grid gap-6 rounded-lg border bg-card p-6 md:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <p className="eyebrow">Calculadora de estrategia GTM</p>
          <Field label="Moneda de la empresa">
            {isOwner ? (
              <>
                <Pick value={currency} options={CURRENCIES} onChange={setCurrency} />
                <p className="text-xs text-muted-foreground">
                  Cambiarla solo cambia el símbolo: no convierte ninguna cifra. Revisa importes y
                  benchmarks después.
                </p>
              </>
            ) : (
              <p className="text-sm">
                {CURRENCIES[currency] ?? currency}{" "}
                <span className="text-xs text-muted-foreground">· solo el Owner la cambia</span>
              </p>
            )}
          </Field>
          <Field label={`Valor anual del contrato (ACV, ${symbol})`}>
            <Input
              type="number"
              value={acv ?? ""}
              placeholder="Escribe un ACV"
              onChange={(e) => setAcvManual(e.target.value === "" ? null : Number(e.target.value))}
            />
            {real.overall.acv != null ? (
              acvManual == null ? (
                <p className="text-xs text-success">
                  ACV real: media de {real.overall.acvSample}{" "}
                  {real.overall.acvSample === 1
                    ? `deal ${real.overall.acvSource === "ganados" ? "ganado" : "abierto"}`
                    : `deals ${real.overall.acvSource}`}
                  . Se actualiza solo cuando entran leads.
                </p>
              ) : (
                <button
                  className="text-xs text-signal underline-offset-2 hover:underline"
                  onClick={() => setAcvManual(null)}
                >
                  Volver al ACV real ({money(Math.round(real.overall.acv))})
                </button>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                {/* SDD-20261109 D12, D13: no example ACV; the mean of the ranges is an estimate. */}
                {acvManual == null && figureMark(calc.acv) && (
                  <>
                    <DataMark {...figureMark(calc.acv)!} />.{" "}
                  </>
                )}
                Sin deals con importe todavía.{" "}
                <Link to="/leads/entrada" className="underline">
                  Conecta tus leads
                </Link>
                .
              </p>
            )}
          </Field>
          <Field label="Calcular con">
            <Pick
              value={basis}
              options={{
                target: "Benchmarks objetivo del segmento",
                real: "Datos reales de la pipeline",
              }}
              onChange={(v) => setBasis(v as "target" | "real")}
            />
          </Field>
          <Field label="Segmento">
            <Pick
              value={forced}
              options={Object.fromEntries([
                ["", "Automático según ACV"],
                ...segs.map((s) => [s.id, s.name]),
              ])}
              onChange={setForced}
            />
          </Field>
        </div>
        {seg ? (
          <div>
            <p className="eyebrow">Segmento · {seg.name}</p>
            <p className="font-display text-4xl text-signal">
              {MOTIONS[seg.motion as Motion]?.label ?? seg.motion}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Ciclo de venta</dt>
              <dd>{seg.cycle_days ? `${seg.cycle_days} días` : "—"}</dd>
              <dt className="text-muted-foreground">Equipo</dt>
              <dd>
                {[
                  seg.sdr_per_ae && `${seg.sdr_per_ae} SDR por AE`,
                  seg.ae_per_se && `${seg.ae_per_se} AE por SE`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
              <dt className="text-muted-foreground">Win rate objetivo</dt>
              <dd>{seg.win_rate_target ? `${seg.win_rate_target}%` : "—"}</dd>
              <dt className="text-muted-foreground">Cuota anual por AE</dt>
              <dd>{seg.ae_quota ? money(Number(seg.ae_quota)) : "—"}</dd>
              <dt className="text-muted-foreground">CAC objetivo</dt>
              <dd>{seg.cac_target ? money(Number(seg.cac_target)) : "—"}</dd>
              <dt className="text-muted-foreground">Payback objetivo</dt>
              <dd>{seg.payback_months ? `${seg.payback_months} meses` : "—"}</dd>
            </dl>
            <div className="mt-4 overflow-hidden rounded-md border text-sm">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 bg-muted/50 px-3 py-1.5">
                <span className="eyebrow text-xs">Real vs objetivo · {seg.name}</span>
                <span className="eyebrow text-xs">Real</span>
                <span className="eyebrow text-xs">Objetivo</span>
              </div>
              {(
                [
                  [
                    "ACV",
                    WIN_RATE_WINDOWS.historico.label,
                    calc.segAcv ? (
                      <>
                        <FigureValue
                          f={calc.segAcv}
                          show={(n) =>
                            `${money(Math.round(n))}${calc.segAcv!.sample ? ` · ${calc.segAcv!.sample} ${calc.segAcv!.sample === 1 ? "deal" : "deals"}` : ""}`
                          }
                        />
                        <FigureNote f={calc.segAcv} className="block text-xs" />
                      </>
                    ) : null,
                    seg.acv_min != null
                      ? `${money(Number(seg.acv_min), true)}–${seg.acv_max != null ? money(Number(seg.acv_max), true) : "∞"}`
                      : "—",
                  ],
                  [
                    "Win rate",
                    WIN_RATE_WINDOWS.ultimos365.label,
                    <FigureValue
                      key="w"
                      f={winRealOf(segReal?.winRate)}
                      show={(n) =>
                        `${pct(n)} · ${segReal!.closedSample} ${segReal!.closedSample === 1 ? "cerrado" : "cerrados"}`
                      }
                    />,
                    pctTarget(seg.win_rate_target),
                  ],
                  [
                    "Ciclo de venta",
                    WIN_RATE_WINDOWS.ultimos365.label,
                    segReal?.cycleDays != null
                      ? `${days(segReal.cycleDays)} · ${segReal.cycleSample} ${segReal.cycleSample === 1 ? "ganado" : "ganados"}`
                      : "—",
                    days(seg.cycle_days),
                  ],
                  [
                    "CAC",
                    WIN_RATE_WINDOWS.ultimos4.label,
                    segCac ? (
                      <FigureValue
                        f={segCac.figure}
                        show={(n) =>
                          `${money(Math.round(n))} · ${segCac.customers} ${segCac.customers === 1 ? "ganado" : "ganados"}`
                        }
                      />
                    ) : null,
                    seg.cac_target ? money(Number(seg.cac_target)) : "—",
                  ],
                  [
                    "Payback",
                    WIN_RATE_WINDOWS.ultimos4.label,
                    <>
                      <FigureValue f={paybackReal} show={(n) => `${fmt1(n)} m`} />
                      <FigureNote f={paybackReal} className="block text-xs" />
                    </>,
                    seg.payback_months ? `${seg.payback_months} m` : "—",
                  ],
                ] as [string, string, ReactNode, string][]
              ).map(([l, w, r, t]) => (
                <div
                  key={l}
                  className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-t px-3 py-1.5"
                >
                  <span className="break-words text-muted-foreground">
                    {l}
                    <span className="block text-xs">{w}</span>
                  </span>
                  <span className="break-words">{r}</span>
                  <span className="break-words">{t}</span>
                </div>
              ))}
            </div>
            {segCac?.cac == null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {segCac?.cost ? (
                  "Hay costes, pero ningún deal ganado en los últimos 4 trimestres en este segmento: aún no hay CAC real."
                ) : (
                  <>
                    Para ver el CAC y el payback reales, introduce los costes por canal en{" "}
                    <Link to="/metrics" className="underline">
                      Métricas → CAC real
                    </Link>
                    .
                  </>
                )}
              </p>
            )}
            {basis === "real" && (
              <p className="mt-2 text-xs text-muted-foreground">
                {segReal?.winRate != null
                  ? `La capacidad usa el win rate real (${pct(segReal.winRate)}, ${WIN_RATE_WINDOWS.ultimos365.label.toLowerCase()}).`
                  : "Aún no hay deals cerrados en este segmento: la capacidad usa el win rate objetivo."}{" "}
                {segCac?.cac != null
                  ? `El payback usa el CAC real (${money(Math.round(segCac.cac))}).`
                  : "El payback es un escenario con el CAC objetivo."}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {(
                [
                  ["Deals por AE / año", calc.deals, (n: number) => fmt1(Math.ceil(n))],
                  ["Oportunidades por AE / año", calc.opps, (n: number) => fmt1(Math.ceil(n))],
                  ["Oportunidades por AE / mes", calc.oppsPerMonth, (n: number) => fmt1(n)],
                ] as const
              ).map(([l, f, show]) => (
                <div key={l} className="rounded-md bg-muted/50 p-3">
                  <p className="eyebrow text-xs">{l}</p>
                  <p className="font-display text-2xl">
                    {f.value == null && f.state !== "sin_dato" ? (
                      fmt1(null)
                    ) : (
                      <FigureValue f={f} show={show} />
                    )}
                  </p>
                </div>
              ))}
              {/* SDD-20261109 D14: basis «real» shows the real payback itself; otherwise a marked scenario. */}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="eyebrow text-xs">{calc.planPaybackLabel}</p>
                <p className="font-display text-2xl">
                  <FigureValue f={calc.planPayback} show={(n) => `${fmt1(n)} m`} />
                </p>
                <FigureNote f={calc.planPayback} className="block text-xs text-muted-foreground" />
              </div>
            </div>
            {calc.judged && (
              <p
                className={`mt-2 text-xs ${calc.judged.within ? "text-success" : "text-destructive"}`}
              >
                {calc.judged.within ? "Dentro" : "Fuera"} del payback objetivo de{" "}
                {calc.judged.target} meses
                {margin.value != null && margin.source
                  ? ` (${MARGIN_REASON[margin.source]}: ${Math.round(margin.value)}%)`
                  : ""}
                .
              </p>
            )}
            {missing.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Completa {missing.join(", ")} en la tabla de segmentos para calcular la capacidad.
              </p>
            )}
          </div>
        ) : acv == null ? (
          <div>
            <p className="eyebrow">Calculadora</p>
            {/* SDD-20261109 D12: no example ACV; nothing is computed until there is one. */}
            <p className="mt-2 text-sm">
              <FigureValue f={calc.acv} show={(n) => money(n)} />
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Escribe un ACV, conecta tus leads o pon el rango de ACV de tus segmentos para ver el
              modelo de venta, la capacidad y el payback.
            </p>
          </div>
        ) : (
          <div>
            <p className="eyebrow">Ningún segmento tuyo cubre este ACV · referencia de mercado</p>
            <p className="font-display text-4xl text-signal">{MOTIONS[rec].label}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Ciclo de venta</dt>
              <dd>{MOTIONS[rec].cycle}</dd>
              <dt className="text-muted-foreground">Equipo</dt>
              <dd>{MOTIONS[rec].team}</dd>
              <dt className="text-muted-foreground">CAC típico</dt>
              <dd>{rangeText(MOTIONS[rec].cac, (n) => formatMoney(n, "USD", true))}</dd>
              <dt className="text-muted-foreground">Cuota AE típica</dt>
              <dd>{rangeText(MOTIONS[rec].quota, (n) => formatMoney(n, "USD", true))}</dd>
              <dt className="text-muted-foreground">Payback</dt>
              <dd>{MOTIONS[rec].payback}</dd>
              <dt className="text-muted-foreground">Se mide por</dt>
              <dd>{MOTIONS[rec].efficiency}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Referencia general en dólares (guía de Tom Tunguz). Crea o ajusta un segmento con este
              rango de ACV para usar tus propios datos.
            </p>
          </div>
        )}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="min-w-0 text-3xl">Tus segmentos y benchmarks</h3>
          <Button size="sm" className="shrink-0" onClick={add}>
            + Segmento
          </Button>
        </div>
        <div className="divide-y divide-hairline border-t border-hairline md:hidden">
          {segs.map((s) => (
            <div key={s.id} className={`space-y-3 py-4 ${seg?.id === s.id ? "bg-signal/5" : ""}`}>
              <Field label="Segmento">
                <Input defaultValue={s.name} onBlur={(e) => upd(s.id, { name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                {SEG_COLS.map(([k, h]) => (
                  <div key={k} className={k === "motion" ? "col-span-2" : "min-w-0"}>
                    <Field label={`${h}${MONEY_COLS.includes(k) ? ` (${symbol})` : ""}`}>
                      {segCell(s, k)}
                    </Field>
                  </div>
                ))}
              </div>
              <dl className="grid grid-cols-3 gap-2 bg-signal/5 px-2 py-2 text-sm">
                <div className="min-w-0">
                  <dt className="eyebrow text-xs">ACV real</dt>
                  <dd className="break-words">
                    <FigureValue f={segAcvOf(s)} show={(n) => money(Math.round(n), true)} />
                    <FigureNote f={segAcvOf(s)} className="block text-xs" />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="eyebrow text-xs">
                    Win rate real · {WIN_RATE_WINDOWS.ultimos365.label}
                  </dt>
                  <dd>
                    <FigureValue f={winRealOf(real.bySegment[s.id]?.winRate)} show={pct} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="eyebrow text-xs">Ciclo real</dt>
                  <dd>{days(real.bySegment[s.id]?.cycleDays)}</dd>
                </div>
              </dl>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setToDelete({ id: s.id, name: s.name })}
                >
                  Eliminar segmento
                </Button>
              )}
            </div>
          ))}
        </div>
        {/* Desktop: two narrower tables instead of one with 15 columns, so the row never scrolls away
            from its segment name and tabbing doesn't jump into the wrong column. */}
        {SEG_GROUPS.map(([title, keys, showReal]) => (
          <div key={title} className="mb-4 hidden md:block">
            <p className="eyebrow mb-1">{title}</p>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="eyebrow sticky left-0 z-10 border-r bg-background px-3 py-3">
                      Segmento
                    </th>
                    {keys.map((k) => (
                      <th key={k} className="eyebrow whitespace-nowrap px-3 py-3">
                        {SEG_LABEL[k]}
                        {MONEY_COLS.includes(k) ? ` (${symbol})` : ""}
                      </th>
                    ))}
                    {showReal &&
                      [
                        "ACV real",
                        `Win rate real · ${WIN_RATE_WINDOWS.ultimos365.label}`,
                        "Ciclo real",
                      ].map((h) => (
                        <th key={h} className="eyebrow whitespace-nowrap bg-signal/5 px-3 py-3">
                          {h}
                        </th>
                      ))}
                    {showReal && isOwner && (
                      <th className="px-3 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {segs.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b last:border-0 ${seg?.id === s.id ? "bg-signal/5" : ""}`}
                    >
                      <td className="sticky left-0 z-10 min-w-40 border-r bg-background px-2 py-2">
                        {showReal ? (
                          <Input
                            aria-label="Nombre del segmento"
                            defaultValue={s.name}
                            onBlur={(e) =>
                              e.target.value.trim() &&
                              e.target.value !== s.name &&
                              upd(s.id, { name: e.target.value.trim() })
                            }
                          />
                        ) : (
                          <span className="block px-1 font-medium">{s.name}</span>
                        )}
                      </td>
                      {keys.map((k) => (
                        <td
                          key={k}
                          className={`px-2 py-2 ${k === "motion" || k === "acquisition_motion" ? "min-w-44" : MONEY_COLS.includes(k) ? "min-w-28" : "min-w-20"}`}
                        >
                          {segCell(s, k)}
                        </td>
                      ))}
                      {showReal && (
                        <>
                          <td className="whitespace-nowrap bg-signal/5 px-3 py-2">
                            <FigureValue f={segAcvOf(s)} show={(n) => money(Math.round(n), true)} />
                            <FigureNote f={segAcvOf(s)} className="block text-xs" />
                          </td>
                          <td className="whitespace-nowrap bg-signal/5 px-3 py-2">
                            <FigureValue f={winRealOf(real.bySegment[s.id]?.winRate)} show={pct} />
                          </td>
                          <td className="whitespace-nowrap bg-signal/5 px-3 py-2">
                            {days(real.bySegment[s.id]?.cycleDays)}
                          </td>
                          {isOwner && (
                            <td className="px-2 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                aria-label={`Eliminar ${s.name}`}
                                onClick={() => setToDelete({ id: s.id, name: s.name })}
                              >
                                <IconText icon={Trash2}>Eliminar</IconText>
                              </Button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">
          Los importes están en {CURRENCIES[currency] ?? currency}. Cambiar la moneda no convierte
          las cifras: revisa tus benchmarks después. Las columnas «real» salen de tu pipeline (el
          ACV, de todo el histórico; el win rate y el ciclo, de los últimos 365 días) y se
          actualizan solas. Un win rate o una cuota de 0 vale para un segmento al que no vendes; si
          no es tuyo, elimínalo{isOwner ? "" : " (solo el Owner)"}. La mayoría de empresas combinan
          varios motions: empiezan con uno y añaden otro al escalar.
        </p>
        {segs.some((s) => s.notes?.trim()) && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-signal">
              Notas y fuentes de los segmentos
            </summary>
            <div className="mt-2 space-y-2">
              {segs
                .filter((s) => s.notes?.trim())
                .map((s) => (
                  <p key={s.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{s.name}.</span> {s.notes}
                  </p>
                ))}
            </div>
          </details>
        )}
      </div>
      <DeleteElement
        kind="segment"
        target={toDelete}
        onClose={() => setToDelete(null)}
        onDone={() => {
          setForced("");
          qc.invalidateQueries();
        }}
      />
    </div>
  );
}
