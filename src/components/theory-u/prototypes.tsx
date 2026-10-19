import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Empty } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EXPERIMENT_STATUS } from "@/lib/theory-u";

const TEXT_FIELDS = [
  ["hypothesis", "Hipótesis", "Creemos que [segmento] responderá a [cambio] porque [razón]."],
  ["prototype", "Prototipo", "La versión mínima que podemos probar esta semana."],
  ["audience", "Con quién lo probamos", ""],
  ["metric", "Métrica", "Ej.: tasa de respuesta, reuniones agendadas, win rate"],
  ["target", "Objetivo", "Ej.: >8% respuesta en 50 cuentas"],
  ["result", "Resultado", ""],
  ["learning", "Aprendizaje", "¿Qué haríamos distinto? ¿Escalamos, iteramos o soltamos?"],
] as const;

export function Prototypes() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<any | null>(null);
  const { data } = useQuery({
    queryKey: ["gtm_experiments"],
    queryFn: async () => {
      const [e, j] = await Promise.all([
        supabase.from("gtm_experiments").select("*").order("created_at", { ascending: false }),
        supabase.from("u_journeys").select("id,title").order("created_at", { ascending: false }),
      ]);
      return { exps: e.data ?? [], journeys: j.data ?? [] };
    },
  });
  const exps = data?.exps ?? [];

  async function add() {
    const { data: row, error } = await supabase.from("gtm_experiments").insert({ title: "Nuevo prototipo" }).select().single();
    if (error) return toast.error(error.message);
    setSel(row); qc.invalidateQueries({ queryKey: ["gtm_experiments"] });
  }
  async function save() {
    const { id, org_id: _o, created_at: _c, updated_at: _u, created_by: _cb, updated_by: _ub, ...rest } = sel;
    const { error } = await supabase.from("gtm_experiments").update({ ...rest, journey_id: rest.journey_id || null, starts_on: rest.starts_on || null, ends_on: rest.ends_on || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Prototipo guardado"); qc.invalidateQueries({ queryKey: ["gtm_experiments"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-muted-foreground">Co-crear en Theory U es explorar el futuro haciendo: prototipos pequeños, feedback temprano y aprender rápido en vez de planificar de más. Lo que funciona pasa a los playbooks y a la estrategia.</p>
        <Button size="sm" onClick={add}>+ Prototipo</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {Object.entries(EXPERIMENT_STATUS).map(([k, label]) => {
          const col = exps.filter((e) => e.status === k);
          return (
            <div key={k} className="min-h-24 space-y-2 rounded-lg bg-muted/40 p-2">
              <p className="eyebrow px-1">{label} <span className="font-mono">({col.length})</span></p>
              {col.map((e) => (
                <button key={e.id} onClick={() => setSel(e)} className={`block w-full rounded-md border bg-card p-2 text-left text-xs ${sel?.id === e.id ? "border-signal" : ""}`}>
                  <span className="font-medium">{e.title}</span>
                  {e.metric && <span className="block text-muted-foreground">{e.metric}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {sel ? (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2"><Field label="Título"><Input value={sel.title} onChange={(e) => setSel({ ...sel, title: e.target.value })} /></Field></div>
            <Field label="Estado"><Pick value={sel.status} options={EXPERIMENT_STATUS} onChange={(v) => setSel({ ...sel, status: v })} /></Field>
            <Field label="Inicio"><Input type="date" value={sel.starts_on ?? ""} onChange={(e) => setSel({ ...sel, starts_on: e.target.value })} /></Field>
            <Field label="Fin"><Input type="date" value={sel.ends_on ?? ""} onChange={(e) => setSel({ ...sel, ends_on: e.target.value })} /></Field>
          </div>
          <Field label="Recorrido U"><Pick value={sel.journey_id ?? ""} options={Object.fromEntries([["", "Sin recorrido"], ...(data?.journeys ?? []).map((j) => [j.id, j.title])])} onChange={(v) => setSel({ ...sel, journey_id: v })} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            {TEXT_FIELDS.map(([k, label, ph]) => (
              <Field key={k} label={label}><Textarea rows={2} placeholder={ph} value={sel[k] ?? ""} onChange={(e) => setSel({ ...sel, [k]: e.target.value })} /></Field>
            ))}
          </div>
          <Button onClick={save}>Guardar</Button>
        </div>
      ) : exps.length === 0 ? <Empty>Crea tu primer prototipo GTM.</Empty> : null}
    </div>
  );
}
