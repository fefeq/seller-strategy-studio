// Unified history of an account or a deal (activities, calls, past meetings, done tasks, stage changes and offers)
// with «Registrar actividad», which can start from an email template.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Pick } from "@/components/fields";
import { useStages } from "@/components/stage-settings";
import { stageLabel } from "@/lib/stages";
import { errorText } from "@/lib/errors";
import { ACTIVITY_KINDS, KIND_LABEL, buildTimeline, daysSinceTouch, fillTemplate, missingVars } from "@/lib/crm";

type Scope = { accountId?: string; dealId?: string; accountName?: string; dealName?: string };

export function useTimeline({ accountId, dealId }: Scope) {
  const { stages } = useStages();
  return useQuery({
    queryKey: ["timeline", accountId ?? null, dealId ?? null],
    queryFn: async () => {
      const by = <T extends { eq: (c: string, v: string) => T }>(q: T) => (dealId ? q.eq("deal_id", dealId) : q.eq("account_id", accountId!));
      const dealIds = dealId ? [dealId] : ((await supabase.from("deals").select("id").eq("account_id", accountId!)).data ?? []).map((d) => d.id);
      const [a, c, m, t, s, o] = await Promise.all([
        by(supabase.from("activities").select("id,kind,subject,body,occurred_at")).order("occurred_at", { ascending: false }).limit(200),
        by(supabase.from("calls").select("id,title,occurred_at,summary,created_at")).limit(100),
        by(supabase.from("meetings").select("id,title,scheduled_at,notes,created_at")).limit(100),
        by(supabase.from("tasks").select("id,title,due_date,done,created_at")).limit(200),
        dealIds.length ? supabase.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at").in("deal_id", dealIds) : Promise.resolve({ data: [] }),
        dealIds.length ? supabase.from("deal_offers").select("id,version,status,recurring_total,created_at").in("deal_id", dealIds) : Promise.resolve({ data: [] }),
      ]);
      return buildTimeline({ activities: a.data ?? [], calls: c.data ?? [], meetings: m.data ?? [], tasks: t.data ?? [], stages: s.data ?? [], offers: o.data ?? [], stageLabel: (k) => stageLabel(k, stages) });
    },
  });
}

export function Timeline(scope: Scope) {
  const { data: items = [] } = useTimeline(scope);
  const days = daysSinceTouch(items);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 15);
  return (
    <div className="space-y-6">
      <LogActivity {...scope} />
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-2xl">Historia</h3>
          <span className={`text-sm ${days != null && days > 21 ? "text-signal" : "text-ink-mid"}`}>{days == null ? "Sin contacto registrado" : days === 0 ? "Último contacto: hoy" : `Último contacto hace ${days} ${days === 1 ? "día" : "días"}`}</span>
        </div>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay historia. Registra el primer email, llamada o nota.</p> : (
          <ol className="relative space-y-3 border-l pl-5">
            {shown.map((i) => (
              <li key={i.id} className="relative">
                <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-lime" aria-hidden />
                <p className="text-sm"><span className="mr-2 rounded-full bg-paper-sunk px-2 py-0.5 text-xs">{KIND_LABEL[i.kind]}</span><span className="font-medium">{i.title}</span></p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{new Date(i.at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</p>
                {i.body && <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-mid">{i.body.length > 600 ? `${i.body.slice(0, 600)}…` : i.body}</p>}
              </li>
            ))}
          </ol>
        )}
        {items.length > 15 && !all && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll(true)}>Ver toda la historia ({items.length})</Button>}
      </div>
    </div>
  );
}

function LogActivity({ accountId, dealId, accountName, dealName }: Scope) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [f, setF] = useState({ kind: "email", subject: "", body: "", when: new Date().toISOString().slice(0, 16) });
  const { data: templates = [] } = useQuery({ queryKey: ["email-templates"], queryFn: async () => (await supabase.from("email_templates").select("id,name,subject,body").order("name")).data ?? [] });
  const vars = { empresa: accountName ?? null, deal: dealName ?? null, remitente: me?.profile?.full_name ?? null };
  const missing = missingVars(`${f.subject} ${f.body}`);

  function useTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (t) setF({ ...f, kind: "email", subject: fillTemplate(t.subject, vars), body: fillTemplate(t.body, vars) });
  }
  async function save() {
    if (!f.subject.trim() && !f.body.trim()) return toast.error("Escribe un asunto o una nota.");
    let account = accountId ?? null;
    if (!account && dealId) account = (await supabase.from("deals").select("account_id").eq("id", dealId).maybeSingle()).data?.account_id ?? null;
    const { error } = await supabase.from("activities").insert({ kind: f.kind, subject: f.subject.trim(), body: f.body.trim(), occurred_at: new Date(f.when).toISOString(), account_id: account, deal_id: dealId ?? null });
    if (error) return toast.error(errorText(error));
    toast.success("Actividad registrada.");
    setF({ ...f, subject: "", body: "" });
    qc.invalidateQueries({ queryKey: ["timeline"] });
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="eyebrow mb-3">Registrar actividad</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tipo"><Pick value={f.kind} options={Object.fromEntries(ACTIVITY_KINDS.map((k) => [k, KIND_LABEL[k]]))} onChange={(v) => setF({ ...f, kind: v })} /></Field>
        <Field label="Cuándo"><Input type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></Field>
        <Field label="Plantilla de email">
          <Pick value="" options={Object.fromEntries([["", templates.length ? "Elegir…" : "Sin plantillas"], ...templates.map((t) => [t.id, t.name])])} onChange={useTemplate} disabled={!templates.length} />
        </Field>
      </div>
      <Input className="mt-3" placeholder="Asunto" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      <Textarea className="mt-2" rows={3} placeholder="Qué pasó, qué dijeron, siguiente paso…" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      {missing.length > 0 && <p className="mt-2 text-xs text-signal">Falta rellenar: {missing.map((m) => `{{${m}}}`).join(", ")}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={save}>Guardar</Button>
        <Link to="/hub" search={{ tab: "templates" }} className="text-sm text-ink-mid underline underline-offset-2">Gestionar plantillas</Link>
      </div>
    </div>
  );
}
