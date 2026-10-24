import { JobProgress, useJob } from "@/components/background";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { useStages } from "@/components/stage-settings";
import { SuggestionCard, useSuggestions } from "@/components/suggestions";
import { digest } from "@/lib/proactive";
import { autoWork, briefingSince, todayItems, type BriefItem } from "@/lib/briefing";

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Inicio briefing: what Nokko did on its own since yesterday · what needs your decision · what comes today. */
export function Briefing({ hideSetup = false }: { hideSetup?: boolean }) {
  const { data: me } = useMe();
  const { currency } = useCurrency();
  // Automatic spend is often cents: show them instead of rounding to 0.
  const money = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: n < 1 ? 2 : 0 }).format(n);
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
        supabase.from("suggestions").select("created_at,detector").eq("status", "pending").gte("created_at", since).limit(500),
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
  // The strategy card already shows what is missing; don't repeat it here.
  const shown = hideSetup ? suggestions.filter((x) => !x.dedupe_key?.startsWith("setup_incomplete:")) : suggestions;
  const others = [
    ...(leader && data?.approvals ? [{ text: `${data.approvals} ${data.approvals === 1 ? "aprobación pendiente" : "aprobaciones pendientes"}`, link: "/approvals" as const }] : []),
    ...(data?.pending ? [{ text: `${data.pending} ${data.pending === 1 ? "acción del agente por confirmar" : "acciones del agente por confirmar"}`, link: "/inbox" as const }] : []),
  ];

  return (
    <section className="mb-8 grid items-start gap-5 lg:grid-cols-2">
      <div className="min-w-0 rounded-xl border bg-card p-5 shadow-xs">
        <Block title="Hoy" sub={new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} empty="Sin reuniones, tareas ni seguimientos para hoy." items={data ? now : null} />
        {others.length > 0 && <div className="mt-3 space-y-2 text-sm">{others.map((o) => <ItemLine key={o.text} item={o} />)}</div>}
      </div>
      <details className="group min-w-0 rounded-xl border bg-card p-5 shadow-xs lg:open:row-span-1" open={false}>
        <summary className="cursor-pointer list-none">
          <p className="eyebrow">Desde ayer</p>
          <h3 className="mt-1 flex items-center justify-between text-2xl">Lo que hice solo <span className="text-sm font-normal text-ink-faint">{data ? did.length : ""} <span className="group-open:hidden">+</span><span className="hidden group-open:inline">−</span></span></h3>
        </summary>
        <ul className="mt-3 space-y-2 text-sm">
          {data && did.length === 0 && <li className="text-muted-foreground">Nada nuevo desde ayer. Sigo vigilando tus leads, cuentas y datos.</li>}
          {did.map((i) => <li key={i.text}><ItemLine item={i} /></li>)}
        </ul>
        {leader && <RunNow />}
      </details>
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

/** Owner / Sales Leader: run now what Nokko does every hour (research new accounts, prep meetings, review cooling accounts). */
function RunNow() {
  const qc = useQueryClient();
  const { job, running, start, cancel } = useJob("autopilot_now", { onDone: () => { qc.invalidateQueries({ queryKey: ["briefing"] }); qc.invalidateQueries({ queryKey: ["suggestions"] }); } });
  if (running) return <JobProgress job={job} onCancel={cancel} className="mt-3 text-xs" />;
  return <button type="button" onClick={() => start({})} className="mt-3 text-xs text-signal">Hazlo ahora, sin esperar a la próxima hora</button>;
}
