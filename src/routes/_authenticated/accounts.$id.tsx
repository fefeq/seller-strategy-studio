import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import { Page, Empty, HealthDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Field, Pick } from "@/components/fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUYING_ROLES, SUPPORT } from "@/lib/roles";
import { stageLabel } from "@/lib/stages";
import { useStages } from "@/components/stage-settings";
import { generateMeetingBrief, generateProposal, listeningCoaching, researchStakeholder } from "@/lib/ai.functions";
import { LevelPicker } from "@/components/theory-u/listening";
import { errorText } from "@/lib/errors";
import { latestOf, scoreAccount } from "@/lib/scoring";
import { ScoreDetail } from "@/components/score";

export const Route = createFileRoute("/_authenticated/accounts/$id")({
  head: () => ({ meta: [{ title: "Cuenta — Nokko" }, { name: "description", content: "Plan de cuenta, stakeholders y reuniones." }, { property: "og:title", content: "Cuenta — Nokko" }, { property: "og:description", content: "Plan de cuenta, stakeholders y reuniones." }] }),
  component: AccountPage,
});

function AccountPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["account", id],
    queryFn: async () => {
      const [a, plan, sh, mt, calls, deals, touches, icps, segs] = await Promise.all([
        supabase.from("accounts").select("*").eq("id", id).single(),
        supabase.from("account_plans").select("*").eq("account_id", id).maybeSingle(),
        supabase.from("stakeholders").select("*").eq("account_id", id).order("created_at"),
        supabase.from("meetings").select("*").eq("account_id", id).order("scheduled_at", { ascending: false }),
        supabase.from("calls").select("*").eq("account_id", id).order("occurred_at", { ascending: false }),
        supabase.from("deals").select("*").eq("account_id", id),
        supabase.from("account_touches").select("occurred_at").eq("account_id", id),
        supabase.from("icp_profiles").select("id,segment_id,industries,company_size,geography,anti_icp"),
        supabase.from("segments").select("id,name"),
      ]);
      return { account: a.data, plan: plan.data, stakeholders: sh.data ?? [], meetings: mt.data ?? [], calls: calls.data ?? [], deals: deals.data ?? [], touches: touches.data ?? [], icps: icps.data ?? [], segNames: new Map((segs.data ?? []).map((s) => [s.id, s.name])) };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["account", id] });
  if (!data?.account) return <Page title="Cargando…"><div /></Page>;
  const a = data.account;
  const now = new Date();
  const score = scoreAccount({
    ...a,
    lastActivityAt: latestOf(...data.touches.map((t) => t.occurred_at), ...data.meetings.map((m) => m.scheduled_at).filter((d): d is string => !!d && d <= now.toISOString()), ...data.calls.map((c) => c.occurred_at), ...data.deals.map((d) => d.updated_at)),
    openDeals: data.deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
  }, data.icps, now, data.segNames);

  return (
    <Page eyebrow="Cuenta" title={a.name} actions={
      <div className="flex flex-wrap items-center gap-2">
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
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <ScoreDetail score={score} />
        <FitFields account={a} segNames={data.segNames} onSaved={refresh} />
      </div>
      <Tabs defaultValue="plan">
        <TabsList className="mb-6">
          <TabsTrigger value="plan">Plan de cuenta</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders ({data.stakeholders.length})</TabsTrigger>
          <TabsTrigger value="meetings">Planificador de reuniones ({data.meetings.length})</TabsTrigger>
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

/** Segment, sector and size: what the ICP fit is measured against. Saved on blur. */
function FitFields({ account, segNames, onSaved }: { account: { id: string; segment_id: string | null; industry: string | null; size: string | null }; segNames: Map<string, string>; onSaved: () => void }) {
  const [f, setF] = useState({ segment_id: account.segment_id ?? "", industry: account.industry ?? "", size: account.size ?? "" });
  useEffect(() => setF({ segment_id: account.segment_id ?? "", industry: account.industry ?? "", size: account.size ?? "" }), [account.segment_id, account.industry, account.size]);
  async function save(patch: Partial<typeof f>) {
    const next = { ...f, ...patch };
    setF(next);
    if (next.segment_id === (account.segment_id ?? "") && next.industry === (account.industry ?? "") && next.size === (account.size ?? "")) return;
    const { error } = await supabase.from("accounts").update({ segment_id: next.segment_id || null, industry: next.industry || null, size: next.size || null }).eq("id", account.id);
    if (error) return toast.error(errorText(error));
    onSaved();
  }
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <p className="eyebrow">Datos para el encaje</p>
      <Field label="Segmento"><Pick value={f.segment_id} options={{ "": "Sin segmento", ...Object.fromEntries(segNames) }} onChange={(v) => save({ segment_id: v })} /></Field>
      <Field label="Sector"><Input value={f.industry} placeholder="Fintech, logística…" onChange={(e) => setF({ ...f, industry: e.target.value })} onBlur={() => save({})} /></Field>
      <Field label="Tamaño"><Input value={f.size} placeholder="Empleados: 200" onChange={(e) => setF({ ...f, size: e.target.value })} onBlur={() => save({})} /></Field>
    </div>
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
    if (error) return toast.error(errorText(error));
    toast.success("Plan de cuenta guardado.");
    onSaved();
  }
  async function genProposal() {
    setBusy(true);
    try { setProposal((await propose({ data: { accountId } })).text); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {PLAN_FIELDS.map(([k, label, hint]) => (
          <div key={k} className="space-y-1.5 rounded-lg border bg-card p-4">
            <Label className="font-display text-[22px] font-medium normal-case leading-7 tracking-normal text-ink">{label}</Label>
            <Textarea rows={4} placeholder={hint} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save}>Guardar plan</Button>
        <Button variant="outline" onClick={genProposal} disabled={busy}><Sparkles className="size-4" /> {busy ? "Generando…" : "Borrador de propuesta con IA"}</Button>
      </div>
      {proposal && <pre className="whitespace-pre-wrap break-words rounded-lg border bg-card p-6 font-sans text-sm">{proposal}</pre>}
    </div>
  );
}

function StakeholdersTab({ accountId, list, onChange }: { accountId: string; list: any[]; onChange: () => void }) {
  const [sel, setSel] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const detailRef = useRevealOnMobile(sel?.id);
  const research = useServerFn(researchStakeholder);
  async function add() {
    const { data, error } = await supabase.from("stakeholders").insert({ account_id: accountId, name: "Nueva persona" }).select().single();
    if (error) return toast.error(errorText(error));
    setSel(data); onChange();
  }
  async function save() {
    const { id, name, title, email, linkedin_url, buying_role, support, priorities, reports_to } = sel;
    const { error } = await supabase.from("stakeholders").update({ name, title, email, linkedin_url, buying_role, support, priorities, reports_to: reports_to || null }).eq("id", id);
    if (error) return toast.error(errorText(error));
    toast.success("Guardado."); onChange();
  }
  async function runResearch() {
    setBusy(true);
    try { const r = await research({ data: { stakeholderId: sel.id } }); setSel({ ...sel, research: r.text }); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  const roots = list.filter((s) => !s.reports_to || !list.find((x) => x.id === s.reports_to));
  const children = (pid: string) => list.filter((s) => s.reports_to === pid);
  const Node = ({ s }: { s: any }) => (
    <li className="ml-2 border-l pl-2 sm:ml-4 sm:pl-4">
      <button onClick={() => setSel(s)} className={`my-1 max-w-full break-words rounded-md border bg-card px-3 py-2 text-left text-sm ${sel?.id === s.id ? "border-signal" : ""}`}>
        <span className="font-medium">{s.name}</span> <span className="text-muted-foreground">· {s.title}</span>
        <span className="mt-1 flex flex-wrap gap-1.5 font-mono text-[10px] uppercase">
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
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-2xl">Mapa de poder</h3><Button size="sm" onClick={add}>+ Persona</Button></div>
        {list.length === 0 ? <Empty>Añade a las personas involucradas en la compra.</Empty> : <ul className="-ml-2 sm:-ml-4">{roots.map((s) => <Node key={s.id} s={s} />)}</ul>}
      </div>
      {sel ? (
        <div ref={detailRef} className="scroll-mt-20 space-y-3 rounded-lg border bg-card p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre"><Input value={sel.name ?? ""} onChange={(e) => setSel({ ...sel, name: e.target.value })} /></Field>
            <Field label="Cargo"><Input value={sel.title ?? ""} onChange={(e) => setSel({ ...sel, title: e.target.value })} /></Field>
            <Field label="Email"><Input value={sel.email ?? ""} onChange={(e) => setSel({ ...sel, email: e.target.value })} /></Field>
            <Field label="LinkedIn"><Input value={sel.linkedin_url ?? ""} onChange={(e) => setSel({ ...sel, linkedin_url: e.target.value })} /></Field>
            <Field label="Rol en la compra"><Pick value={sel.buying_role} options={BUYING_ROLES} onChange={(v) => setSel({ ...sel, buying_role: v })} /></Field>
            <Field label="Nivel de apoyo"><Pick value={sel.support} options={SUPPORT} onChange={(v) => setSel({ ...sel, support: v })} /></Field>
            <Field label="Reporta a"><Pick value={sel.reports_to ?? ""} options={Object.fromEntries([["", "—"], ...list.filter((x) => x.id !== sel.id).map((x) => [x.id, x.name])])} onChange={(v) => setSel({ ...sel, reports_to: v })} /></Field>
          </div>
          <Field label="Prioridades y notas"><Textarea rows={3} value={sel.priorities ?? ""} onChange={(e) => setSel({ ...sel, priorities: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-2"><Button onClick={save}>Guardar</Button><Button variant="outline" onClick={runResearch} disabled={busy}><Sparkles className="size-4" /> {busy ? "Investigando…" : "Research con IA"}</Button></div>
          {sel.research && <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-sans text-sm">{sel.research}</pre>}
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
  const [coachBusy, setCoachBusy] = useState(false);
  const detailRef = useRevealOnMobile(sel?.id);
  const brief = useServerFn(generateMeetingBrief);
  const coach = useServerFn(listeningCoaching);
  async function add() {
    const { data, error } = await supabase.from("meetings").insert({ account_id: accountId, title: "Nueva reunión", scheduled_at: new Date(Date.now() + 864e5).toISOString() }).select().single();
    if (error) return toast.error(errorText(error));
    setSel(data); onChange();
  }
  async function save() {
    const { id, title, scheduled_at, deal_id, ...rest } = sel;
    const payload: Record<string, any> = { title, scheduled_at, deal_id: deal_id || null, listening_level: rest.listening_level ?? null, listening_reflection: rest.listening_reflection ?? "" };
    for (const [k] of MEETING_FIELDS) payload[k] = rest[k];
    const { error } = await supabase.from("meetings").update(payload as any).eq("id", id);
    if (error) { toast.error(errorText(error)); return false; }
    if (sel.notes || sel.next_steps) {
      await supabase.from("calls").upsert({ id, account_id: accountId, deal_id: deal_id || null, title, occurred_at: scheduled_at, summary: sel.notes, next_steps: sel.next_steps });
    }
    toast.success("Reunión guardada."); onChange();
    return true;
  }
  async function genBrief() {
    await save();
    setBusy(true);
    try { const r = await brief({ data: { meetingId: sel.id } }); setSel({ ...sel, ai_brief: r.brief }); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  async function genCoaching() {
    if (!(await save())) return;
    setCoachBusy(true);
    try { const r = await coach({ data: { meetingId: sel.id } }); setSel({ ...sel, listening_coaching: r.text }); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setCoachBusy(false); }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={add}>+ Planificar reunión</Button>
        {list.map((m) => (
          <button key={m.id} onClick={() => setSel(m)} className={`block w-full rounded-md border bg-card p-3 text-left text-sm ${sel?.id === m.id ? "border-signal" : ""}`}>
            <span className="break-words font-medium">{m.title}</span>
            <span className="block font-mono text-xs text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : ""}</span>
          </button>
        ))}
      </div>
      {sel ? (
        <div ref={detailRef} className="scroll-mt-20 space-y-4 rounded-lg border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Título"><Input value={sel.title} onChange={(e) => setSel({ ...sel, title: e.target.value })} /></Field>
            <Field label="Fecha y hora"><Input type="datetime-local" value={sel.scheduled_at ? new Date(sel.scheduled_at).toISOString().slice(0, 16) : ""} onChange={(e) => setSel({ ...sel, scheduled_at: new Date(e.target.value).toISOString() })} /></Field>
            <Field label="Deal"><Pick value={sel.deal_id ?? ""} options={Object.fromEntries([["", "—"], ...deals.map((d) => [d.id, d.name])])} onChange={(v) => setSel({ ...sel, deal_id: v })} /></Field>
          </div>
          {stakeholders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="eyebrow mr-1 self-center">Añadir asistente:</span>
              {stakeholders.map((s) => (
                <button key={s.id} className="min-h-8 rounded-none border px-2.5 py-1.5 text-xs hover:border-signal md:min-h-0 md:py-0.5" onClick={() => setSel({ ...sel, attendees: `${sel.attendees ? sel.attendees + "\n" : ""}${s.name} — ${s.title} (${BUYING_ROLES[s.buying_role] ?? ""})` })}>{s.name}</button>
              ))}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {MEETING_FIELDS.map(([k, label]) => (
              <Field key={k} label={label}><Textarea rows={3} value={sel[k] ?? ""} onChange={(e) => setSel({ ...sel, [k]: e.target.value })} /></Field>
            ))}
          </div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => save()}>Guardar</Button><Button variant="outline" onClick={genBrief} disabled={busy}><Sparkles className="size-4" /> {busy ? "Preparando…" : "Preparar llamada con IA"}</Button></div>
          {sel.ai_brief && <div><p className="eyebrow mb-2">Brief generado</p><pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-sans text-sm">{sel.ai_brief}</pre></div>}
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="eyebrow">Después: ¿cómo escuchaste? · Theory U</p>
              <p className="text-xs text-muted-foreground">Descarga → Factual → Empática → Generativa. Sé honesto: sirve para mejorar, no para evaluar.</p>
            </div>
            <LevelPicker value={sel.listening_level} onChange={(l) => setSel({ ...sel, listening_level: l })} />
            <Textarea rows={2} placeholder="¿En qué momento escuchaste de verdad? ¿Cuándo estabas pensando en tu pitch?" value={sel.listening_reflection ?? ""} onChange={(e) => setSel({ ...sel, listening_reflection: e.target.value })} />
            <Button variant="outline" size="sm" onClick={genCoaching} disabled={coachBusy}><Sparkles className="size-4" /> {coachBusy ? "Analizando…" : "Coaching de escucha con IA"}</Button>
            {sel.listening_coaching && <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-sans text-sm">{sel.listening_coaching}</pre>}
          </div>
        </div>
      ) : <Empty>Selecciona o planifica una reunión.</Empty>}
    </div>
  );
}

function CallsTab({ accountId, list, onChange }: { accountId: string; list: any[]; onChange: () => void }) {
  const [title, setTitle] = useState(""); const [summary, setSummary] = useState(""); const [next, setNext] = useState("");
  async function add() {
    const { error } = await supabase.from("calls").insert({ account_id: accountId, title, summary, next_steps: next });
    if (error) return toast.error(errorText(error));
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
        {list.length === 0 && <Empty>Sin llamadas registradas. Registra la primera con el formulario.</Empty>}
        {list.map((c) => (
          <div key={c.id} className="rounded-lg border bg-card p-4 text-sm">
            <div className="flex justify-between gap-3"><span className="min-w-0 break-words font-medium">{c.title}</span><span className="shrink-0 font-mono text-xs text-muted-foreground">{c.occurred_at ? new Date(c.occurred_at).toLocaleDateString("es-ES") : ""}</span></div>
            {c.summary && <p className="mt-2 whitespace-pre-wrap break-words">{c.summary}</p>}
            {c.next_steps && <p className="mt-2 text-signal">→ {c.next_steps}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DealsTab({ accountId, list, onChange }: { accountId: string; list: any[]; onChange: () => void }) {
  const { stages } = useStages();
  const { money: eur } = useCurrency();
  async function add() {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("deals").insert({ account_id: accountId, name: "Nuevo deal", owner_id: user?.id });
    if (error) return toast.error(errorText(error));
    onChange();
  }
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={add}>+ Nuevo deal</Button>
      {list.length === 0 && <Empty>Esta cuenta no tiene deals. Crea uno con «+ Nuevo deal».</Empty>}
      {list.map((d) => (
        <Link key={d.id} to="/deals" search={{ deal: d.id }} className="flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-sm hover:border-signal sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 break-words font-medium">{d.name}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:shrink-0"><span>{stageLabel(d.stage, stages)}</span><span className="font-mono">{eur(Number(d.amount ?? 0))}</span><HealthDot value={d.health} /></span>
        </Link>
      ))}
    </div>
  );
}

/** On < lg the editor sits below the list: bring it into view when a new item is selected. */
function useRevealOnMobile(key: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!key || !ref.current || !window.matchMedia("(max-width: 1023px)").matches) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [key]);
  return ref;
}
