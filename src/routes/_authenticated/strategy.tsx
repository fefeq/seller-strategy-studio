import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Page, Empty } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MOTIONS, recommendMotion, type Motion } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/strategy")({
  head: () => ({ meta: [{ title: "Estrategia GTM — GTM Brain" }, { name: "description", content: "Motions por segmento, ICP y posicionamiento." }, { property: "og:title", content: "Estrategia GTM — GTM Brain" }, { property: "og:description", content: "Motions por segmento, ICP y posicionamiento." }] }),
  component: Strategy,
});

const MOTION_OPTS = Object.fromEntries(Object.entries(MOTIONS).map(([k, v]) => [k, v.label]));

function Strategy() {
  return (
    <Page eyebrow="Capa estratégica" title="Estrategia GTM">
      <Tabs defaultValue="motions">
        <TabsList className="mb-6">
          <TabsTrigger value="motions">Motions por segmento</TabsTrigger>
          <TabsTrigger value="icp">ICP</TabsTrigger>
          <TabsTrigger value="positioning">Posicionamiento</TabsTrigger>
          <TabsTrigger value="pillars">Mensajes</TabsTrigger>
        </TabsList>
        <TabsContent value="motions"><Motions /></TabsContent>
        <TabsContent value="icp"><Icp /></TabsContent>
        <TabsContent value="positioning"><Positioning /></TabsContent>
        <TabsContent value="pillars"><Pillars /></TabsContent>
      </Tabs>
    </Page>
  );
}

function Motions() {
  const qc = useQueryClient();
  const [acv, setAcv] = useState(20000);
  const { data: segs = [] } = useQuery({ queryKey: ["segments"], queryFn: async () => (await supabase.from("segments").select("*").order("acv_min")).data ?? [] });
  const rec = recommendMotion(acv);
  async function upd(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("segments").update(patch as any).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["segments"] });
  }
  async function add() {
    await supabase.from("segments").insert({ name: "Nuevo segmento" });
    qc.invalidateQueries({ queryKey: ["segments"] });
  }
  return (
    <div className="space-y-8">
      <div className="grid gap-6 rounded-lg border bg-card p-6 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="eyebrow">Calculadora de motion</p>
          <Field label="Valor anual del contrato (ACV, $)"><Input type="number" value={acv} onChange={(e) => setAcv(Number(e.target.value))} /></Field>
        </div>
        <div>
          <p className="font-display text-4xl text-signal">{MOTIONS[rec].label}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Ciclo de venta</dt><dd>{MOTIONS[rec].cycle}</dd>
            <dt className="text-muted-foreground">Equipo</dt><dd>{MOTIONS[rec].team}</dd>
            <dt className="text-muted-foreground">CAC típico</dt><dd>{MOTIONS[rec].cac}</dd>
            <dt className="text-muted-foreground">Payback</dt><dd>{MOTIONS[rec].payback}</dd>
            <dt className="text-muted-foreground">Se mide por</dt><dd>{MOTIONS[rec].efficiency}</dd>
          </dl>
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-3xl">Tus segmentos</h3><Button size="sm" onClick={add}>+ Segmento</Button></div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left"><tr>{["Segmento", "ACV mín", "ACV máx", "Motion", "Ciclo (días)", "SDR por AE", "AE por SE", "CAC objetivo", "Payback (m)"].map((h) => <th key={h} className="eyebrow px-3 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {segs.map((s) => {
                const suggested = recommendMotion(Number(s.acv_min ?? 0));
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-2 py-2"><Input defaultValue={s.name} onBlur={(e) => upd(s.id, { name: e.target.value })} /></td>
                    {(["acv_min", "acv_max"] as const).map((k) => <td key={k} className="px-2 py-2 w-28"><Input type="number" defaultValue={s[k] ?? ""} onBlur={(e) => upd(s.id, { [k]: e.target.value === "" ? null : Number(e.target.value) })} /></td>)}
                    <td className="px-2 py-2 w-48">
                      <Pick value={s.motion} options={MOTION_OPTS} onChange={(v) => upd(s.id, { motion: v })} />
                      {s.motion !== suggested && <p className="mt-1 text-[11px] text-signal">Por ACV sugerimos {MOTIONS[suggested].label}</p>}
                    </td>
                    {(["cycle_days", "sdr_per_ae", "ae_per_se", "cac_target", "payback_months"] as const).map((k) => <td key={k} className="px-2 py-2 w-24"><Input type="number" defaultValue={s[k] ?? ""} onBlur={(e) => upd(s.id, { [k]: e.target.value === "" ? null : Number(e.target.value) })} /></td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">La mayoría de empresas combinan varios motions: empiezan con uno y añaden otro al escalar.</p>
      </div>
    </div>
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
    const { error } = await supabase.from("icp_profiles").update({ ...rest, segment_id: rest.segment_id || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ICP guardado"); qc.invalidateQueries({ queryKey: ["icp"] });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>+ ICP</Button>
        {data?.icps.map((i) => (
          <button key={i.id} onClick={() => setSel(i)} className={`block w-full rounded-md border bg-card p-3 text-left text-sm ${sel?.id === i.id ? "border-signal" : ""}`}>{i.name}</button>
        ))}
      </div>
      {sel ? (
        <div className="space-y-4 rounded-lg border bg-card p-5">
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
  const { data: row } = useQuery({ queryKey: ["positioning"], queryFn: async () => (await supabase.from("positioning").select("*").order("created_at").limit(1).maybeSingle()).data });
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { if (row) setF(row as any); }, [row]);
  async function save() {
    const { id, created_at, updated_at, created_by, updated_by, ...rest } = f as any;
    const { error } = row ? await supabase.from("positioning").update(rest).eq("id", row.id) : await supabase.from("positioning").insert(rest);
    if (error) return toast.error(error.message);
    toast.success("Posicionamiento guardado"); qc.invalidateQueries({ queryKey: ["positioning"] });
  }
  const v = (k: string) => f[k] || `[${STATEMENT.find((s) => s[0] === k)?.[1].toLowerCase()}]`;
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
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {STATEMENT.map(([k, l]) => <Field key={k} label={l}><Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
        </div>
        <blockquote className="mt-4 border-l-4 border-signal bg-card p-5 font-display text-2xl leading-snug">
          Para {v("target_customer")} que {v("need")}, {v("product_name")} es {v("category")} que {v("key_benefit")}. A diferencia de {v("competitive_alternative")}, nosotros {v("differentiator")}.
        </blockquote>
      </div>
      <div>
        <h3 className="text-3xl">Jerarquía de la propuesta de valor</h3>
        <div className="mt-3 space-y-3">
          {HIERARCHY.map(([k, l, rows]) => <Field key={k} label={l}><Textarea rows={rows} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
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
    await supabase.from("messaging_pillars").update(patch as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["pillars"] });
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">3–5 pilares. Cada uno responde a un dolor y se apoya en pruebas: funcionalidades, casos de cliente, datos.</p>
        <Button size="sm" onClick={add} disabled={list.length >= 5}>+ Pilar</Button>
      </div>
      {list.length === 0 && <Empty>Sin pilares todavía.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p, i) => (
          <div key={p.id} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2"><span className="font-mono text-xs text-signal">0{i + 1}</span><Input className="font-display text-xl" defaultValue={p.title} onBlur={(e) => upd(p.id, { title: e.target.value })} /></div>
            <Field label="Dolor que resuelve"><Textarea rows={2} defaultValue={p.pain ?? ""} onBlur={(e) => upd(p.id, { pain: e.target.value })} /></Field>
            <Field label="Mensaje"><Textarea rows={2} defaultValue={p.message ?? ""} onBlur={(e) => upd(p.id, { message: e.target.value })} /></Field>
            <Field label="Pruebas"><Textarea rows={2} defaultValue={p.proof ?? ""} onBlur={(e) => upd(p.id, { proof: e.target.value })} /></Field>
          </div>
        ))}
      </div>
    </div>
  );
}
