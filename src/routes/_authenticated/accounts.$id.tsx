import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Page, Empty, HealthDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Field, Pick } from "@/components/fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUYING_ROLES, SUPPORT, DEAL_STAGES } from "@/lib/roles";
import { generateMeetingBrief, generateProposal, researchStakeholder } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/accounts/$id")({
  head: () => ({ meta: [{ title: "Cuenta — GTM Brain" }, { name: "description", content: "Account Plan, stakeholders y reuniones." }, { property: "og:title", content: "Cuenta — GTM Brain" }, { property: "og:description", content: "Account Plan, stakeholders y reuniones." }] }),
  component: AccountPage,
});

function AccountPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["account", id],
    queryFn: async () => {
      const [a, plan, sh, mt, calls, deals] = await Promise.all([
        supabase.from("accounts").select("*").eq("id", id).single(),
        supabase.from("account_plans").select("*").eq("account_id", id).maybeSingle(),
        supabase.from("stakeholders").select("*").eq("account_id", id).order("created_at"),
        supabase.from("meetings").select("*").eq("account_id", id).order("scheduled_at", { ascending: false }),
        supabase.from("calls").select("*").eq("account_id", id).order("occurred_at", { ascending: false }),
        supabase.from("deals").select("*").eq("account_id", id),
      ]);
      return { account: a.data, plan: plan.data, stakeholders: sh.data ?? [], meetings: mt.data ?? [], calls: calls.data ?? [], deals: deals.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["account", id] });
  if (!data?.account) return <Page title="Cargando…"><div /></Page>;
  const a = data.account;

  return (
    <Page eyebrow="Cuenta" title={a.name} actions={
      <div className="flex items-center gap-2">
        <Select value={a.health ?? "green"} onValueChange={async (v) => { await supabase.from("accounts").update({ health: v }).eq("id", id); refresh(); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="green">Sana</SelectItem><SelectItem value="yellow">Atención</SelectItem><SelectItem value="red">En riesgo</SelectItem></SelectContent>
        </Select>
        <Select value={a.tier ?? "B"} onValueChange={async (v) => { await supabase.from("accounts").update({ tier: v }).eq("id", id); refresh(); }}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{["A", "B", "C"].map((t) => <SelectItem key={t} value={t}>Tier {t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    }>
      <Tabs defaultValue="plan">
        <TabsList className="mb-6">
          <TabsTrigger value="plan">Account Plan</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders ({data.stakeholders.length})</TabsTrigger>
          <TabsTrigger value="meetings">Meeting Planner ({data.meetings.length})</TabsTrigger>
          <TabsTrigger value="calls">Llamadas ({data.calls.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({data.deals.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="plan"><PlanTab accountId={id} plan={data.plan} onSaved={refresh} /></TabsContent>
        <TabsContent value="stakeholders"><StakeholdersTab accountId={id} list={data.stakeholders} onChange={refresh} /></TabsContent>
        <TabsContent value="meetings"><MeetingsTab accountId={id} list={data.meetings} stakeholders={data.stakeholders} deals={data.deals} onChange={refresh} /></TabsContent>
        <TabsContent value="calls"><CallsTab accountId={id} list={data.calls} onChange={refresh} /></TabsContent>
        <TabsContent value="deals"><DealsTab accountId={id} list={data.deals} onChange={refresh} /></TabsContent>
      </Tabs>
    </Page>
  );
}

const PLAN_FIELDS = [
  ["objectives", "Objetivos de la cuenta", "Qué quiere conseguir el cliente este año"],
  ["current_state", "Situación actual", "Cómo lo hacen hoy, herramientas, equipo"],
  ["pains", "Dolores", "Problemas concretos y su impacto"],
  ["initiatives", "Iniciativas estratégicas", "Proyectos en marcha donde encajamos"],
  ["whitespace", "Whitespace / oportunidades", "Áreas, equipos o productos por expandir"],
  ["competitors", "Competencia", "Proveedores actuales y alternativas"],
  ["risks", "Riesgos", "Qué puede hacernos perder"],
  ["action_plan", "Plan de acción", "Acción · responsable · fecha"],
] as const;

function PlanTab({ accountId, plan, onSaved }: { accountId: string; plan: Record<string, any> | null; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState("");
  const [busy, setBusy] = useState(false);
  const propose = useServerFn(generateProposal);
  useEffect(() => { setForm(Object.fromEntries(PLAN_FIELDS.map(([k]) => [k, plan?.[k] ?? ""]))); }, [plan]);
  async function save() {
    const { error } = plan
      ? await supabase.from("account_plans").update(form as any).eq("id", plan.id)
      : await supabase.from("account_plans").insert({ account_id: accountId, ...form });
    if (error) return toast.error(error.message);
    toast.success("Account Plan guardado");
    onSaved();
  }
  async function genProposal() {
    setBusy(true);
    try { setProposal((await propose({ data: { accountId } })).text); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {PLAN_FIELDS.map(([k, label, hint]) => (
          <div key={k} className="space-y-1.5 rounded-lg border bg-card p-4">
            <Label className="font-display text-xl font-normal">{label}</Label>
            <Textarea rows={4} placeholder={hint} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={save}>Guardar Account Plan</Button>
        <Button variant="outline" onClick={genProposal} disabled={busy}><Sparkles className="size-4" /> {busy ? "Generando…" : "Borrador de propuesta con IA"}</Button>
      </div>
      {proposal && <pre className="whitespace-pre-wrap rounded-lg border bg-card p-6 font-sans text-sm">{proposal}</pre>}
    </div>
  );
}

function StakeholdersTab({ accountId, list, onChange }: { accountId: string; list: any[]; onChange: () => void }) {
  const [sel, setSel] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const research = useServerFn(researchStakeholder);
  async function add() {
    const { data, error } = await supabase.from("stakeholders").insert({ account_id: accountId, name: "Nueva persona" }).select().single();
    if (error) return toast.error(error.message);
    setSel(data); onChange();
  }
  async function save() {
    const { id, name, title, email, linkedin_url, buying_role, support, priorities, reports_to } = sel;
    const { error } = await supabase.from("stakeholders").update({ name, title, email, linkedin_url, buying_role, support, priorities, reports_to: reports_to || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Guardado"); onChange();
  }
  async function runResearch() {
    setBusy(true);
    try { const r = await research({ data: { stakeholderId: sel.id } }); setSel({ ...sel, research: r.text }); onChange(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const roots = list.filter((s) => !s.reports_to || !list.find((x) => x.id === s.reports_to));
  const children = (pid: string) => list.filter((s) => s.reports_to === pid);
  const Node = ({ s }: { s: any }) => (
    <li className="ml-4 border-l pl-4">
      <button onClick={() => setSel(s)} className={`my-1 rounded-md border bg-card px-3 py-2 text-left text-sm ${sel?.id === s.id ? "border-signal" : ""}`}>
        <span className="font-medium">{s.name}</span> <span className="text-muted-foreground">· {s.title}</span>
        <span className="mt-1 flex gap-1.5 font-mono text-[10px] uppercase">
          <span className="rounded bg-accent px-1">{BUYING_ROLES[s.buying_role] ?? s.buying_role}</span>
          <span className={`rounded px-1 ${s.support === "advocate" ? "bg-success/15 text-success" : s.support === "opponent" || s.support === "skeptic" ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>{SUPPORT[s.support] ?? s.support}</span>
        </span>
      </button>
      {children(s.id).length > 0 && <ul>{children(s.id).map((c) => <Node key={c.id} s={c} />)}</ul>}
    </li>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-2xl">Mapa de poder</h3><Button size="sm" onClick={add}>+ Persona</Button></div>
        {list.length === 0 ? <Empty>Añade a las personas involucradas en la compra.</Empty> : <ul className="-ml-4">{roots.map((s) => <Node key={s.id} s={s} />)}</ul>}
      </div>
      {sel ? (
        <div className="space-y-3 rounded-lg border bg-card p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre"><Input value={sel.name ?? ""} onChange={(e) => setSel({ ...sel, name: e.target.value })} /></Field>
            <Field label="Cargo"><Input value={sel.title ?? ""} onChange={(e) => setSel({ ...sel, title: e.target.value })} /></Field>
            <Field label="Email"><Input value={sel.email ?? ""} onChange={(e) => setSel({ ...sel, email: e.target.value })} /></Field>
            <Field label="LinkedIn"><Input value={sel.linkedin_url ?? ""} onChange={(e) => setSel({ ...sel, linkedin_url: e.target.value })} /></Field>
            <Field label="Rol en la compra"><Pick value={sel.buying_role} options={BUYING_ROLES} onChange={(v) => setSel({ ...sel, buying_role: v })} /></Field>
            <Field label="Nivel de apoyo"><Pick value={sel.support} options={SUPPORT} onChange={(v) => setSel({ ...sel, support: v })} /></Field>
            <Field label="Reporta a"><Pick value={sel.reports_to ?? ""} options={Object.fromEntries([["", "—"], ...list.filter((x) => x.id !== sel.id).map((x) => [x.id, x.name])])} onChange={(v) => setSel({ ...sel, reports_to: v })} /></Field>
          </div>
          <Field label="Prioridades y notas"><Textarea rows={3} value={sel.priorities ?? ""} onChange={(e) => setSel({ ...sel, priorities: e.target.value })} /></Field>
          <div className="flex gap-2"><Button onClick={save}>Guardar</Button><Button variant="outline" onClick={runResearch} disabled={busy}><Sparkles className="size-4" /> {busy ? "Investigando…" : "Research con IA"}</Button></div>
          {sel.research && <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm">{sel.research}</pre>}
        </div>
      ) : <Empty>Selecciona una persona del mapa.</Empty>}
    </div>
  );
}

const MEETING_FIELDS = [
  ["objective", "Objetivo"], ["attendees", "Asistentes"], ["agenda", "Agenda"], ["questions", "Preguntas de discovery"],
  ["objections", "Objeciones esperadas"], ["materials", "Materiales"], ["desired_outcome", "Resultado deseado"],
  ["notes", "Notas (después)"], ["next_steps", "Próximos pasos (después)"],
] as const;

function MeetingsTab({ accountId, list, stakeholders, deals, onChange }: { accountId: string; list: any[]; stakeholders: any[]; deals: any[]; onChange: () => void }) {
  const [sel, setSel] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const brief = useServerFn(generateMeetingBrief);
  async function add() {
    const { data, error } = await supabase.from("meetings").insert({ account_id: accountId, title: "Nueva reunión", scheduled_at: new Date(Date.now() + 864e5).toISOString() }).select().single();
    if (error) return toast.error(error.message);
    setSel(data); onChange();
  }
  async function save() {
    const { id, title, scheduled_at, deal_id, ...rest } = sel;
    const payload: Record<string, any> = { title, scheduled_at, deal_id: deal_id || null };
    for (const [k] of MEETING_FIELDS) payload[k] = rest[k];
    const { error } = await supabase.from("meetings").update(payload as any).eq("id", id);
    if (error) return toast.error(error.message);
    if (sel.notes || sel.next_steps) {
      await supabase.from("calls").upsert({ id, account_id: accountId, deal_id: deal_id || null, title, occurred_at: scheduled_at, summary: sel.notes, next_steps: sel.next_steps });
    }
    toast.success("Reunión guardada"); onChange();
  }
  async function genBrief() {
    await save();
    setBusy(true);
    try { const r = await brief({ data: { meetingId: sel.id } }); setSel({ ...sel, ai_brief: r.brief }); onChange(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>+ Planificar reunión</Button>
        {list.map((m) => (
          <button key={m.id} onClick={() => setSel(m)} className={`block w-full rounded-md border bg-card p-3 text-left text-sm ${sel?.id === m.id ? "border-signal" : ""}`}>
            <span className="font-medium">{m.title}</span>
            <span className="block font-mono text-xs text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : ""}</span>
          </button>
        ))}
      </div>
      {sel ? (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Título"><Input value={sel.title} onChange={(e) => setSel({ ...sel, title: e.target.value })} /></Field>
            <Field label="Fecha y hora"><Input type="datetime-local" value={sel.scheduled_at ? new Date(sel.scheduled_at).toISOString().slice(0, 16) : ""} onChange={(e) => setSel({ ...sel, scheduled_at: new Date(e.target.value).toISOString() })} /></Field>
            <Field label="Deal"><Pick value={sel.deal_id ?? ""} options={Object.fromEntries([["", "—"], ...deals.map((d) => [d.id, d.name])])} onChange={(v) => setSel({ ...sel, deal_id: v })} /></Field>
          </div>
          {stakeholders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="eyebrow mr-1 self-center">Añadir asistente:</span>
              {stakeholders.map((s) => (
                <button key={s.id} className="rounded-full border px-2.5 py-0.5 text-xs hover:border-signal" onClick={() => setSel({ ...sel, attendees: `${sel.attendees ? sel.attendees + "\n" : ""}${s.name} — ${s.title} (${BUYING_ROLES[s.buying_role] ?? ""})` })}>{s.name}</button>
              ))}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {MEETING_FIELDS.map(([k, label]) => (
              <Field key={k} label={label}><Textarea rows={3} value={sel[k] ?? ""} onChange={(e) => setSel({ ...sel, [k]: e.target.value })} /></Field>
            ))}
          </div>
          <div className="flex gap-2"><Button onClick={save}>Guardar</Button><Button variant="outline" onClick={genBrief} disabled={busy}><Sparkles className="size-4" /> {busy ? "Preparando…" : "Call Prep con IA"}</Button></div>
          {sel.ai_brief && <div><p className="eyebrow mb-2">Brief generado</p><pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm">{sel.ai_brief}</pre></div>}
        </div>
      ) : <Empty>Selecciona o planifica una reunión.</Empty>}
    </div>
  );
}

function CallsTab({ accountId, list, onChange }: { accountId: string; list: any[]; onChange: () => void }) {
  const [title, setTitle] = useState(""); const [summary, setSummary] = useState(""); const [next, setNext] = useState("");
  async function add() {
    const { error } = await supabase.from("calls").insert({ account_id: accountId, title, summary, next_steps: next });
    if (error) return toast.error(error.message);
    setTitle(""); setSummary(""); setNext(""); onChange();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <h3 className="text-2xl">Registrar llamada</h3>
        <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Qué se dijo" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <Textarea placeholder="Próximos pasos" rows={3} value={next} onChange={(e) => setNext(e.target.value)} />
        <Button disabled={!title} onClick={add}>Guardar</Button>
      </div>
      <div className="space-y-3">
        {list.length === 0 && <Empty>Sin llamadas registradas.</Empty>}
        {list.map((c) => (
          <div key={c.id} className="rounded-lg border bg-card p-4 text-sm">
            <div className="flex justify-between"><span className="font-medium">{c.title}</span><span className="font-mono text-xs text-muted-foreground">{c.occurred_at ? new Date(c.occurred_at).toLocaleDateString("es-ES") : ""}</span></div>
            {c.summary && <p className="mt-2 whitespace-pre-wrap">{c.summary}</p>}
            {c.next_steps && <p className="mt-2 text-signal">→ {c.next_steps}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DealsTab({ accountId, list, onChange }: { accountId: string; list: any[]; onChange: () => void }) {
  async function add() {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("deals").insert({ account_id: accountId, name: "Nuevo deal", owner_id: user?.id });
    if (error) return toast.error(error.message);
    onChange();
  }
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={add}>+ Nuevo deal</Button>
      {list.length === 0 && <Empty>Sin deals en esta cuenta.</Empty>}
      {list.map((d) => (
        <Link key={d.id} to="/deals" search={{ deal: d.id }} className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm hover:border-signal">
          <span className="font-medium">{d.name}</span>
          <span className="flex items-center gap-4"><span>{DEAL_STAGES.find((s) => s.id === d.stage)?.label}</span><span className="font-mono">{Number(d.amount ?? 0).toLocaleString("es-ES")} €</span><HealthDot value={d.health} /></span>
        </Link>
      ))}
    </div>
  );
}

