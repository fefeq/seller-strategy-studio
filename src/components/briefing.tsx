import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useStages } from "@/components/stage-settings";
import { SuggestionCard, useSuggestions } from "@/components/suggestions";
import { digest } from "@/lib/proactive";
import { autoWork, briefingSince, todayItems, type BriefItem } from "@/lib/briefing";

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Inicio briefing: what Nokko did on its own since yesterday · what needs your decision · what comes today. */
export function Briefing() {
  const { data: me } = useMe();
  const { money } = useCurrency();
  const { stages } = useStages();
  const { data: suggestions = [] } = useSuggestions();
  const since = briefingSince();
  const today = localDay();
  const { data } = useQuery({
    queryKey: ["briefing", since, today],
    queryFn: async () => {
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [usage, leads, memories, signals, news, jobs, meetings, tasks, deals, followups, approvals, pending] = await Promise.all([
        supabase.from("integration_usage").select("trigger,need,cost,created_at").gte("created_at", since).limit(1000),
        supabase.from("leads").select("enriched_at").gte("enriched_at", since).limit(500),
        supabase.from("memories").select("learned,created_at").gte("created_at", since).limit(500),
        supabase.from("account_signals").select("found_at").gte("found_at", since).limit(500),
        supabase.from("suggestions").select("created_at,detector").gte("created_at", since).limit(500),
        supabase.from("background_jobs").select("status,finished_at").gte("finished_at", since).limit(200),
        supabase.from("meetings").select("id,title,scheduled_at,account_id").gte("scheduled_at", startOfDay.toISOString()).lte("scheduled_at", endOfDay.toISOString()).order("scheduled_at").limit(20),
        supabase.from("tasks").select("title,due_date,done,owner_id").eq("done", false).lte("due_date", today).limit(200),
        supabase.from("deals").select("name,close_date,owner_id,stage").lte("close_date", today).limit(500),
        supabase.from("leads").select("company,next_step_at,owner_id,stage").lte("next_step_at", today).limit(500),
        supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("agent_pending_actions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        usage: usage.data ?? [], leads: leads.data ?? [], memories: memories.data ?? [], signals: signals.data ?? [], news: news.data ?? [], jobs: jobs.data ?? [],
        meetings: meetings.data ?? [], tasks: tasks.data ?? [], deals: deals.data ?? [], followups: followups.data ?? [],
        approvals: approvals.count ?? 0, pending: pending.count ?? 0,
      };
    },
  });

  const leader = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const closedKeys = new Set(stages.filter((s) => s.kind !== "open").map((s) => s.key));
  const did = data ? autoWork({ since, usage: data.usage, leads: data.leads, memories: data.memories, signals: data.signals, suggestions: data.news, jobs: data.jobs }, money) : [];
  const now = data && me ? todayItems({
    today, userId: me.user.id, leader, meetings: data.meetings, tasks: data.tasks, leads: data.followups,
    deals: data.deals.map((d) => ({ ...d, closed: closedKeys.has(d.stage) || d.stage === "won" || d.stage === "lost" })),
  }) : [];
  const top = digest(suggestions, 3);
  const others = [
    ...(leader && data?.approvals ? [{ text: `${data.approvals} ${data.approvals === 1 ? "aprobación pendiente" : "aprobaciones pendientes"}`, link: "/approvals" as const }] : []),
    ...(data?.pending ? [{ text: `${data.pending} ${data.pending === 1 ? "acción del agente por confirmar" : "acciones del agente por confirmar"}`, link: "/inbox" as const }] : []),
  ];

  return (
    <section className="mb-10 grid gap-8 border-t-2 border-foreground pt-5 lg:grid-cols-3">
      <Block title="Lo que hice solo" sub="desde ayer" empty="Nada nuevo desde ayer. Sigo vigilando tus leads, cuentas y datos." items={data ? did : null} />
      <div className="min-w-0">
        <p className="eyebrow">Necesita tu decisión</p>
        <h3 className="mt-1 text-2xl">{suggestions.length ? `${suggestions.length} ${suggestions.length === 1 ? "asunto" : "asuntos"}` : "Nada pendiente"}</h3>
        <div className="mt-3 space-y-3">
          {top.length === 0 && <p className="text-sm text-muted-foreground">Todo decidido. Te avisaré cuando detecte algo.</p>}
          {top.map((s) => <SuggestionCard key={s.id} s={s} />)}
          {others.map((o) => <ItemLine key={o.text} item={o} />)}
          {suggestions.length > top.length && <Link to="/inbox" className="block text-xs text-signal">Ver las {suggestions.length} sugerencias</Link>}
        </div>
      </div>
      <Block title="Hoy" sub={new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} empty="Sin reuniones, tareas ni seguimientos para hoy." items={data ? now : null} />
    </section>
  );
}

function Block({ title, sub, empty, items }: { title: string; sub: string; empty: string; items: BriefItem[] | null }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{sub}</p>
      <h3 className="mt-1 text-2xl">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items === null && <li className="text-muted-foreground">Cargando…</li>}
        {items?.length === 0 && <li className="text-muted-foreground">{empty}</li>}
        {items?.map((i) => <li key={i.text}><ItemLine item={i} /></li>)}
      </ul>
    </div>
  );
}

function ItemLine({ item }: { item: BriefItem }) {
  const cls = "block border-b pb-2 hover:text-signal";
  if (!item.link) return <span className="block border-b pb-2">{item.text}</span>;
  if (typeof item.link === "object") return <Link to="/accounts/$id" params={{ id: item.link.account }} className={cls}>{item.text}</Link>;
  return <Link to={item.link} className={cls}>{item.text}</Link>;
}
