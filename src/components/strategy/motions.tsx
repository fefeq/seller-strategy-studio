import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capacityPlan, matchSegment, MOTIONS, recommendMotion, type Motion } from "@/lib/metrics";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { useCurrency, useMe } from "@/hooks/use-me";
import { lastQuarters, segmentActuals, trailingCac } from "@/lib/pipeline-real";
import type { SegLike } from "@/lib/segment-coverage";
import { annualFromQuarters, marginFor, quartersOfYear } from "@/lib/segment-budget";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { checkAcvRange, checkSegmentField, type SegmentNumericField } from "@/lib/segment-fields";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const MOTION_OPTS = Object.fromEntries(Object.entries(MOTIONS).map(([k, v]) => [k, v.label]));
export const MONEY_COLS = ["acv_min", "acv_max", "cac_target", "ae_quota"];
export const SEG_LABEL: Record<string, string> = {
  priority: "Prioridad", acv_min: "ACV mín", acv_max: "ACV máx", motion: "Modelo de venta", cycle_days: "Ciclo (días)",
  sdr_per_ae: "SDR por AE", ae_per_se: "AE por SE", win_rate_target: "Win rate obj. %", ae_quota: "Cuota anual AE",
  cac_target: "CAC objetivo", gross_margin_pct: "Margen bruto %", payback_months: "Payback obj. (m)",
};
// [title, columns, show the «real» columns and actions in this block]
export const SEG_GROUPS = [
  ["Económicos", ["priority", "acv_min", "acv_max", "win_rate_target", "ae_quota", "cac_target", "gross_margin_pct", "payback_months"], true],
  ["Modelo de venta y capacidad", ["motion", "cycle_days", "sdr_per_ae", "ae_per_se"], false],
] as const;
export const SEG_COLS = [
  ["priority", "Prioridad"], ["acv_min", "ACV mín"], ["acv_max", "ACV máx"], ["motion", "Modelo de venta"], ["cycle_days", "Ciclo (días)"],
  ["sdr_per_ae", "SDR por AE"], ["ae_per_se", "AE por SE"], ["win_rate_target", "Win rate obj. %"], ["ae_quota", "Cuota anual AE"],
  ["cac_target", "CAC objetivo"], ["gross_margin_pct", "Margen bruto %"], ["payback_months", "Payback obj. (m)"],
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
            <summary className="cursor-pointer text-xs text-signal">Notas y fuentes de los segmentos</summary>
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
export const KEPT_WITHOUT_SEGMENT = [["deals", "deals"], ["accounts", "cuentas"], ["leads", "leads"], ["icp_profiles", "ICP"], ["trials", "pruebas"]] as const;
export const DELETED_WITH_SEGMENT = [["segment_targets", "objetivos"], ["cac_costs", "costes de CAC"], ["segment_budget_quarters", "trimestres de presupuesto"]] as const;

export function DeleteSegment({ target, onClose, onDeleted }: { target: { id: string; name: string } | null; onClose: () => void; onDeleted: () => void }) {
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
