import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Empty } from "@/components/page";
import { Field } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { mergeServerEdits } from "@/lib/merge-edits";
import { keepApprovals, positioningStatement, STATEMENT_SLOTS, type CopyStatus } from "@/lib/positioning";

export const DUNFORD = [
  ["best_customers", "1. Tus mejores clientes", "¿Quién ama el producto y por qué?"],
  ["alternatives", "2. Alternativas competitivas", "¿Qué harían si no existiéramos? (incl. no hacer nada, Excel)"],
  ["differentiation", "3. Diferenciación", "Capacidades únicas que las alternativas no tienen"],
  ["value", "4. Valor", "Qué consiguen gracias a esa diferenciación"],
  ["trend", "5. Tendencia", "La ola de mercado sobre la que nos subimos"],
] as const;
export const STATEMENT = [
  ["target_customer", "Cliente objetivo"], ["need", "Necesidad / dolor"], ["product_name", "Producto"], ["category", "Categoría"],
  ["key_benefit", "Beneficio clave"], ["competitive_alternative", "Alternativa competitiva"], ["differentiator", "Diferenciador"],
] as const;
export const HIERARCHY = [
  ["tagline", "Tagline (5–10 palabras)", 1], ["one_liner", "Una frase: qué hacemos", 2],
  ["short_pitch", "Pitch corto (problema, solución, prueba)", 3], ["elevator_pitch", "Elevator pitch (30–60 s)", 5],
] as const;

export function Positioning() {
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

export function Pillars() {
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
