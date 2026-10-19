import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Empty } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LISTENING_LEVELS, SENSING_KINDS } from "@/lib/theory-u";
import { sensingPatterns } from "@/lib/ai.functions";
import { LevelPicker } from "./listening";

const BLANK = { interviewee: "", kind: "interview", account_id: "", journey_id: "", context: "", heard: "", surprised: "", emerging: "", listening_level: null as number | null };

export function Sensing() {
  const qc = useQueryClient();
  const [form, setForm] = useState(BLANK);
  const [filter, setFilter] = useState("");
  const [patterns, setPatterns] = useState("");
  const [busy, setBusy] = useState(false);
  const analyze = useServerFn(sensingPatterns);
  const { data } = useQuery({
    queryKey: ["sensing"],
    queryFn: async () => {
      const [n, a, j] = await Promise.all([
        supabase.from("sensing_notes").select("*, accounts(name)").order("occurred_on", { ascending: false }),
        supabase.from("accounts").select("id,name").order("name"),
        supabase.from("u_journeys").select("id,title").order("created_at", { ascending: false }),
      ]);
      return { notes: n.data ?? [], accounts: a.data ?? [], journeys: j.data ?? [] };
    },
  });
  const notes = (data?.notes ?? []).filter((n) => !filter || n.journey_id === filter);
  const journeyOpts = Object.fromEntries([["", "Sin recorrido"], ...(data?.journeys ?? []).map((j) => [j.id, j.title])]);

  async function add() {
    if (!form.heard && !form.surprised) return toast.error("Anota qué escuchaste o qué te sorprendió");
    const { error } = await supabase.from("sensing_notes").insert({ ...form, account_id: form.account_id || null, journey_id: form.journey_id || null });
    if (error) return toast.error(error.message);
    setForm({ ...BLANK, journey_id: form.journey_id, kind: form.kind });
    qc.invalidateQueries({ queryKey: ["sensing"] });
    toast.success("Nota guardada");
  }
  async function runPatterns() {
    setBusy(true);
    try { const r = await analyze({ data: { journeyId: filter || null } }); setPatterns(r.text); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <h3 className="text-2xl">Nueva nota de sensing</h3>
        <p className="text-sm text-muted-foreground">Suspende el juicio. Anota lo que oyes tal cual, no lo que ya sabías.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Con quién"><Input value={form.interviewee} onChange={set("interviewee")} placeholder="Nombre y cargo" /></Field>
          <Field label="Tipo"><Pick value={form.kind} options={SENSING_KINDS} onChange={(v) => setForm({ ...form, kind: v })} /></Field>
          <Field label="Cuenta"><Pick value={form.account_id} options={Object.fromEntries([["", "—"], ...(data?.accounts ?? []).map((a) => [a.id, a.name])])} onChange={(v) => setForm({ ...form, account_id: v })} /></Field>
          <Field label="Recorrido U"><Pick value={form.journey_id} options={journeyOpts} onChange={(v) => setForm({ ...form, journey_id: v })} /></Field>
        </div>
        <Field label="Contexto"><Input value={form.context} onChange={set("context")} placeholder="Dónde, cuándo, qué estaba pasando" /></Field>
        <Field label="Qué escuché (sus palabras, necesidades)"><Textarea rows={3} value={form.heard} onChange={set("heard")} /></Field>
        <Field label="Qué me sorprendió"><Textarea rows={2} value={form.surprised} onChange={set("surprised")} /></Field>
        <Field label="Qué parece querer emerger"><Textarea rows={2} value={form.emerging} onChange={set("emerging")} /></Field>
        <Field label="Mi nivel de escucha"><LevelPicker value={form.listening_level} onChange={(l) => setForm({ ...form, listening_level: l })} /></Field>
        <Button onClick={add}>Guardar nota</Button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56"><Pick value={filter} options={{ ...journeyOpts, "": "Todos los recorridos" }} onChange={setFilter} /></div>
          <Button variant="outline" onClick={runPatterns} disabled={busy || notes.length === 0}><Sparkles className="size-4" /> {busy ? "Analizando…" : "Detectar patrones con IA"}</Button>
          <span className="font-mono text-xs text-muted-foreground">{notes.length} notas</span>
        </div>
        {patterns && <div className="rounded-lg border bg-card p-5"><p className="eyebrow mb-2">Patrones emergentes</p><pre className="whitespace-pre-wrap font-sans text-sm">{patterns}</pre></div>}
        {notes.length === 0 && <Empty>Sin notas todavía. Habla con clientes, observa y anota.</Empty>}
        {notes.map((n) => (
          <div key={n.id} className="space-y-2 rounded-lg border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{n.interviewee || "Sin nombre"}{n.accounts?.name ? <span className="text-muted-foreground"> · {n.accounts.name}</span> : null}</p>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{SENSING_KINDS[n.kind]} · {new Date(n.occurred_on).toLocaleDateString("es-ES")}{n.listening_level ? ` · Escucha ${LISTENING_LEVELS[n.listening_level as 1].label}` : ""}</span>
            </div>
            {n.heard && <p><span className="eyebrow mr-1">Escuché</span>{n.heard}</p>}
            {n.surprised && <p><span className="eyebrow mr-1">Sorpresa</span>{n.surprised}</p>}
            {n.emerging && <p className="text-signal"><span className="eyebrow mr-1">Emerge</span>{n.emerging}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
