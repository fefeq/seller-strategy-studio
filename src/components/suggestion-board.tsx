import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { decideSuggestion } from "@/lib/agent.functions";
import { STATUS_LABEL, ageDays, boardSummary, byOwner, canSeeTeam, closedSummary, isOverdue } from "@/lib/suggestion-board";
import { linkTarget } from "@/lib/proactive/resolve";
import { errorText } from "@/lib/errors";

const PRIO: Record<number, string> = { 1: "Urgente", 2: "Importante", 3: "Cuando puedas" };
const sel = "h-10 rounded-md border bg-card px-2 text-sm md:h-9";
// Filter selects stretch to share the row on phones.
const filterSel = `${sel} min-w-[9.5rem] flex-1 sm:flex-none`;

export function SuggestionBoard() {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id;
  const myId = me?.user.id;
  const leader = canSeeTeam(me?.roles ?? []);
  const qc = useQueryClient();
  const decide = useServerFn(decideSuggestion);
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("open");
  const [prio, setPrio] = useState("all");
  const [grouped, setGrouped] = useState(false);

  const { data } = useQuery({
    queryKey: ["suggestions", "board", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [s, m] = await Promise.all([
        supabase.from("suggestions").select("id,title,body,priority,link,action,status,user_id,created_at,updated_at,snoozed_until")
          .eq("org_id", orgId!).or(`status.in.(pending,snoozed),updated_at.gte.${since}`).order("priority").order("created_at").limit(500),
        supabase.from("org_members").select("user_id").eq("org_id", orgId!),
      ]);
      const ids = (m.data ?? []).map((x) => x.user_id);
      const { data: p } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      return { items: s.data ?? [], members: (p ?? []).map((x) => ({ id: x.id, name: x.full_name || "Sin nombre" })) };
    },
  });

  const name = (id: string | null) => (id ? data?.members.find((m) => m.id === id)?.name ?? "Ex-miembro" : "Sin responsable");
  const items = data?.items ?? [];
  const summary = useMemo(() => boardSummary(items), [items]);
  const closed = useMemo(() => closedSummary(items), [items]);
  const groups = useMemo(() => byOwner(items), [items]);
  const rows = items.filter((s) =>
    (status === "open" ? s.status === "pending" || s.status === "snoozed" : status === "closed" ? !["pending", "snoozed"].includes(s.status) : s.status === status)
    && (owner === "all" || (owner === "none" ? !s.user_id : s.user_id === owner))
    && (prio === "all" || String(s.priority) === prio));

  async function assign(id: string, userId: string | null) {
    const { error } = await supabase.from("suggestions").update({ user_id: userId }).eq("id", id);
    if (error) return toast.error(errorText(error));
    toast.success(userId ? `Asignada a ${name(userId)}` : "Sin responsable");
    qc.invalidateQueries({ queryKey: ["suggestions"] });
  }
  async function act(id: string, decision: "approve" | "snooze" | "dismiss") {
    try { toast.success((await decide({ data: { id, decision } })).message); qc.invalidateQueries(); }
    catch (e) { toast.error(errorText(e)); }
  }
  type Row = (typeof rows)[number];
  // Shared by the table (md+) and the phone cards.
  const ownerCell = (s: Row) => leader && ["pending", "snoozed"].includes(s.status) ? (
    <select className={sel} value={s.user_id ?? ""} onChange={(e) => assign(s.id, e.target.value || null)} aria-label="Asignar responsable">
      <option value="">Sin responsable</option>
      {data?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  ) : (
    <div>
      <p className={s.user_id ? "" : "text-signal"}>{name(s.user_id)}</p>
      {!s.user_id && ["pending", "snoozed"].includes(s.status) && myId && <Button size="sm" variant="outline" className="mt-1" onClick={() => assign(s.id, myId)}>Me la quedo</Button>}
    </div>
  );
  const rowActions = (s: Row) => {
    const open = s.status === "pending";
    return (
      <div className="flex gap-1">
        {s.link && (() => { const t = linkTarget(s.link)!; return <Button size="icon" variant="ghost" asChild aria-label="Abrir"><Link to={t.to} search={t.search}><span aria-hidden>→</span></Link></Button>; })()}
        {open && <Button size="icon" variant="ghost" aria-label={(s.action)?.tool ? "Aprobar y hacer" : "Marcar como hecha"} onClick={() => act(s.id, "approve")}><span aria-hidden>✓</span></Button>}
        {open && <Button size="icon" variant="ghost" aria-label="Posponer 3 días" onClick={() => act(s.id, "snooze")}><span aria-hidden className="text-xs">+3 d</span></Button>}
        {open && <Button size="icon" variant="ghost" aria-label="Descartar" onClick={() => act(s.id, "dismiss")}><span aria-hidden>×</span></Button>}
      </div>
    );
  };
  const statusText = (s: Row) => <>
    {STATUS_LABEL[s.status] ?? s.status}
    {s.status === "snoozed" && s.snoozed_until && <span className="block text-xs text-muted-foreground">hasta {new Date(s.snoozed_until).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>}
  </>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{leader ? "Todas las sugerencias de la empresa, con su responsable y estado." : "Tus sugerencias y las que aún no tienen responsable. Owner y Sales Leader ven las de todo el equipo."}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {([["Pendientes", summary.pending, "pending", "all"], ["Urgentes", summary.urgent, "pending", "all"], ["Sin responsable", summary.unassigned, "open", "none"], ["Pospuestas", summary.snoozed, "snoozed", "all"], [`Vencidas (+7 días)`, summary.overdue, "pending", "all"]] as const).map(([label, n, st, ow]) => (
          <button key={label} onClick={() => { setStatus(st); setOwner(ow); setPrio(label === "Urgentes" ? "1" : "all"); }} className="min-w-0 rounded-lg border bg-card p-4 text-left hover:border-signal">
            <p className="eyebrow break-words">{label}</p>
            <p className={`mt-1 font-display text-3xl ${n && (label === "Urgentes" || label.startsWith("Vencidas") || label === "Sin responsable") ? "text-signal" : ""}`}>{n}</p>
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Últimos 30 días:{" "}
        <button className="underline-offset-2 hover:underline" onClick={() => { setStatus("approved"); setOwner("all"); setPrio("all"); }}>{closed.done} hechas</button> ·{" "}
        <button className="underline-offset-2 hover:underline" onClick={() => { setStatus("resolved"); setOwner("all"); setPrio("all"); }}>{closed.solved} resueltas solas</button> ·{" "}
        <button className="underline-offset-2 hover:underline" onClick={() => { setStatus("dismissed"); setOwner("all"); setPrio("all"); }}>{closed.dismissed} descartadas</button>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select className={filterSel} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
          <option value="all">Todos los responsables</option>
          <option value="none">Sin responsable</option>
          {data?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className={filterSel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="open">Abiertas</option><option value="pending">Pendientes</option><option value="snoozed">Pospuestas</option><option value="closed">Cerradas (30 días)</option>
          <option value="approved">Hechas (30 días)</option><option value="resolved">Resueltas solas (30 días)</option><option value="dismissed">Descartadas (30 días)</option>
        </select>
        <select className={filterSel} value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Prioridad">
          <option value="all">Todas las prioridades</option><option value="1">Urgente</option><option value="2">Importante</option><option value="3">Cuando puedas</option>
        </select>
        <Button variant={grouped ? "default" : "outline"} size="sm" onClick={() => setGrouped((g) => !g)}>Por persona</Button>
      </div>

      {grouped && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Nadie tiene sugerencias abiertas.</p>}
          {groups.map((g) => (
            <button key={g.owner ?? "none"} onClick={() => { setOwner(g.owner ?? "none"); setStatus("open"); setPrio("all"); }} className="rounded-lg border bg-card p-4 text-left hover:border-signal">
              <p className="font-medium">{name(g.owner)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{g.pending} pendientes · <span className={g.urgent ? "text-signal" : ""}>{g.urgent} urgentes</span> · {g.overdue} vencidas · {g.snoozed} pospuestas</p>
            </button>
          ))}
        </div>
      )}

      {/* Phones: one card per suggestion; the table from md. */}
      <div className="rounded-lg border bg-card md:hidden">
        {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No hay sugerencias con estos filtros.</p>}
        <div className="divide-y divide-hairline">
          {rows.map((s) => {
            const overdue = isOverdue(s);
            return (
              <div key={s.id} className="space-y-3 py-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10px] uppercase">
                  <span className={s.priority === 1 ? "text-signal" : "text-muted-foreground"}>{PRIO[s.priority]}</span>
                  <span className={overdue ? "text-signal" : "text-muted-foreground"}>· {ageDays(s)} d{overdue ? " · vencida" : ""}</span>
                </div>
                <div className="min-w-0 break-words"><p className="font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.body}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 [&_select]:w-full"><p className="eyebrow mb-1">Responsable</p>{ownerCell(s)}</div>
                  <div className="min-w-0"><p className="eyebrow mb-1">Estado</p>{statusText(s)}</div>
                </div>
                {rowActions(s)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left"><tr>{["Prioridad", "Sugerencia", "Responsable", "Estado", "Antigüedad", ""].map((h) => <th key={h} className="eyebrow px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No hay sugerencias con estos filtros.</td></tr>}
            {rows.map((s) => {
              const overdue = isOverdue(s);
              return (
                <tr key={s.id} className="border-b align-top last:border-0">
                  <td className={`px-3 py-2 font-mono text-[10px] uppercase ${s.priority === 1 ? "text-signal" : "text-muted-foreground"}`}>{PRIO[s.priority]}</td>
                  <td className="max-w-md px-3 py-2"><p className="font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.body}</p></td>
                  <td className="px-3 py-2">{ownerCell(s)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{statusText(s)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${overdue ? "text-signal" : "text-muted-foreground"}`}>{ageDays(s)} d{overdue ? " · vencida" : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2">{rowActions(s)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
