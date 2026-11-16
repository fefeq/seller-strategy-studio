import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { customActivityQuery } from "./custom-play-queries";
import { summarizePlayCosts } from "@/lib/plays/custom/activity";
import { errorText } from "@/lib/errors";

const date = (v: string) => new Date(v).toLocaleString("es-ES");
const RUN_STATUS: Record<string, string> = {
  running: "En curso",
  done: "Terminada",
  paused: "Pausada",
  blocked: "Bloqueada",
  skipped: "Omitida",
  failed: "Fallida",
};
export function CustomPlayActivity({ playId, playKey }: { playId: string; playKey: string }) {
  const q = useQuery(customActivityQuery(playId, playKey));
  if (q.isPending) return <p className="mt-4 text-sm text-muted-foreground">Cargando actividad…</p>;
  if (q.error)
    return (
      <div role="alert" className="mt-4 text-sm">
        <p>{errorText(q.error)}</p>
        <Button variant="outline" size="sm" onClick={() => q.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  const costs = summarizePlayCosts(q.data.costs);
  return (
    <div className="mt-4 space-y-5 border-t pt-4 text-sm">
      <section>
        <h4 className="font-medium">Ejecuciones</h4>
        {!q.data.runs.length && (
          <p className="text-muted-foreground">Sin ejecuciones registradas.</p>
        )}
        <ul>
          {q.data.runs.map((r) => (
            <li key={r.id}>
              {RUN_STATUS[r.status] ?? "Estado pendiente de revisión"} · {date(r.created_at)}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="font-medium">Pruebas guardadas · {q.data.evidence.length}</h4>
        {!q.data.evidence.length && <p className="text-muted-foreground">Sin pruebas guardadas.</p>}
        <ul className="divide-y">
          {q.data.evidence.map((e) => (
            <li key={e.id} className="py-3">
              <blockquote className="break-words">«{e.quote}»</blockquote>
              <p className="text-muted-foreground">
                Paso {e.step_number ?? "sin dato"} · {e.provider ?? "Fuente sin dato"} · Evento:{" "}
                {e.event_date ?? "fecha desconocida"}
              </p>
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-signal underline"
              >
                {e.url}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="font-medium">Sugerencias · {q.data.suggestions.length}</h4>
        {!q.data.suggestions.length && (
          <p className="text-muted-foreground">Sin sugerencias generadas.</p>
        )}
        <ul className="divide-y">
          {q.data.suggestions.map((s) => (
            <li key={s.id} className="py-3">
              <p className="font-medium">{s.title}</p>
              <p className="whitespace-pre-wrap break-words text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ul>
        {!!q.data.suggestions.length && (
          <Link to="/inbox" className="text-signal underline">
            Revisar en Sugerencias
          </Link>
        )}
      </section>
      <section>
        <h4 className="font-medium">Gasto registrado</h4>
        {!q.data.costs.length && <p className="text-muted-foreground">Sin gasto registrado.</p>}
        {costs.totals.map((c) => (
          <p key={`${c.kind}:${c.currency}`}>
            {c.kind === "ai_measured" ? "IA · medido" : "Proveedor · estimado"}:{" "}
            {new Intl.NumberFormat("es-ES", {
              style: "currency",
              currency: c.currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            }).format(c.amount)}
          </p>
        ))}
        {!!costs.unknown && (
          <p className="text-muted-foreground">
            {costs.unknown} registro(s) sin coste informado; no se suman como cero medido.
          </p>
        )}
        {!q.data.costs.some((c) => c.cost_kind === "ai_measured") && (
          <p className="text-muted-foreground">IA: sin coste medido informado.</p>
        )}
      </section>
    </div>
  );
}
