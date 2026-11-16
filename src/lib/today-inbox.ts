// B3 (PLAN-UX-20261115): one inbox in Hoy that merges suggestions, approvals, tasks and the agent's pending
// actions. Surface only: each item links to the screen that already decides it; no table changes. Pure, tested.
export type InboxKind = "sugerencia" | "aprobacion" | "tarea" | "agente";
export type InboxFilter = "todo" | InboxKind;

export type InboxItem = {
  id: string;
  kind: InboxKind;
  title: string;
  /** 1 urgent · 2 important · 3 when you can. */
  priority: 1 | 2 | 3;
  at: string;
  /** Screen that decides it; a task opens its account, or nothing when it has none. */
  href: "/inbox" | "/approvals" | null;
  accountId?: string | null;
};

export const INBOX_FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "sugerencia", label: "Sugerencias" },
  { id: "aprobacion", label: "Aprobaciones" },
  { id: "tarea", label: "Tareas" },
  { id: "agente", label: "Del agente" },
];

type Sug = { id: string; title: string; priority?: number | null; created_at: string };
type Appr = { id: string; title: string; created_at: string };
type Task = {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  account_id?: string | null;
};
type Act = { id: string; summary: string; created_at: string };

const prio = (n: number | null | undefined): 1 | 2 | 3 => (n === 1 ? 1 : n === 3 ? 3 : 2);

/** A task due today or earlier is urgent; with a future date, important; without date, when you can. */
export function taskPriority(due: string | null, today: string): 1 | 2 | 3 {
  if (!due) return 3;
  return due.slice(0, 10) <= today ? 1 : 2;
}

export function mergeInbox(
  s: { suggestions: Sug[]; approvals: Appr[]; tasks: Task[]; actions: Act[] },
  today: string,
): InboxItem[] {
  const items: InboxItem[] = [
    ...s.suggestions.map((x) => ({
      id: `s:${x.id}`,
      kind: "sugerencia" as const,
      title: x.title,
      priority: prio(x.priority),
      at: x.created_at,
      href: "/inbox" as const,
    })),
    ...s.approvals.map((x) => ({
      id: `a:${x.id}`,
      kind: "aprobacion" as const,
      title: x.title,
      priority: 1 as const,
      at: x.created_at,
      href: "/approvals" as const,
    })),
    ...s.tasks.map((x) => ({
      id: `t:${x.id}`,
      kind: "tarea" as const,
      title: x.title,
      priority: taskPriority(x.due_date, today),
      at: x.due_date ?? x.created_at,
      href: null,
      accountId: x.account_id ?? null,
    })),
    ...s.actions.map((x) => ({
      id: `g:${x.id}`,
      kind: "agente" as const,
      title: x.summary,
      priority: 1 as const,
      at: x.created_at,
      href: "/inbox" as const,
    })),
  ];
  return items.sort((a, b) => a.priority - b.priority || a.at.localeCompare(b.at));
}

export function filterInbox(items: InboxItem[], f: InboxFilter): InboxItem[] {
  return f === "todo" ? items : items.filter((i) => i.kind === f);
}

export function inboxCounts(items: InboxItem[]): Record<InboxFilter, number> {
  const c: Record<InboxFilter, number> = {
    todo: items.length,
    sugerencia: 0,
    aprobacion: 0,
    tarea: 0,
    agente: 0,
  };
  for (const i of items) c[i.kind]++;
  return c;
}
