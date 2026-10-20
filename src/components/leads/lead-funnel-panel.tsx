import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { useLeads } from "@/hooks/use-leads";
import { funnelBy, leadCohort, leadFunnel, leadDelay } from "@/lib/lead-funnel";
import { quarterRange } from "@/lib/metrics";

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const dd = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)} d`);

/** Full funnel Lead → Contactado → MQL → SQL → Oportunidad → Ganado for the leads that entered in the quarter. */
export function LeadFunnelPanel({ quarter }: { quarter: string }) {
  const { data: me } = useMe();
  const { data } = useLeads(me?.currentOrg?.org_id);
  const [by, setBy] = useState<"segment" | "source">("segment");

  const view = useMemo(() => {
    if (!data) return null;
    const { start, end } = quarterRange(quarter);
    const cohort = leadCohort(data.leads, start, end);
    const segName = (id: string | null | undefined) => (id ? data.segments.find((s) => s.id === id)?.name ?? "Segmento eliminado" : "Sin segmento");
    const late = data.leads.filter((l) => leadDelay(l, data.sla).late).length;
    return {
      funnel: leadFunnel(cohort, data.deals),
      groups: funnelBy(cohort, data.deals, (l) => (by === "segment" ? segName(l.segment_id) : l.source || "Sin origen")),
      late,
    };
  }, [data, quarter, by]);

  if (!view) return null;
  const f = view.funnel;
  const max = Math.max(1, f.total);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Leads → ventas</p>
          <h2 className="text-3xl">Embudo de leads {quarter}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cohorte de leads que entraron en el trimestre: hasta dónde llegan y cuánto tardan. Ganado viene de su oportunidad en Pipeline.</p>
        </div>
        <Link to="/leads" className="text-sm underline-offset-2 hover:underline">Abrir Leads{view.late ? ` · ${view.late} con retraso` : ""} →</Link>
      </div>

      {f.total === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No entró ningún lead en {quarter}. <Link to="/leads/entrada" className="underline">Conecta tus formularios o tu CRM</Link>.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="rounded-lg border bg-card p-5">
            {f.steps.map((s) => (
              <div key={s.id} className="py-1.5">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{s.count} · {pct(s.fromStart)} del total{s.fromPrev != null ? ` · ${pct(s.fromPrev)} del paso anterior` : ""}</span>
                </div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(s.count / max) * 100}%` }} /></div>
              </div>
            ))}
            <p className="mt-3 text-xs text-muted-foreground">{f.disqualified} descartados en esta cohorte.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([["Hasta MQL", f.medianDays.mql], ["Hasta SQL", f.medianDays.sql], ["Hasta oportunidad", f.medianDays.opportunity], ["Hasta ganado", f.medianDays.won]] as const).map(([label, v]) => (
              <div key={label} className="rounded-lg border bg-card p-4"><p className="eyebrow">{label}</p><p className="mt-1 font-display text-3xl">{dd(v)}</p><p className="text-xs text-muted-foreground">mediana desde que entra</p></div>
            ))}
          </div>
        </div>
      )}

      {f.total > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b p-3 text-sm">
            <span className="eyebrow mr-2">Comparar por</span>
            {(["segment", "source"] as const).map((k) => (
              <button key={k} onClick={() => setBy(k)} className={`rounded px-2 py-1 ${by === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{k === "segment" ? "Segmento" : "Origen"}</button>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left"><tr>{[by === "segment" ? "Segmento" : "Origen", "Leads", "Contactado", "MQL", "SQL", "Oportunidad", "Ganado", "Lead → Oport.", "Lead → Ganado"].map((h) => <th key={h} className="eyebrow px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {view.groups.map((g) => (
                <tr key={g.key} className="border-b last:border-0">
                  <td className="px-3 py-2">{g.key}</td>
                  <td className="px-3 py-2 font-mono">{g.total}</td>
                  <td className="px-3 py-2 font-mono">{g.counts.contacted}</td>
                  <td className="px-3 py-2 font-mono">{g.counts.mql}</td>
                  <td className="px-3 py-2 font-mono">{g.counts.sql}</td>
                  <td className="px-3 py-2 font-mono">{g.counts.opportunity}</td>
                  <td className="px-3 py-2 font-mono">{g.counts.won}</td>
                  <td className="px-3 py-2 font-mono">{pct(g.toOpportunity)}</td>
                  <td className="px-3 py-2 font-mono">{pct(g.toWon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
