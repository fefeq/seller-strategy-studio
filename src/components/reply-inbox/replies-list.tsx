// NK-0174 SDD 4: read-only list of the caller's detected replies (metadata only; RLS limits to own rows).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FILTER_LABEL, KIND_LABEL, repliesHeadline, viewReplies, type InboxFilter, type InboxRow } from "@/lib/reply-inbox/inbox-view";

type Row = InboxRow & { lead: { contact_name: string | null; email: string | null } | null };

export function useReplies() {
  return useQuery({
    queryKey: ["inbox-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbox_replies")
        .select("id,received_at,kind,lead_id")
        .order("received_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.lead_id).filter((x): x is string => !!x))];
      const { data: leads } = ids.length
        ? await supabase.from("leads").select("id,contact_name,email").in("id", ids)
        : { data: [] };
      const by = new Map((leads ?? []).map((l) => [l.id, l]));
      return (data ?? []).map((r) => ({ ...r, kind: r.kind as InboxRow["kind"], lead: r.lead_id ? by.get(r.lead_id) ?? null : null })) as Row[];
    },
  });
}

export function headlineFor(rows: Row[] | undefined) {
  return repliesHeadline(rows ?? []);
}

export function RepliesList({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const list = viewReplies(rows, filter);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar respuestas">
        {(Object.keys(FILTER_LABEL) as InboxFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-ink-mid">
          {rows.length === 0
            ? "Aún no hay respuestas detectadas. Cada hora NOKKO revisa tu Gmail conectado buscando respuestas de leads en Contactado."
            : "No hay respuestas con este filtro."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((r) => {
            const name = r.lead?.contact_name || r.lead?.email || "Lead eliminado";
            return (
              <li key={r.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="text-xs text-ink-mid">
                    {KIND_LABEL[r.kind]} · {new Date(r.received_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {r.lead_id && (
                  <Link to="/leads" className="text-sm underline underline-offset-2">
                    Ver en Leads
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-ink-mid">Solo ves las respuestas de tu propio buzón. NOKKO guarda remitente y fecha, nunca el texto del correo.</p>
    </div>
  );
}
