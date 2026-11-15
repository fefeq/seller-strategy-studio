// B3: the single inbox in Hoy. Reads what each screen already reads (RLS) and links to where it is decided.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useSuggestions } from "@/components/suggestions";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/page";
import { INBOX_FILTERS, filterInbox, inboxCounts, mergeInbox, type InboxFilter, type InboxItem } from "@/lib/today-inbox";

const KIND_LABEL: Record<InboxItem["kind"], string> = {
  sugerencia: "Sugerencia",
  aprobacion: "Aprobación",
  tarea: "Tarea",
  agente: "Agente",
};

export function TodayInbox() {
  const { data: me } = useMe();
  const userId = me?.user.id;
  const leader = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const { data: suggestions = [] } = useSuggestions();
  const [filter, setFilter] = useState<InboxFilter>("todo");
  const { data } = useQuery({
    queryKey: ["today-inbox", userId, leader],
    enabled: !!userId,
    queryFn: async () => {
      const [appr, tasks, acts] = await Promise.all([
        leader
          ? supabase.from("approvals").select("id,title,created_at").eq("status", "pending").limit(50)
          : Promise.resolve({ data: [] as { id: string; title: string; created_at: string }[] }),
        supabase
          .from("tasks")
          .select("id,title,due_date,created_at,account_id")
          .eq("done", false)
          .eq("owner_id", userId!)
          .limit(50),
        supabase
          .from("agent_pending_actions")
          .select("id,summary,created_at")
          .eq("status", "pending")
          .eq("user_id", userId!)
          .limit(50),
      ]);
      return { approvals: appr.data ?? [], tasks: tasks.data ?? [], actions: acts.data ?? [] };
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const items = mergeInbox(
    { suggestions, approvals: data?.approvals ?? [], tasks: data?.tasks ?? [], actions: data?.actions ?? [] },
    today,
  );
  const counts = inboxCounts(items);
  const shown = filterInbox(items, filter).slice(0, 8);
  return (
    <Panel title="Tu bandeja">
      <div role="group" aria-label="Filtrar bandeja" className="mb-3 flex flex-wrap gap-1">
        {INBOX_FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} · {counts[f.id]}
          </Button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">Nada pendiente aquí.</p>}
      <ul className="divide-y">
        {shown.map((i) => {
          const body = (
            <>
              <span className="min-w-0 break-words">{i.title}</span>
              <span className={`shrink-0 font-mono text-xs uppercase ${i.priority === 1 ? "text-signal" : "text-muted-foreground"}`}>
                {KIND_LABEL[i.kind]}
              </span>
            </>
          );
          const cls = "flex items-start justify-between gap-3 py-2.5 text-sm";
          return (
            <li key={i.id}>
              {i.href ? (
                <Link to={i.href} className={`${cls} hover:text-signal`}>{body}</Link>
              ) : i.accountId ? (
                <Link to="/accounts/$id" params={{ id: i.accountId }} className={`${cls} hover:text-signal`}>{body}</Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
