import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { monthGrid } from "@/lib/crm";
import { addMonths, isMonthId, monthLabel, monthOf } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [
    { title: "Calendario — Nokko" },
    { name: "description", content: "Tareas, reuniones y cierres previstos del equipo en un calendario mensual." },
    { property: "og:title", content: "Calendario — Nokko" },
    { property: "og:description", content: "Tareas, reuniones y cierres previstos del equipo en un calendario mensual." },
  ] }),
  validateSearch: (s: Record<string, unknown>): { mes?: string } => (typeof s.mes === "string" && isMonthId(s.mes) ? { mes: s.mes } : {}),
  component: Calendar,
});

type Ev = { id: string; day: string; kind: "task" | "meeting" | "close"; title: string; to: string; search?: Record<string, string>; mine: boolean };
const DOT = { task: "bg-state-watch", meeting: "bg-lime", close: "bg-blue" } as const;
const KIND = { task: "Tarea", meeting: "Reunión", close: "Cierre" } as const;
const WEEK = ["L", "M", "X", "J", "V", "S", "D"];

function Calendar() {
  const { data: me } = useMe();
  const uid = me?.user.id;
  const month = Route.useSearch().mes ?? monthOf(new Date());
  const [onlyMine, setOnlyMine] = useState(false);
  const from = `${month}-01`;
  const to = `${addMonths(month, 1)}-01`;
  const { data: events = [] } = useQuery({
    queryKey: ["calendar", me?.currentOrg?.org_id, month],
    enabled: !!uid,
    queryFn: async () => {
      const [t, m, d] = await Promise.all([
        supabase.from("tasks").select("id,title,due_date,owner_id,account_id,deal_id").eq("done", false).gte("due_date", from).lt("due_date", to).limit(500),
        supabase.from("meetings").select("id,title,scheduled_at,account_id,created_by").gte("scheduled_at", from).lt("scheduled_at", to).limit(500),
        supabase.from("deals").select("id,name,close_date,owner_id,stage").gte("close_date", from).lt("close_date", to).not("stage", "in", "(won,lost)").limit(500),
      ]);
      const out: Ev[] = [];
      for (const x of t.data ?? []) out.push({ id: `t${x.id}`, day: x.due_date!, kind: "task", title: x.title, to: x.deal_id ? "/deals" : x.account_id ? `/accounts/${x.account_id}` : "/inbox", search: x.deal_id ? { deal: x.deal_id } : undefined, mine: x.owner_id === uid });
      for (const x of m.data ?? []) out.push({ id: `m${x.id}`, day: x.scheduled_at!.slice(0, 10), kind: "meeting", title: x.title, to: x.account_id ? `/accounts/${x.account_id}` : "/home", search: x.account_id ? { tab: "meetings", meeting: x.id } : undefined, mine: x.created_by === uid });
      for (const x of d.data ?? []) out.push({ id: `d${x.id}`, day: x.close_date!, kind: "close", title: x.name, to: "/deals", search: { deal: x.id }, mine: x.owner_id === uid });
      return out;
    },
  });
  const shown = onlyMine ? events.filter((e) => e.mine) : events;
  const today = new Date().toISOString().slice(0, 10);
  const counts = { task: shown.filter((e) => e.kind === "task").length, meeting: shown.filter((e) => e.kind === "meeting").length, close: shown.filter((e) => e.kind === "close").length };

  return (
    <Page eyebrow="Calendario" title={shown.length ? `${monthLabel(month)}: ${counts.meeting} reuniones, ${counts.task} tareas y ${counts.close} cierres` : `Calendario · ${monthLabel(month)}`} actions={
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/calendar" search={{ mes: addMonths(month, -1) }} aria-label="Mes anterior">←</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/calendar" search={{}}>Hoy</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/calendar" search={{ mes: addMonths(month, 1) }} aria-label="Mes siguiente">→</Link></Button>
        <label className="ml-2 flex items-center gap-2 text-sm"><Checkbox checked={onlyMine} onCheckedChange={(v) => setOnlyMine(!!v)} />Solo lo mío</label>
      </div>
    }>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-mid">{(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${DOT[k]}`} />{KIND[k]}</span>)}</div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-xl border bg-card">
          {WEEK.map((w) => <div key={w} className="border-b bg-paper-sunk px-2 py-1.5 text-xs text-ink-mid">{w}</div>)}
          {monthGrid(month).flat().map((day, i) => {
            const evs = day ? shown.filter((e) => e.day === day) : [];
            return (
              <div key={i} className={`min-h-28 border-b border-r p-1.5 ${day ? "" : "bg-paper-sunk/40"}`}>
                {day && <p className={`mb-1 text-xs ${day === today ? "inline-flex size-6 items-center justify-center rounded-full bg-lime font-medium text-lime-foreground" : "text-ink-mid"}`}>{Number(day.slice(8))}</p>}
                <ul className="space-y-1">
                  {evs.slice(0, 4).map((e) => (
                    <li key={e.id}><Link to={e.to} search={e.search ?? {}} className="flex items-start gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-muted"><span className={`mt-1 size-1.5 shrink-0 rounded-full ${DOT[e.kind]}`} /><span className="line-clamp-2 break-words">{e.title}</span></Link></li>
                  ))}
                  {evs.length > 4 && <li className="px-1 text-xs text-muted-foreground">+{evs.length - 4} más</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
