// Resumen KPI row and win rate panels of /metrics, plus the small building blocks the route reuses
// (Kpi, Panel, Bar, Muted). Extracted from metrics.tsx by SDD-20261106-metrics-honest-data U-2 without
// changing their markup; the win rates are those of the selected quarter (src/lib/metrics-quarter.ts).
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { QuarterCoverage } from "@/lib/coverage";
import { formatRatio } from "@/lib/coverage";
import { pct } from "@/lib/money";
import type { WinGroup } from "@/lib/metrics-quarter";
import { DataMark } from "@/components/metrics/data-mark";

const SOURCE_LABEL: Record<string, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  partner: "Partner",
  plg: "Producto (PLG)",
  event: "Evento",
  referral: "Referido",
  "—": "Sin origen",
};

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
        label="Cobertura de pipeline"
        v={quota ? formatRatio(cov.ratio) : "—"}
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
        tone={cov.status === "low" && quota ? "bad" : undefined}
      />
      <Kpi
        label="Pipeline que cierra este trimestre"
        v={money(openPipe)}
        hint={`Cuota total ${money(quota)}`}
      />
      <Kpi
        label="Forecast comprometido vs real"
        v={`${money(actual)} / ${money(commit)}`}
        hint={
          commit
            ? `${acc.diff >= 0 ? "+" : ""}${pct(acc.diff)} · ${acc.accurate ? "dentro del 10%" : "fuera del 10%"}`
            : "Marca deals como Commit"
        }
        tone={commit && !acc.accurate ? "bad" : undefined}
      />
      <Kpi
        label="Win rate global"
        v={overall.rate == null ? "—" : pct(overall.rate)}
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
            label={SOURCE_LABEL[r.k] ?? r.k}
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

export function Kpi({
  label,
  v,
  hint,
  tone,
}: {
  label: string;
  v: string;
  hint: ReactNode;
  tone?: "bad";
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 break-words font-display text-3xl">{v}</p>
      <p className={`mt-1 text-xs ${tone === "bad" ? "text-signal" : "text-muted-foreground"}`}>
        {hint}
      </p>
    </div>
  );
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-3 text-2xl">{title}</h3>
      {children}
    </div>
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
