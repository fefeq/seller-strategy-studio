import { Link } from "@tanstack/react-router";
import { usePaybackQuarters } from "@/components/payback-quarters";
import { paybackHeadline, paybackSummary } from "@/lib/segment-coverage";
import { fmtMonths } from "@/lib/unit-economics";
import { DataMark } from "@/components/metrics/data-mark";
import { figureMark, figureTone } from "@/components/metrics/mark-text";

/** Dashboard card: real payback per segment over the last 4 quarters vs each segment's target. */
export function PaybackCard() {
  const { quarters, rows } = usePaybackQuarters(4);
  const summary = paybackSummary(rows, quarters);
  const headline = paybackHeadline(summary, rows.length);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-2xl">Payback real por trimestre</h3>
        <Link
          to="/strategy"
          search={{ tab: "payback" }}
          className="shrink-0 py-2 text-xs text-signal md:py-0"
        >
          Ver detalle →
        </Link>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {headline.kind === "within" ? (
          <>
            <strong
              className={headline.within === headline.measured ? "text-success" : "text-signal"}
            >
              {headline.within} de {headline.measured}
            </strong>{" "}
            segmentos dentro del objetivo en su último trimestre con datos.
          </>
        ) : headline.kind === "no_target" ? (
          <>
            Hay payback real en {headline.withPayback}{" "}
            {headline.withPayback === 1 ? "segmento" : "segmentos"}, pero ninguno tiene objetivo de
            payback. Fíjalo en{" "}
            <Link to="/strategy" className="underline">
              Estrategia GTM
            </Link>{" "}
            para ver si está dentro.
          </>
        ) : headline.kind === "none" ? (
          <>
            Aún sin payback real: apunta costes en{" "}
            <Link to="/metrics" className="underline">
              Métricas → CAC real
            </Link>{" "}
            y registra deals ganados.
          </>
        ) : (
          <>
            No hay segmentos todavía. Créalos en{" "}
            <Link to="/strategy" className="underline">
              Estrategia GTM
            </Link>
            .
          </>
        )}
      </p>
      {rows.length > 0 && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-background py-2 pr-3 font-normal">
                    Segmento
                  </th>
                  {quarters.map((q) => (
                    <th key={q} className="px-2 py-2 text-right font-normal">
                      {q.replace("-", " ")}
                    </th>
                  ))}
                  <th className="py-2 pl-3 text-right font-normal">Objetivo</th>
                  <th className="py-2 pl-3 text-right font-normal">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const trend = summary.latest[i]?.trend ?? null;
                  return (
                    <tr key={r.segment.id} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 bg-background py-2.5 pr-3 font-medium">
                        {r.segment.name}
                      </td>
                      {quarters.map((q) => {
                        const c = r.byQuarter[q];
                        const f = c.figures.payback;
                        const tone = figureTone(f, c.ok);
                        return (
                          <td key={q} className="px-2 py-2.5 text-right">
                            {f.value != null ? (
                              <>
                                <span
                                  className={`font-mono ${tone}`}
                                  title={`CAC real · ${c.customers} ganados`}
                                >
                                  {fmtMonths(f.value)} m
                                </span>
                                {f.state === "estimado" && (
                                  <DataMark
                                    {...figureMark(f)!}
                                    className="block text-xs text-muted-foreground"
                                  />
                                )}
                                <span className="block text-xs text-muted-foreground md:hidden">
                                  {c.customers} {c.customers === 1 ? "ganado" : "ganados"}
                                </span>
                              </>
                            ) : (
                              // SDD-20261109 CA-7: «Sin dato · motivo», never a bare dash.
                              <DataMark {...figureMark(f)!} className="text-xs" />
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pl-3 text-right font-mono text-xs">
                        {r.target != null ? (
                          `${r.target} m`
                        ) : (
                          // SDD-20261109 CA-7/CA-13: «Sin dato · motivo», never a bare dash.
                          <DataMark state="sin_dato" reason="sin objetivo de payback" />
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono text-xs">
                        {trend == null ? (
                          <DataMark
                            state="sin_dato"
                            reason="falta un trimestre anterior con payback"
                          />
                        ) : (
                          <span
                            className={trend > 0 ? "text-signal" : trend < 0 ? "text-success" : ""}
                          >
                            {trend > 0 ? "▲ +" : trend < 0 ? "▼ " : ""}
                            {fmtMonths(trend)} m
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Verde = dentro del objetivo · rojo = fuera · «Sin dato» dice qué falta en ese trimestre.
            Tendencia frente al trimestre anterior con datos (bajar es mejor).
          </p>
        </div>
      )}
    </div>
  );
}
