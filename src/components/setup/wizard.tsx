import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import { useAgent } from "@/components/agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applySetupItems } from "@/lib/agent.functions";
import { type SetupProposal } from "@/lib/setup-extraction";
import { DUNFORD_FIELDS, POSITIONING_FIELDS, SETUP_ITEMS } from "@/lib/setup-schema";
import { useSetupGuide } from "@/hooks/use-setup-guide";
import { NextStepMessage } from "@/components/setup/guide";
import { quarterOf } from "@/lib/metrics";
import { firstOpenStage, stageOptions } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { Pick } from "@/components/fields";
import { errorText } from "@/lib/errors";
import { DateField } from "@/components/date-field";
import { AccountImport } from "@/components/account-import";

// ---------------- Interview ----------------

export function Interview() {
  const { open } = useAgent();
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-2xl">Entrevista con el agente</h3>
      <p className="mt-2 max-w-xl text-muted-foreground">El agente mira qué te falta y te hace una pregunta cada vez, con una propuesta que puedes aceptar con un «sí». Cada respuesta queda como acción para confirmar con un clic.</p>
      <Button className="mt-4" onClick={() => open({ mode: "interview", prompt: "Quiero completar la configuración de mi estrategia GTM. Empieza por lo más importante que falte." })}>Empezar entrevista</Button>
    </div>
  );
}

// ---------------- Wizard ----------------

export function Wizard({ proposal }: { proposal: SetupProposal | null }) {
  const { data: setup } = useSetup();
  // Fixed order and numbering: «paso 2» is always the same step. Finishing a step shows the next recommended one
  // (setup-guide.ts, the same rule as Inicio and the agent) with «Empezar»; it never jumps on its own.
  const [stepId, setStepId] = useState<string | null>(null);
  const g = useSetupGuide();
  const stepsRef = useRef<HTMLDivElement>(null);
  const isDone = (id: string) => !!setup?.status.items.find((x) => x.id === id)?.done;
  const firstPending = g.guide?.next?.id ?? SETUP_ITEMS.find((i) => !isDone(i.id))?.id ?? SETUP_ITEMS[0].id;
  const curId = stepId ?? firstPending;
  const cur = SETUP_ITEMS.find((i) => i.id === curId) ?? SETUP_ITEMS[0];
  // Mobile: the steps are one swipeable row; keep the current one in view.
  useEffect(() => {
    const box = stepsRef.current;
    const el = box?.querySelector<HTMLElement>("[data-active]");
    if (box && el && box.scrollWidth > box.clientWidth) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }, [curId]);
  if (!setup) return null;
  const done = isDone(cur.id);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div ref={stepsRef} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {SETUP_ITEMS.map((i, idx) => (
          <button key={i.id} data-active={i.id === cur.id || undefined} onClick={() => setStepId(i.id)} className={`min-h-8 shrink-0 whitespace-nowrap rounded-none border px-3 py-1.5 text-xs md:min-h-0 md:py-1 ${i.id === cur.id ? "bg-primary text-primary-foreground" : isDone(i.id) ? "text-muted-foreground line-through" : ""}`}>{idx + 1}. {i.label.split(" (")[0]}{g.guide?.steps.find((x) => x.id === i.id)?.state === "snoozed" && " · Pospuesto"}</button>
        ))}
      </div>
      {g.justDone && g.message?.stepId !== undefined && g.message && (
        <div className="mt-4 rounded-lg border bg-muted/40 p-4">
          <NextStepMessage msg={g.message} onStart={(id) => { setStepId(id); g.clearJustDone(); }} onDismiss={g.clearJustDone} />
        </div>
      )}
      <div className="mt-5">
        <h3 className="text-2xl">{cur.label} {done && <span className="ml-2 align-middle text-xs text-success">Completado</span>}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Desbloquea: {cur.unlocks}</p>
        <div className="mt-4"><StepPanel key={cur.id} id={cur.id} done={done} link={cur.link} proposal={proposal} onSaved={() => undefined} /></div>
      </div>
    </div>
  );
}

// Steps whose form creates a new record. Once done, they show what exists and only open the form on purpose,
// so an empty «ICP principal» form doesn't invite a duplicate.
export const CREATE_STEPS: Record<string, { what: string; add: string }> = {
  icp: { what: "Ya tienes al menos un ICP completo.", add: "Crear otro ICP" },
  pillars: { what: "Ya tienes tres pilares de mensaje.", add: "Añadir pilares" },
  quota: { what: "Ya tienes cuota para este trimestre.", add: "Cambiar mi cuota" },
  accounts: { what: "Ya tienes cuentas objetivo.", add: "Añadir más cuentas" },
  deals: { what: "Ya tienes al menos un deal.", add: "Crear otro deal" },
};

export function StepPanel({ id, done, link, proposal, onSaved }: { id: string; done: boolean; link: string; proposal: SetupProposal | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const create = CREATE_STEPS[id];
  if (done && create && !open) {
    return (
      <div className="space-y-3 text-sm">
        <p>{create.what} Puedes revisarlo en <Link to={link} className="underline">{link === "/strategy" ? "Estrategia" : link === "/metrics" ? "Métricas" : link === "/accounts" ? "Cuentas" : "Pipeline"}</Link>.</p>
        <Button variant="outline" onClick={() => setOpen(true)}>{create.add}</Button>
      </div>
    );
  }
  return <StepForm id={id} proposal={proposal} onSaved={onSaved} />;
}

export const SEG_COLS = [["acv_min", "ACV mín."], ["acv_max", "ACV máx."], ["win_rate_target", "Win rate %"], ["ae_quota", "Cuota anual AE"]] as const;

export function StepForm({ id, proposal, onSaved }: { id: string; proposal: SetupProposal | null; onSaved: () => void }) {
  const apply = useServerFn(applySetupItems);
  const qc = useQueryClient();
  const { data: setup } = useSetup();
  const { currency, symbol } = useCurrency();
  const { stages } = useStages();
  const segsQ = useQuery({ queryKey: ["segments-full"], queryFn: async () => (await supabase.from("segments").select("id,name,acv_min,acv_max,win_rate_target,ae_quota").order("acv_min")).data ?? [] });
  const segs = useMemo(() => segsQ.data ?? [], [segsQ.data]);
  const [v, setV] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const pos = setup?.data.positioning ?? {};
    if (id === "positioning") setV(Object.fromEntries(POSITIONING_FIELDS.map(([k]) => [k, pos[k] || proposal?.positioning?.[k] || ""])));
    else if (id === "icp") { const p = proposal?.icps[0]; setV({ name: p?.name ?? "ICP principal", industries: p?.industries ?? "", company_size: p?.company_size ?? "", why_fit: p?.why_fit ?? "", anti_icp: p?.anti_icp ?? "" }); }
    else if (id === "pillars") setV({ rows: [0, 1, 2].map((i) => ({ title: proposal?.pillars[i]?.title ?? "", message: proposal?.pillars[i]?.message ?? "" })) });
    else if (id === "segments" || id === "benchmarks") setV({ rows: segs.map((s) => { const p = proposal?.segments.find((x) => x.name.toLowerCase() === s.name.toLowerCase()); return { ...s, win_rate_target: s.win_rate_target ?? p?.win_rate_target ?? "", ae_quota: s.ae_quota ?? p?.ae_quota ?? "", acv_min: s.acv_min ?? "", acv_max: s.acv_max ?? "" }; }) });
    else if (id === "quota") setV({ amount: "" });
    else if (id === "accounts") setV({ names: (proposal?.target_accounts ?? []).map((a) => a.name).join("\n") });
    else if (id === "deals") setV({ name: "", account_name: "", segment_id: "", stage: "", amount: "", close_date: "" });
  }, [id, proposal, setup, segs]);

  const num = (x: any) => (x === "" || x == null ? undefined : Number(x));
  function items(): { tool: string; args: Record<string, unknown> }[] {
    switch (id) {
      case "positioning": return [{ tool: "update_positioning", args: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => String(x).trim())) } }];
      case "icp": return [{ tool: "create_icp", args: v }];
      case "pillars": return v.rows.filter((r: any) => r.title.trim()).map((r: any) => ({ tool: "create_pillar", args: r }));
      case "segments": case "benchmarks": return v.rows.map((r: any) => ({ tool: "upsert_segment", args: Object.fromEntries(Object.entries({ segment_id: r.id, name: r.name, acv_min: num(r.acv_min), acv_max: num(r.acv_max), win_rate_target: num(r.win_rate_target), ae_quota: num(r.ae_quota) }).filter(([, x]) => x !== undefined)) }));
      case "quota": return [{ tool: "set_quota", args: { amount: Number(v.amount), period: quarterOf(new Date()) } }];
      case "accounts": return String(v.names ?? "").split("\n").map((n) => n.trim()).filter(Boolean).map((name) => ({ tool: "create_account", args: { name, is_target: true } }));
      case "deals": return [{ tool: "create_deal", args: Object.fromEntries(Object.entries({ name: v.name, account_name: v.account_name?.trim() || undefined, segment_id: v.segment_id || undefined, stage: v.stage || undefined, amount: num(v.amount), close_date: v.close_date || undefined }).filter(([, x]) => x !== undefined)) }];
    }
    return [];
  }

  async function save() {
    setBusy(true);
    try {
      const r = await apply({ data: { items: items() } });
      const bad = r.filter((x) => !x.ok);
      if (bad.length) toast.error(errorText(bad[0].error)); else { toast.success("Guardado."); onSaved(); }
      qc.invalidateQueries();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const inp = (k: string, label: string, opts: { area?: boolean; type?: string } = {}) => (
    <label key={k} className="text-sm">{label}
      {opts.area ? <Textarea className="mt-1" rows={2} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <Input className="mt-1" type={opts.type} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
    </label>
  );
  const setRow = (i: number, k: string, x: string) => setV({ ...v, rows: v.rows.map((r: any, j: number) => (j === i ? { ...r, [k]: x } : r)) });

  return (
    <div className="space-y-3">
      {id === "positioning" && <div className="grid gap-3 sm:grid-cols-2">{POSITIONING_FIELDS.map(([k, l]) => inp(k, l, { area: k === "elevator_pitch" || DUNFORD_FIELDS.some(([d]) => d === k) }))}</div>}
      {id === "icp" && <div className="grid gap-3 sm:grid-cols-2">{inp("name", "Nombre")}{inp("industries", "Sectores")}{inp("company_size", "Tamaño de empresa")}{inp("why_fit", "Por qué encaja", { area: true })}{inp("anti_icp", "Anti-ICP (a quién NO venderle)", { area: true })}</div>}
      {id === "pillars" && v.rows?.map((r: any, i: number) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]"><Input placeholder={`Pilar ${i + 1}`} value={r.title} onChange={(e) => setRow(i, "title", e.target.value)} /><Input placeholder="Mensaje" value={r.message} onChange={(e) => setRow(i, "message", e.target.value)} /></div>
      ))}
      {(id === "segments" || id === "benchmarks") && (<>
        <div className="space-y-3 md:hidden">{v.rows?.map((r: any, i: number) => (
          <div key={r.id} className="border-t border-hairline pt-2">
            <p className="text-sm font-medium">{r.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">{SEG_COLS.map(([k, l]) => (
              <label key={k} className="text-xs text-muted-foreground">{l}<Input className="mt-1" type="number" inputMode="decimal" value={r[k]} onChange={(e) => setRow(i, k, e.target.value)} /></label>
            ))}</div>
          </div>
        ))}{!v.rows?.length && <p className="text-sm text-muted-foreground">No hay segmentos. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</p>}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Segmento</th>{SEG_COLS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>{v.rows?.map((r: any, i: number) => (
            <tr key={r.id}><td className="py-1 pr-2">{r.name}</td>{SEG_COLS.map(([k]) => <td key={k} className="pr-2"><Input type="number" value={r[k]} onChange={(e) => setRow(i, k, e.target.value)} /></td>)}</tr>
          ))}</tbody>
        </table>{!v.rows?.length && <p className="text-sm text-muted-foreground">No hay segmentos. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</p>}</div>
        {(() => {
          // The step only counts as done when every segment has its values: say which ones are missing, so a
          // template segment the company doesn't use isn't a silent blocker.
          const empty = (x: unknown) => x == null || String(x).trim() === "";
          const missing = (v.rows ?? []).filter((r: any) => (id === "segments" ? empty(r.acv_min) && empty(r.acv_max) : empty(r.win_rate_target) || empty(r.ae_quota))).map((r: any) => r.name);
          return missing.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Para completar este paso, {id === "segments" ? "cada segmento necesita un ACV mínimo o máximo" : "cada segmento necesita win rate y cuota (0 vale si no aplica)"}. Faltan: {missing.join(", ")}. Si alguno no es tuyo, por ejemplo uno de la plantilla, elimínalo en <Link to="/strategy" className="underline">Estrategia GTM</Link>.
            </p>
          ) : null;
        })()}
      </>)}
      {id === "quota" && <div className="max-w-xs">{inp("amount", `Tu cuota para ${quarterOf(new Date())} (${symbol})`, { type: "number" })}<p className="mt-1 text-xs text-muted-foreground">Importe de deals ganados (ACV nuevo) que tienes que cerrar en el trimestre, en {currency}. No es MRR ni número de deals. Las cuotas del resto del equipo se fijan en Métricas.</p></div>}
      {id === "accounts" && <div className="grid gap-6 md:grid-cols-2">
        <div><p className="mb-2 text-sm font-medium">Desde un CSV</p><AccountImport onDone={(n) => n > 0 && onSaved()} /></div>
        <label className="block text-sm"><span className="font-medium">O escribe una cuenta por línea</span><Textarea className="mt-1" rows={5} value={v.names ?? ""} onChange={(e) => setV({ ...v, names: e.target.value })} /><span className="mt-1 block text-xs text-muted-foreground">Se crean como cuentas objetivo solo con el nombre; completa sector y tamaño en su ficha para que puntúen.</span></label>
      </div>}
      {id === "deals" && <div className="grid gap-3 sm:grid-cols-3">{inp("name", "Nombre del deal")}{inp("account_name", "Cuenta (se crea si no existe)")}<label className="text-sm">Segmento<div className="mt-1"><Pick value={v.segment_id ?? ""} options={{ "": "Sin segmento", ...Object.fromEntries(segs.map((x) => [x.id, x.name])) }} onChange={(x) => setV({ ...v, segment_id: x })} /></div></label><label className="text-sm">Etapa<div className="mt-1"><Pick value={v.stage || firstOpenStage(stages).key} options={stageOptions(stages)} onChange={(x) => setV({ ...v, stage: x })} /></div></label>{inp("amount", `Importe (ACV, ${symbol})`, { type: "number" })}<label className="text-sm">Fecha de cierre<div className="mt-1"><DateField value={v.close_date || null} onChange={(iso) => setV({ ...v, close_date: iso ?? "" })} /></div></label></div>}
      <Button onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar y seguir"}</Button>
    </div>
  );
}
