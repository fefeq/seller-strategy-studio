import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Page, Empty } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { capacityPlan, matchSegment, MOTIONS, recommendMotion, type Motion } from "@/lib/metrics";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { useCurrency, useMe } from "@/hooks/use-me";
import { lastQuarters, segmentActuals, trailingCac } from "@/lib/pipeline-real";
import type { SegLike } from "@/lib/segment-coverage";
import { annualFromQuarters, marginFor, quartersOfYear } from "@/lib/segment-budget";
import { BudgetQuarters } from "@/components/budget-quarters";
import { PaybackQuarters } from "@/components/payback-quarters";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { mergeServerEdits } from "@/lib/merge-edits";
import { keepApprovals, positioningStatement, STATEMENT_SLOTS, type CopyStatus } from "@/lib/positioning";
import { checkAcvRange, checkSegmentField, type SegmentNumericField } from "@/lib/segment-fields";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STRATEGY_TABS = ["motions", "payback", "budget", "icp", "positioning", "pillars"] as const;

export const Route = createFileRoute("/_authenticated/strategy")({
  validateSearch: (s: Record<string, unknown>): { tab?: (typeof STRATEGY_TABS)[number] } =>
    STRATEGY_TABS.includes(s.tab as (typeof STRATEGY_TABS)[number]) ? { tab: s.tab as (typeof STRATEGY_TABS)[number] } : {},
  head: () => ({ meta: [{ title: "Estrategia GTM — Nokko" }, { name: "description", content: "Modelos de venta por segmento, ICP y posicionamiento." }, { property: "og:title", content: "Estrategia GTM — Nokko" }, { property: "og:description", content: "Modelos de venta por segmento, ICP y posicionamiento." }] }),
  component: Strategy,
});

const MOTION_OPTS = Object.fromEntries(Object.entries(MOTIONS).map(([k, v]) => [k, v.label]));

function Strategy() {
  const { tab } = Route.useSearch();
  return (
    <Page eyebrow="Capa estratégica" title="Estrategia GTM">
      <Tabs key={tab ?? "motions"} defaultValue={tab ?? "motions"}>
        <TabsList className="mb-6">
          <TabsTrigger value="motions">Modelos de venta por segmento</TabsTrigger>
          <TabsTrigger value="payback">Payback real</TabsTrigger>
          <TabsTrigger value="budget">Presupuesto vs real</TabsTrigger>
          <TabsTrigger value="icp">ICP</TabsTrigger>
          <TabsTrigger value="positioning">Posicionamiento</TabsTrigger>
          <TabsTrigger value="pillars">Mensajes</TabsTrigger>
        </TabsList>
        <TabsContent value="motions"><Motions /></TabsContent>
        <TabsContent value="payback"><PaybackQuarters /></TabsContent>
        <TabsContent value="budget"><BudgetQuarters /></TabsContent>
        <TabsContent value="icp"><Icp /></TabsContent>
        <TabsContent value="positioning"><Positioning /></TabsContent>
        <TabsContent value="pillars"><Pillars /></TabsContent>
      </Tabs>
    </Page>
  );
}

const MONEY_COLS = ["acv_min", "acv_max", "cac_target", "ae_quota"];
const SEG_LABEL: Record<string, string> = {
  priority: "Prioridad", acv_min: "ACV mín", acv_max: "ACV máx", motion: "Modelo de venta", cycle_days: "Ciclo (días)",
  sdr_per_ae: "SDR por AE", ae_per_se: "AE por SE", win_rate_target: "Win rate obj. %", ae_quota: "Cuota anual AE",
  cac_target: "CAC objetivo", gross_margin_pct: "Margen bruto %", payback_months: "Payback obj. (m)",
};
// [title, columns, show the «real» columns and actions in this block]
const SEG_GROUPS = [
  ["Económicos", ["priority", "acv_min", "acv_max", "win_rate_target", "ae_quota", "cac_target", "gross_margin_pct", "payback_months"], true],
  ["Modelo de venta y capacidad", ["motion", "cycle_days", "sdr_per_ae", "ae_per_se"], false],
] as const;
const SEG_COLS = [
  ["priority", "Prioridad"], ["acv_min", "ACV mín"], ["acv_max", "ACV máx"], ["motion", "Modelo de venta"], ["cycle_days", "Ciclo (días)"],
  ["sdr_per_ae", "SDR por AE"], ["ae_per_se", "AE por SE"], ["win_rate_target", "Win rate obj. %"], ["ae_quota", "Cuota anual AE"],
  ["cac_target", "CAC objetivo"], ["gross_margin_pct", "Margen bruto %"], ["payback_months", "Payback obj. (m)"],
] as const;

function rangeText(r: [number, number | null] | null, fmt: (n: number) => string) {
  if (!r) return "—";
  return r[1] == null ? `${fmt(r[0])}+` : `${fmt(r[0])}–${fmt(r[1])}`;
}

function Motions() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { currency, symbol, money } = useCurrency();
  const isOwner = me?.roles.includes("owner");
  const [acvManual, setAcvManual] = useState<number | null>(null);
  const [basis, setBasis] = useState<"target" | "real">("target");
  const [forced, setForced] = useState("");
  // Ranked segments first (1, 2, 3…), then the rest by ACV.
  const { data: segs = [] } = useQuery({ queryKey: ["segments"], queryFn: async () => (await supabase.from("segments").select("*").order("priority", { ascending: true, nullsFirst: false }).order("acv_min")).data ?? [] });
  const { data: deals = [] } = useQuery({ queryKey: ["deals-real"], queryFn: async () => (await supabase.from("deals").select("gross_margin,segment_id,amount,stage,close_date,closed_at,updated_at,created_at")).data ?? [] });
  const { data: costs = [] } = useQuery({ queryKey: ["segment-coverage", "cac-12m"], queryFn: async () => (await supabase.from("cac_costs").select("segment_id,channel,amount,period").in("period", lastQuarters())).data ?? [] });
  const year = new Date().getFullYear();
  const { data: budgetRows = [] } = useQuery({ queryKey: ["segment-coverage", "budget-quarters", year], queryFn: async () => (await supabase.from("segment_budget_quarters").select("*").in("period", quartersOfYear(year))).data ?? [] });
  const budgets = useMemo(() => annualFromQuarters(budgetRows, year), [budgetRows, year]);
  const real = useMemo(() => segmentActuals(segs as SegLike[], deals), [segs, deals]);
  const cacReal = useMemo(() => trailingCac(segs as SegLike[], deals, costs), [segs, deals, costs]);
  // The ACV follows the real pipeline until the user types their own value; without deals it starts
  // from the middle of the company's own segment ranges, and only with neither from a generic 20.000.
  const ownAcv = useMemo(() => {
    const mids = segs.filter((s) => s.acv_min != null && s.acv_max != null).map((s) => (Number(s.acv_min) + Number(s.acv_max)) / 2);
    return mids.length ? Math.round(mids.reduce((a, b) => a + b, 0) / mids.length) : null;
  }, [segs]);
  const acv = acvManual ?? (real.overall.acv != null ? Math.round(real.overall.acv) : ownAcv ?? 20000);
  const seg = forced ? segs.find((s) => s.id === forced) : matchSegment(acv, segs);
  const segReal = seg ? real.bySegment[seg.id] : undefined;
  const segCac = seg ? cacReal[seg.id] : undefined;
  // Margin of this year's budget (real → plan) before the segment's target margin.
  const margin = seg ? marginFor(seg as SegLike, budgets.find((b) => b.segment_id === seg.id)) : { pct: null, source: null };
  const rec = recommendMotion(acv);
  const winUsed = basis === "real" && segReal?.winRate != null ? segReal.winRate : seg?.win_rate_target;
  const cacUsed = basis === "real" && segCac?.cac != null ? segCac.cac : seg?.cac_target;
  const plan = capacityPlan({ acv, quota: seg?.ae_quota, winRatePct: winUsed, cac: cacUsed, grossMarginPct: margin.pct });
  // Real payback = real CAC over the real ACV of the segment (falls back to the calculator's ACV).
  const paybackReal = segCac?.cac != null ? capacityPlan({ acv: segReal?.acv ?? acv, cac: segCac.cac, grossMarginPct: margin.pct }).paybackMonths : null;
  const missing = seg ? [!seg.ae_quota && "cuota anual AE", !winUsed && "win rate objetivo", !cacUsed && "CAC objetivo"].filter(Boolean) : [];
  const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
  const days = (n: number | null | undefined) => (n == null ? "—" : `${n} días`);

  // Cells whose last value was refused, so the person sees which one to fix.
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  async function upd(id: string, patch: Record<string, unknown>) {
    try {
      await confirmed(supabase.from("segments").update(patch as any).eq("id", id).select("id"));
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
  async function updNumber(s: (typeof segs)[number], k: SegmentNumericField, input: HTMLInputElement) {
    const cell = `${s.id}:${k}`;
    const previous = (s as any)[k];
    const check = checkSegmentField(k, input.value, s.name);
    const next = check.ok ? check.value : null;
    const rangeError = check.ok
      ? checkAcvRange(k === "acv_min" ? next : (s as any).acv_min, k === "acv_max" ? next : (s as any).acv_max, s.name)
      : null;
    const error = !check.ok ? check.error : rangeError;
    if (error) {
      setInvalid((m) => ({ ...m, [cell]: error }));
      toast.error(`${error} No se ha guardado.`);
      input.value = previous == null ? "" : String(previous);
      return;
    }
    setInvalid((m) => { const { [cell]: _, ...rest } = m; return rest; });
    if ((previous == null ? null : Number(previous)) === next) return;
    if (!(await upd(s.id, { [k]: next }))) input.value = previous == null ? "" : String(previous);
  }
  async function add() {
    try { await confirmed(supabase.from("segments").insert({ name: "Nuevo segmento" }).select("id")); }
    catch (e) { toast.error(errorText(e)); }
    qc.invalidateQueries({ queryKey: ["segments"] }); qc.invalidateQueries({ queryKey: ["setup"] });
  }
  async function setCurrency(c: string) {
    const { error } = await supabase.from("organizations").update({ currency: c }).eq("id", me!.currentOrg!.org_id);
    if (error) return toast.error(errorText(error));
    await qc.invalidateQueries({ queryKey: ["me"] });
    toast.success(`Moneda: ${CURRENCIES[c]}. Las cifras no se han convertido: revisa importes y benchmarks.`);
  }
  const fmt1 = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-ES", { maximumFractionDigits: 1 }));
  // One editable cell, shared by the mobile cards and the desktop table.
  const segCell = (s: (typeof segs)[number], k: (typeof SEG_COLS)[number][0]) => {
    if (k === "motion") {
      const suggested = recommendMotion(Number(s.acv_min ?? 0));
      return <>
        <Pick value={s.motion} options={MOTION_OPTS} onChange={(v) => upd(s.id, { motion: v })} />
        {s.motion !== suggested && <p className="mt-1 text-[11px] text-muted-foreground">Referencia de mercado: {MOTIONS[suggested].label}</p>}
      </>;
    }
    const error = invalid[`${s.id}:${k}`];
    return <>
      {/* Text with a decimal keyboard, not type=number: a number field hands back "" for «97,5» in some browsers, which read as «empty» and wiped the value. */}
      <Input type="text" inputMode="decimal" aria-invalid={!!error} title={error} defaultValue={(s as any)[k] ?? ""} onFocus={(e) => e.currentTarget.select()} onBlur={(e) => updNumber(s, k, e.currentTarget)} />
      {error && <p className="mt-1 text-[11px] text-destructive md:hidden">{error}</p>}
    </>;
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 rounded-lg border bg-card p-6 md:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <p className="eyebrow">Calculadora de estrategia GTM</p>
          <Field label="Moneda de la empresa">
            {isOwner ? <>
              <Pick value={currency} options={CURRENCIES} onChange={setCurrency} />
              <p className="text-xs text-muted-foreground">Cambiarla solo cambia el símbolo: no convierte ninguna cifra. Revisa importes y benchmarks después.</p>
            </> : <p className="text-sm">{CURRENCIES[currency] ?? currency} <span className="text-xs text-muted-foreground">· solo el Owner la cambia</span></p>}
          </Field>
          <Field label={`Valor anual del contrato (ACV, ${symbol})`}>
            <Input type="number" value={acv} onChange={(e) => setAcvManual(Number(e.target.value))} />
            {real.overall.acv != null ? (
              acvManual == null
                ? <p className="text-xs text-success">ACV real: media de {real.overall.acvSample} {real.overall.acvSample === 1 ? `deal ${real.overall.acvSource === "ganados" ? "ganado" : "abierto"}` : `deals ${real.overall.acvSource}`}. Se actualiza solo cuando entran leads.</p>
                : <button className="text-xs text-signal underline-offset-2 hover:underline" onClick={() => setAcvManual(null)}>Volver al ACV real ({money(Math.round(real.overall.acv))})</button>
            ) : <p className="text-xs text-muted-foreground">Sin deals con importe todavía: {acvManual == null && ownAcv != null ? "media de los rangos de ACV de tus segmentos" : "valor de ejemplo"}. <Link to="/leads/entrada" className="underline">Conecta tus leads</Link>.</p>}
          </Field>
          <Field label="Calcular con">
            <Pick value={basis} options={{ target: "Benchmarks objetivo del segmento", real: "Datos reales de la pipeline" }} onChange={(v) => setBasis(v as "target" | "real")} />
          </Field>
          <Field label="Segmento"><Pick value={forced} options={Object.fromEntries([["", "Automático según ACV"], ...segs.map((s) => [s.id, s.name])])} onChange={setForced} /></Field>
        </div>
        {seg ? (
          <div>
            <p className="eyebrow">Segmento · {seg.name}</p>
            <p className="font-display text-4xl text-signal">{MOTIONS[seg.motion as Motion]?.label ?? seg.motion}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Ciclo de venta</dt><dd>{seg.cycle_days ? `${seg.cycle_days} días` : "—"}</dd>
              <dt className="text-muted-foreground">Equipo</dt><dd>{[seg.sdr_per_ae && `${seg.sdr_per_ae} SDR por AE`, seg.ae_per_se && `${seg.ae_per_se} AE por SE`].filter(Boolean).join(" · ") || "—"}</dd>
              <dt className="text-muted-foreground">Win rate objetivo</dt><dd>{seg.win_rate_target ? `${seg.win_rate_target}%` : "—"}</dd>
              <dt className="text-muted-foreground">Cuota anual por AE</dt><dd>{seg.ae_quota ? money(Number(seg.ae_quota)) : "—"}</dd>
              <dt className="text-muted-foreground">CAC objetivo</dt><dd>{seg.cac_target ? money(Number(seg.cac_target)) : "—"}</dd>
              <dt className="text-muted-foreground">Payback objetivo</dt><dd>{seg.payback_months ? `${seg.payback_months} meses` : "—"}</dd>
            </dl>
            <div className="mt-4 overflow-hidden rounded-md border text-sm">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 bg-muted/50 px-3 py-1.5"><span className="eyebrow text-[10px]">Real vs objetivo · {seg.name}</span><span className="eyebrow text-[10px]">Real (12 meses)</span><span className="eyebrow text-[10px]">Objetivo</span></div>
              {[
                ["ACV", segReal?.acv != null ? `${money(Math.round(segReal.acv))} · ${segReal.acvSample} ${segReal.acvSample === 1 ? "deal" : "deals"}` : "—", seg.acv_min != null ? `${money(Number(seg.acv_min), true)}–${seg.acv_max != null ? money(Number(seg.acv_max), true) : "∞"}` : "—"],
                ["Win rate", segReal?.winRate != null ? `${pct(segReal.winRate)} · ${segReal.closedSample} ${segReal.closedSample === 1 ? "cerrado" : "cerrados"}` : "—", pct(seg.win_rate_target)],
                ["Ciclo de venta", segReal?.cycleDays != null ? `${days(segReal.cycleDays)} · ${segReal.cycleSample} ${segReal.cycleSample === 1 ? "ganado" : "ganados"}` : "—", days(seg.cycle_days)],
                ["CAC", segCac?.cac != null ? `${money(Math.round(segCac.cac))} · ${segCac.customers} ${segCac.customers === 1 ? "ganado" : "ganados"}` : segCac?.cost ? `${money(Math.round(segCac.cost))} gastado · 0 ganados` : "—", seg.cac_target ? money(Number(seg.cac_target)) : "—"],
                ["Payback", paybackReal != null ? `${fmt1(paybackReal)} m` : "—", seg.payback_months ? `${seg.payback_months} m` : "—"],
              ].map(([l, r, t]) => (
                <div key={l} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 border-t px-3 py-1.5"><span className="break-words text-muted-foreground">{l}</span><span className="break-words">{r}</span><span className="break-words">{t}</span></div>
              ))}
            </div>
            {segCac?.cac == null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {segCac?.cost ? "Hay costes, pero ningún deal ganado en los últimos 12 meses en este segmento: aún no hay CAC real." : <>Para ver el CAC y el payback reales, introduce los costes por canal en <Link to="/metrics" className="underline">Métricas → CAC real</Link>.</>}
              </p>
            )}
            {basis === "real" && <p className="mt-2 text-xs text-muted-foreground">{segReal?.winRate != null ? `La capacidad usa el win rate real (${pct(segReal.winRate)}).` : "Aún no hay deals cerrados en este segmento: la capacidad usa el win rate objetivo."} {segCac?.cac != null ? `El payback usa el CAC real (${money(Math.round(segCac.cac))}).` : "El payback usa el CAC objetivo."}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Deals por AE / año", plan.dealsPerYear != null ? fmt1(Math.ceil(plan.dealsPerYear)) : "—"],
                ["Oportunidades por AE / año", plan.oppsPerYear != null ? fmt1(Math.ceil(plan.oppsPerYear)) : "—"],
                ["Oportunidades por AE / mes", fmt1(plan.oppsPerMonth)],
                [basis === "real" && segCac?.cac != null ? "Payback real" : "Payback estimado", plan.paybackMonths != null ? `${fmt1(plan.paybackMonths)} m` : "—"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md bg-muted/50 p-3"><p className="eyebrow text-[10px]">{l}</p><p className="font-display text-2xl">{v}</p></div>
              ))}
            </div>
            {plan.paybackMonths != null && seg.payback_months && (
              <p className={`mt-2 text-xs ${plan.paybackMonths <= Number(seg.payback_months) ? "text-success" : "text-destructive"}`}>
                {plan.paybackMonths <= Number(seg.payback_months) ? "Dentro" : "Fuera"} del payback objetivo de {seg.payback_months} meses (margen bruto {margin.pct != null ? Math.round(margin.pct) : 100}%{margin.source === "real" ? `, real de ${year}` : margin.source === "plan" ? `, presupuestado ${year}` : ""}).
              </p>
            )}
            {missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Completa {missing.join(", ")} en la tabla de segmentos para calcular la capacidad.</p>}
          </div>
        ) : (
          <div>
            <p className="eyebrow">Ningún segmento tuyo cubre este ACV · referencia de mercado</p>
            <p className="font-display text-4xl text-signal">{MOTIONS[rec].label}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Ciclo de venta</dt><dd>{MOTIONS[rec].cycle}</dd>
              <dt className="text-muted-foreground">Equipo</dt><dd>{MOTIONS[rec].team}</dd>
              <dt className="text-muted-foreground">CAC típico</dt><dd>{rangeText(MOTIONS[rec].cac, (n) => formatMoney(n, "USD", true))}</dd>
              <dt className="text-muted-foreground">Cuota AE típica</dt><dd>{rangeText(MOTIONS[rec].quota, (n) => formatMoney(n, "USD", true))}</dd>
              <dt className="text-muted-foreground">Payback</dt><dd>{MOTIONS[rec].payback}</dd>
              <dt className="text-muted-foreground">Se mide por</dt><dd>{MOTIONS[rec].efficiency}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Referencia general en dólares (guía de Tom Tunguz). Crea o ajusta un segmento con este rango de ACV para usar tus propios datos.</p>
          </div>
        )}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="min-w-0 text-3xl">Tus segmentos y benchmarks</h3><Button size="sm" className="shrink-0" onClick={add}>+ Segmento</Button></div>
        <div className="divide-y divide-hairline border-t border-hairline md:hidden">
          {segs.map((s) => (
            <div key={s.id} className={`space-y-3 py-4 ${seg?.id === s.id ? "bg-signal/5" : ""}`}>
              <Field label="Segmento"><Input defaultValue={s.name} onBlur={(e) => upd(s.id, { name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                {SEG_COLS.map(([k, h]) => (
                  <div key={k} className={k === "motion" ? "col-span-2" : "min-w-0"}>
                    <Field label={`${h}${MONEY_COLS.includes(k) ? ` (${symbol})` : ""}`}>{segCell(s, k)}</Field>
                  </div>
                ))}
              </div>
              <dl className="grid grid-cols-3 gap-2 bg-signal/5 px-2 py-2 text-sm">
                <div className="min-w-0"><dt className="eyebrow text-[10px]">ACV real</dt><dd className="break-words">{real.bySegment[s.id]?.acv != null ? money(Math.round(real.bySegment[s.id].acv!), true) : "—"}</dd></div>
                <div className="min-w-0"><dt className="eyebrow text-[10px]">Win rate real</dt><dd>{pct(real.bySegment[s.id]?.winRate)}</dd></div>
                <div className="min-w-0"><dt className="eyebrow text-[10px]">Ciclo real</dt><dd>{days(real.bySegment[s.id]?.cycleDays)}</dd></div>
              </dl>
              {isOwner && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete({ id: s.id, name: s.name })}>Eliminar segmento</Button>}
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
                <thead className="border-b bg-muted/50 text-left"><tr><th className="eyebrow sticky left-0 z-10 border-r bg-background px-3 py-3">Segmento</th>{keys.map((k) => <th key={k} className="eyebrow whitespace-nowrap px-3 py-3">{SEG_LABEL[k]}{MONEY_COLS.includes(k) ? ` (${symbol})` : ""}</th>)}{showReal && ["ACV real", "Win rate real", "Ciclo real"].map((h) => <th key={h} className="eyebrow whitespace-nowrap bg-signal/5 px-3 py-3">{h}</th>)}{showReal && isOwner && <th className="px-3 py-3"><span className="sr-only">Acciones</span></th>}</tr></thead>
                <tbody>
                  {segs.map((s) => (
                    <tr key={s.id} className={`border-b last:border-0 ${seg?.id === s.id ? "bg-signal/5" : ""}`}>
                      <td className="sticky left-0 z-10 min-w-40 border-r bg-background px-2 py-2">{showReal ? <Input aria-label="Nombre del segmento" defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && upd(s.id, { name: e.target.value.trim() })} /> : <span className="block px-1 font-medium">{s.name}</span>}</td>
                      {keys.map((k) => (
                        <td key={k} className={`px-2 py-2 ${k === "motion" ? "min-w-44" : MONEY_COLS.includes(k) ? "min-w-28" : "min-w-20"}`}>{segCell(s, k)}</td>
                      ))}
                      {showReal && <>
                        <td className="whitespace-nowrap bg-signal/5 px-3 py-2">{real.bySegment[s.id]?.acv != null ? money(Math.round(real.bySegment[s.id].acv!), true) : "—"}</td>
                        <td className="whitespace-nowrap bg-signal/5 px-3 py-2">{pct(real.bySegment[s.id]?.winRate)}</td>
                        <td className="whitespace-nowrap bg-signal/5 px-3 py-2">{days(real.bySegment[s.id]?.cycleDays)}</td>
                        {isOwner && <td className="px-2 py-2"><Button variant="ghost" size="sm" className="text-destructive" aria-label={`Eliminar ${s.name}`} onClick={() => setToDelete({ id: s.id, name: s.name })}>Eliminar</Button></td>}
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">Los importes están en {CURRENCIES[currency] ?? currency}. Cambiar la moneda no convierte las cifras: revisa tus benchmarks después. Las columnas «real» salen de tu pipeline de los últimos 12 meses y se actualizan solas. Un win rate o una cuota de 0 vale para un segmento al que no vendes; si no es tuyo, elimínalo{isOwner ? "" : " (solo el Owner)"}. La mayoría de empresas combinan varios motions: empiezan con uno y añaden otro al escalar.</p>
        {segs.some((s) => s.notes?.trim()) && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-signal">De dónde salen estos benchmarks</summary>
            <div className="mt-2 space-y-2">
              {segs.filter((s) => s.notes?.trim()).map((s) => (
                <p key={s.id} className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{s.name}.</span> {s.notes}</p>
              ))}
            </div>
          </details>
        )}
      </div>
      <DeleteSegment target={toDelete} onClose={() => setToDelete(null)} onDeleted={() => { setForced(""); qc.invalidateQueries(); }} />
    </div>
  );
}

/** What deleting a segment does to the rest of the data, counted before the person confirms. */
const KEPT_WITHOUT_SEGMENT = [["deals", "deals"], ["accounts", "cuentas"], ["leads", "leads"], ["icp_profiles", "ICP"], ["trials", "pruebas"]] as const;
const DELETED_WITH_SEGMENT = [["segment_targets", "objetivos"], ["cac_costs", "costes de CAC"], ["segment_budget_quarters", "trimestres de presupuesto"]] as const;

function DeleteSegment({ target, onClose, onDeleted }: { target: { id: string; name: string } | null; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const { data: impact } = useQuery({
    queryKey: ["segment-impact", target?.id],
    enabled: !!target,
    queryFn: async () => {
      const count = async (table: string) => (await supabase.from(table as any).select("id", { count: "exact", head: true }).eq("segment_id", target!.id)).count ?? 0;
      const [kept, gone] = await Promise.all([
        Promise.all(KEPT_WITHOUT_SEGMENT.map(async ([t, l]) => [l, await count(t)] as const)),
        Promise.all(DELETED_WITH_SEGMENT.map(async ([t, l]) => [l, await count(t)] as const)),
      ]);
      return { kept: kept.filter(([, n]) => n > 0), gone: gone.filter(([, n]) => n > 0) };
    },
  });
  async function remove() {
    if (!target) return;
    setBusy(true);
    try {
      await confirmed(supabase.from("segments").delete().eq("id", target.id).select("id"));
      toast.success(`Segmento «${target.name}» eliminado.`);
      onDeleted();
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const list = (xs: readonly (readonly [string, number])[]) => xs.map(([l, n]) => `${n} ${l}`).join(", ");
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar el segmento «{target?.name}»?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              {!impact ? <p>Comprobando qué datos dependen de este segmento…</p> : (
                <>
                  {impact.kept.length === 0 && impact.gone.length === 0 && <p>No hay datos asociados. Deja de contar en la configuración, las métricas y los selectores.</p>}
                  {impact.kept.length > 0 && <p>Se quedan sin segmento, pero no se borran: {list(impact.kept)}.</p>}
                  {impact.gone.length > 0 && <p className="text-destructive">Se borran con él: {list(impact.gone)}.</p>}
                  <p>No se puede deshacer.</p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy || !impact} onClick={(e) => { e.preventDefault(); remove(); }} className="bg-destructive text-destructive-foreground">
            {busy ? "Eliminando…" : "Eliminar segmento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const ICP_FIELDS = [
  ["industries", "Industrias", "Firmográfico"], ["company_size", "Tamaño (empleados, facturación)", "Firmográfico"],
  ["geography", "Geografía", "Firmográfico"], ["tech_stack", "Stack tecnológico", "Firmográfico"],
  ["growth_stage", "Etapa de crecimiento", "Señal"], ["hiring_signals", "Señales de contratación", "Señal"],
  ["funding_signals", "Rondas / eventos de financiación", "Señal"], ["adoption", "Adopción tecnológica (early / late)", "Señal"],
  ["why_fit", "Por qué encajan (cierran rápido, usan más, renuevan)", "Fit"], ["anti_icp", "Anti-ICP: a quién no venderle", "Fit"],
] as const;

function Icp() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<any | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const selId = sel?.id;
  // Below lg the editor sits under the list: bring it into view when an ICP is picked.
  useEffect(() => {
    if (selId && typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selId]);
  const { data } = useQuery({
    queryKey: ["icp"],
    queryFn: async () => {
      const [i, s] = await Promise.all([supabase.from("icp_profiles").select("*").order("created_at"), supabase.from("segments").select("id,name")]);
      return { icps: i.data ?? [], segs: s.data ?? [] };
    },
  });
  async function add() {
    const { data: r } = await supabase.from("icp_profiles").insert({ name: "Nuevo ICP" }).select().single();
    setSel(r); qc.invalidateQueries({ queryKey: ["icp"] });
  }
  async function save() {
    const { id, created_at, updated_at, created_by, updated_by, ...rest } = sel;
    try { await confirmed(supabase.from("icp_profiles").update({ ...rest, segment_id: rest.segment_id || null }).eq("id", id).select("id")); }
    catch (e) { return toast.error(errorText(e)); }
    toast.success("ICP guardado."); qc.invalidateQueries({ queryKey: ["icp"] }); qc.invalidateQueries({ queryKey: ["setup"] });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>+ ICP</Button>
        {data?.icps.map((i) => (
          <button key={i.id} onClick={() => setSel(i)} className={`block w-full break-words rounded-md border bg-card p-3 text-left text-sm ${sel?.id === i.id ? "border-signal" : ""}`}>{i.name}</button>
        ))}
      </div>
      {sel ? (
        <div ref={detailRef} className="min-w-0 scroll-mt-20 space-y-4 rounded-lg border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre"><Input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} /></Field>
            <Field label="Segmento"><Pick value={sel.segment_id ?? ""} options={Object.fromEntries([["", "—"], ...(data?.segs ?? []).map((s) => [s.id, s.name])])} onChange={(v) => setSel({ ...sel, segment_id: v })} /></Field>
          </div>
          {["Firmográfico", "Señal", "Fit"].map((g) => (
            <div key={g}>
              <p className="eyebrow mb-2">{g === "Señal" ? "Señales de comportamiento" : g === "Fit" ? "Encaje" : "Criterios firmográficos"}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {ICP_FIELDS.filter((f) => f[2] === g).map(([k, label]) => (
                  <Field key={k} label={label}><Textarea rows={2} value={sel[k] ?? ""} onChange={(e) => setSel({ ...sel, [k]: e.target.value })} /></Field>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={save}>Guardar ICP</Button>
        </div>
      ) : <Empty>Define tu ICP analizando a tus mejores clientes: quién cierra más rápido, usa más el producto y renueva.</Empty>}
    </div>
  );
}

const DUNFORD = [
  ["best_customers", "1. Tus mejores clientes", "¿Quién ama el producto y por qué?"],
  ["alternatives", "2. Alternativas competitivas", "¿Qué harían si no existiéramos? (incl. no hacer nada, Excel)"],
  ["differentiation", "3. Diferenciación", "Capacidades únicas que las alternativas no tienen"],
  ["value", "4. Valor", "Qué consiguen gracias a esa diferenciación"],
  ["trend", "5. Tendencia", "La ola de mercado sobre la que nos subimos"],
] as const;
const STATEMENT = [
  ["target_customer", "Cliente objetivo"], ["need", "Necesidad / dolor"], ["product_name", "Producto"], ["category", "Categoría"],
  ["key_benefit", "Beneficio clave"], ["competitive_alternative", "Alternativa competitiva"], ["differentiator", "Diferenciador"],
] as const;
const HIERARCHY = [
  ["tagline", "Tagline (5–10 palabras)", 1], ["one_liner", "Una frase: qué hacemos", 2],
  ["short_pitch", "Pitch corto (problema, solución, prueba)", 3], ["elevator_pitch", "Elevator pitch (30–60 s)", 5],
] as const;

function Positioning() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canApprove = (me?.roles ?? []).some((r) => r === "owner" || r === "sales_leader");
  const { data: row } = useQuery({ queryKey: ["positioning"], queryFn: async () => (await supabase.from("positioning").select("*").order("created_at").limit(1).maybeSingle()).data });
  const [f, setF] = useState<Record<string, any>>({});
  // A refresh (after approving a text, or another person's save) keeps what the person is typing.
  const prevRow = useRef<Record<string, any> | null>(null);
  useEffect(() => {
    if (!row) return;
    setF((cur) => (prevRow.current ? mergeServerEdits(cur, prevRow.current, row as any) : (row as any)));
    prevRow.current = row as any;
  }, [row]);
  const copyStatus = ((row as any)?.copy_status ?? {}) as CopyStatus;
  async function save() {
    const { id, created_at, updated_at, created_by, updated_by, copy_status: _cs, ...rest } = f as any;
    // A public piece whose text changed goes back to internal draft.
    const kept = keepApprovals(copyStatus, (row ?? {}) as Record<string, unknown>, rest);
    try { await confirmed(row ? supabase.from("positioning").update({ ...rest, copy_status: kept }).eq("id", row.id).select("id") : supabase.from("positioning").insert(rest).select("id")); }
    catch (e) { return toast.error(errorText(e)); }
    toast.success(Object.keys(kept).length < Object.keys(copyStatus).length ? "Posicionamiento guardado. Los textos públicos que has cambiado vuelven a borrador." : "Posicionamiento guardado.");
    qc.invalidateQueries({ queryKey: ["positioning"] }); qc.invalidateQueries({ queryKey: ["setup"] });
  }
  async function setApproval(k: string, approve: boolean) {
    if (!row) return;
    if (approve && (f[k] ?? "") !== ((row as any)[k] ?? "")) return toast.error("Guarda el texto antes de aprobarlo.");
    const next: CopyStatus = { ...copyStatus };
    if (approve) next[k] = { status: "approved", by: me?.user.id ?? null, at: new Date().toISOString() };
    else delete next[k];
    try { await confirmed(supabase.from("positioning").update({ copy_status: next }).eq("id", row.id).select("id")); }
    catch (e) { return toast.error(errorText(e)); }
    qc.invalidateQueries({ queryKey: ["positioning"] });
  }
  const placeholder = (k: string) => `[${STATEMENT.find((s) => s[0] === k)?.[1].toLowerCase()}]`;
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-3xl">Marco de April Dunford</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {DUNFORD.map(([k, l, h]) => <Field key={k} label={l}><Textarea rows={3} placeholder={h} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
        </div>
      </div>
      <div>
        <h3 className="text-3xl">Frase de posicionamiento</h3>
        <p className="mt-1 text-xs text-muted-foreground">Cada campo es un trozo de la frase, no una frase entera: escribe en minúscula y sin punto final. Debajo de cada uno ves dónde encaja.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {STATEMENT.map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">{STATEMENT_SLOTS[k].before} <span className="text-foreground">[{l.toLowerCase()}]</span> {STATEMENT_SLOTS[k].after}</p>
            </Field>
          ))}
        </div>
        <blockquote className="mt-4 border-l-4 border-signal bg-card p-5 font-display text-2xl leading-snug">
          {positioningStatement(f, placeholder)}
        </blockquote>
      </div>
      <div>
        <h3 className="text-3xl">Jerarquía de la propuesta de valor</h3>
        <p className="mt-1 text-xs text-muted-foreground">Estos textos pueden acabar en la web o en anuncios. Son borrador interno hasta que alguien con rol de Owner o Sales Leader los apruebe para uso externo; si cambias uno aprobado, vuelve a borrador.</p>
        <div className="mt-3 space-y-3">
          {HIERARCHY.map(([k, l, rows]) => {
            const st = copyStatus[k];
            return (
              <Field key={k} label={l}>
                <Textarea rows={rows} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`rounded px-1.5 py-0.5 font-mono uppercase ${st ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{st ? "Aprobado para uso externo" : "Borrador interno"}</span>
                  {st && <span className="text-muted-foreground">{new Date(st.at).toLocaleDateString("es-ES")}</span>}
                  {canApprove && row && (f[k] ?? "").trim() && <button type="button" className="underline-offset-2 hover:underline" onClick={() => setApproval(k, !st)}>{st ? "Retirar aprobación" : "Aprobar para uso externo"}</button>}
                </div>
              </Field>
            );
          })}
        </div>
      </div>
      <Button onClick={save}>Guardar posicionamiento</Button>
      <p className="text-xs text-muted-foreground">La IA usa este posicionamiento al preparar reuniones, investigar stakeholders y redactar propuestas.</p>
    </div>
  );
}

function Pillars() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({ queryKey: ["pillars"], queryFn: async () => (await supabase.from("messaging_pillars").select("*").order("position")).data ?? [] });
  async function add() {
    await supabase.from("messaging_pillars").insert({ title: "Nuevo pilar", position: list.length });
    qc.invalidateQueries({ queryKey: ["pillars"] });
  }
  async function upd(id: string, patch: Record<string, string>) {
    try { await confirmed(supabase.from("messaging_pillars").update(patch as any).eq("id", id).select("id")); }
    catch (e) { toast.error(errorText(e)); }
    qc.invalidateQueries({ queryKey: ["pillars"] }); qc.invalidateQueries({ queryKey: ["setup"] });
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted-foreground">3–5 pilares. Cada uno responde a un dolor y se apoya en pruebas: funcionalidades, casos de cliente, datos.</p>
        <Button size="sm" className="shrink-0" onClick={add} disabled={list.length >= 5}>+ Pilar</Button>
      </div>
      {list.length === 0 && <Empty>Sin pilares todavía. Crea el primero con «+ Pilar».</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p, i) => (
          <div key={p.id} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2"><span className="font-mono text-xs text-signal">0{i + 1}</span><Input className="font-display md:text-[22px]" defaultValue={p.title} onBlur={(e) => upd(p.id, { title: e.target.value })} /></div>
            <Field label="Dolor que resuelve"><Textarea rows={2} defaultValue={p.pain ?? ""} onBlur={(e) => upd(p.id, { pain: e.target.value })} /></Field>
            <Field label="Mensaje"><Textarea rows={2} defaultValue={p.message ?? ""} onBlur={(e) => upd(p.id, { message: e.target.value })} /></Field>
            <Field label="Pruebas"><Textarea rows={2} defaultValue={p.proof ?? ""} onBlur={(e) => upd(p.id, { proof: e.target.value })} /></Field>
          </div>
        ))}
      </div>
    </div>
  );
}
