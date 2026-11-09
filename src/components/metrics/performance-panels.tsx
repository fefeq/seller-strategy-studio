// Resumen KPI row and win rate panels of /metrics, plus the small building blocks the route reuses
// (Bar, Muted). Extracted from metrics.tsx by SDD-20261106-metrics-honest-data U-2; Kpi and Panel are
// the shared ones in components/page.tsx (NK-0051 legibility). The win rates are those of the selected
// quarter (src/lib/metrics-quarter.ts).
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { QuarterCoverage } from "@/lib/coverage";
import { formatRatio } from "@/lib/coverage";
import { pct } from "@/lib/money";
import { dealSourceLabel } from "@/lib/deal-source";
import type { WinGroup } from "@/lib/metrics-quarter";
import { DataMark } from "@/components/metrics/data-mark";
import { Kpi, Panel } from "@/components/page";

export type OverallWinRate = { won: number; lost: number; closed: number; rate: number | null };

export function ResumenKpis({
  quarter,
  money,
  quota,
  cov,
  openPipe,
  actual,
  commit,
  acc,
  overall,
}: {
  quarter: string;
  money: (n: number) => string;
  quota: number;
  cov: Pick<QuarterCoverage, "ratio" | "status" | "undated">;
  openPipe: number;
  actual: number;
  commit: number;
  acc: { diff: number; accurate: boolean };
  overall: OverallWinRate;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Kpi
        size="normal"
        label="Cobertura de pipeline"
        value={quota ? formatRatio(cov.ratio) : "—"}
        hint={
          quota ? (
            `${cov.status === "healthy" ? "Sana (3–4x)" : cov.status === "low" ? "Baja: objetivo 3–4x" : "Alta: revisa calidad"}${cov.undated.count ? ` · ${cov.undated.count} ${cov.undated.count === 1 ? "deal" : "deals"} sin fecha de cierre (${money(cov.undated.amount)}) no cuentan` : ""}`
          ) : (
            <>
              <Link to="/metrics" search={{ seccion: "rendimiento" }} className="underline">
                Define cuotas
              </Link>{" "}
              en Rendimiento
            </>
          )
        }
        hintTone={cov.status === "low" && quota ? "signal" : undefined}
      />
      <Kpi
        size="normal"
        label="Pipeline que cierra este trimestre"
        value={money(openPipe)}
        hint={`Cuota total ${money(quota)}`}
      />
      <Kpi
        size="normal"
        label="Forecast comprometido vs real"
        value={`${money(actual)} / ${money(commit)}`}
        hint={
          commit
            ? `${acc.diff >= 0 ? "+" : ""}${pct(acc.diff)} · ${acc.accurate ? "dentro del 10%" : "fuera del 10%"}`
            : "Marca deals como Commit"
        }
        hintTone={commit && !acc.accurate ? "signal" : undefined}
      />
      <Kpi
        size="normal"
        label="Win rate global"
        value={overall.rate == null ? "—" : pct(overall.rate)}
        hint={
          overall.rate == null ? (
            <DataMark state="sin_dato" reason={`sin deals cerrados en ${quarter}`} />
          ) : (
            `${overall.closed} cerrados en ${quarter}`
          )
        }
      />
    </div>
  );
}

/** Win rate por origen and por rep: deals closed in the selected quarter. */
export function WinRatePanels({
  quarter,
  bySource,
  byRep,
}: {
  quarter: string;
  bySource: WinGroup[];
  byRep: WinGroup[];
}) {
  return (
    <>
      <Panel title="Win rate por origen">
        {bySource.length === 0 && <Muted>{`Sin deals cerrados en ${quarter}`}</Muted>}
        {bySource.map((r) => (
          <Bar
            key={r.k}
            label={dealSourceLabel(r.k)}
            value={r.rate}
            right={`${pct(r.rate)} · ${r.won}G/${r.lost}P`}
          />
        ))}
      </Panel>
      <Panel title="Win rate por rep">
        {byRep.length === 0 && <Muted>{`Sin deals cerrados en ${quarter}`}</Muted>}
        {byRep.map((r) => (
          <Bar
            key={r.k}
            label={r.k}
            value={r.rate}
            right={`${pct(r.rate)} · ${r.won}G/${r.lost}P`}
          />
        ))}
      </Panel>
    </>
  );
}

export function Bar({ label, value, right }: { label: string; value: number; right: string }) {
  return (
    <div className="py-1.5 text-sm">
      <div className="flex justify-between gap-3">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{right}</span>
      </div>
      <div className="mt-1 h-1.5 rounded bg-muted">
        <div
          className="h-full rounded bg-primary"
          style={{ width: `${Math.min(100, Math.round(value * 100))}%` }}
        />
      </div>
    </div>
  );
}
export function Muted({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}
