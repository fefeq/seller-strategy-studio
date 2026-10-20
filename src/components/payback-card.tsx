import { Link } from "@tanstack/react-router";
import { usePaybackQuarters } from "@/components/payback-quarters";
import { paybackSummary } from "@/lib/segment-coverage";

const fmt1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** Dashboard card: real payback per segment over the last 4 quarters vs each segment's target. */
export function PaybackCard() {
  const { quarters, rows } = usePaybackQuarters(4);
  const summary = paybackSummary(rows, quarters);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-2xl">Payback real por trimestre</h3>
        <Link to="/strategy" search={{ tab: "payback" }} className="shrink-0 py-2 text-xs text-signal md:py-0">Ver detalle →</Link>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {summary.measured > 0
          ? <><strong className={summary.within === summary.measured ? "text-success" : "text-signal"}>{summary.within} de {summary.measured}</strong> segmentos dentro del objetivo en su último trimestre con datos.</>
          : rows.length > 0
            ? <>Aún sin payback real: apunta costes en <Link to="/metrics" className="underline">Métricas → CAC real</Link> y registra deals ganados.</>
            : <>No hay segmentos todavía. Créalos en <Link to="/strategy" className="underline">Estrategia GTM</Link>.</>}
      </p>
      {rows.length > 0 && (
        <div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-background py-2 pr-3 font-normal">Segmento</th>
                {quarters.map((q) => <th key={q} className="px-2 py-2 text-right font-normal">{q.replace("-", " ")}</th>)}
                <th className="py-2 pl-3 text-right font-normal">Objetivo</th>
                <th className="py-2 pl-3 text-right font-normal">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const trend = summary.latest[i]?.trend ?? null;
                return (
                  <tr key={r.segment.id} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-background py-2.5 pr-3 font-medium">{r.segment.name}</td>
                    {quarters.map((q) => {
                      const c = r.byQuarter[q];
                      const tone = c.ok === false ? "text-signal" : c.ok ? "text-success" : "";
                      return (
                        <td key={q} className="px-2 py-2.5 text-right">
                          {c.status === "real" && c.payback != null
                            ? <><span className={`font-mono ${tone}`} title={`CAC real · ${c.customers} ganados`}>{fmt1(c.payback)} m</span><span className="block text-[10px] text-muted-foreground md:hidden">{c.customers} {c.customers === 1 ? "ganado" : "ganados"}</span></>
                            : <span className="font-mono text-xs text-muted-foreground" title={c.status === "no_wins" ? "Hay costes pero ningún deal ganado" : "Sin costes apuntados"}>—</span>}
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right font-mono text-xs">{r.target != null ? `${r.target} m` : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2.5 pl-3 text-right font-mono text-xs">
                      {trend == null ? <span className="text-muted-foreground">—</span>
                        : <span className={trend > 0 ? "text-signal" : trend < 0 ? "text-success" : ""}>{trend > 0 ? "▲ +" : trend < 0 ? "▼ " : ""}{fmt1(trend)} m</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Verde = dentro del objetivo · rojo = fuera · — = sin costes o sin deals ganados en ese trimestre. Tendencia frente al trimestre anterior con datos (bajar es mejor).</p>
        </div>
      )}
    </div>
  );
}
