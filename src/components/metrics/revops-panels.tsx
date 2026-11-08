import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import {
  cohorts,
  lostAnalysis,
  reconciledFunnel,
  weeklyTrend,
  type RDeal,
  type RHistory,
} from "@/lib/revops";
import { pct } from "@/lib/money";

const SOURCE: Record<string, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  partner: "Partner",
  plg: "Producto (PLG)",
  event: "Evento",
  referral: "Referido",
  "—": "Sin origen",
};

function useSegmentNames() {
  const { data } = useQuery({
    queryKey: ["segment-names"],
    queryFn: async () => (await supabase.from("segments").select("id,name")).data ?? [],
  });
  return (id: string) =>
    id === "—" ? "Sin segmento" : (data?.find((s) => s.id === id)?.name ?? "Segmento");
}

function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <h3 className="text-xl">{title}</h3>
      {sub && <p className="mt-1 text-sm text-ink-mid">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

/** Deals created in `quarter` (filtered by the caller, src/lib/metrics-quarter.ts); `quarter` only names the empty state. */
export function RevopsFunnel({
  deals,
  history,
  path,
  label,
  quarter,
}: {
  deals: RDeal[];
  history: RHistory[];
  path: string[];
  label: (k: string) => string;
  quarter: string;
}) {
  const { money } = useCurrency();
  const f = useMemo(() => reconciledFunnel(deals, history, path), [deals, history, path]);
  const top = f[0]?.entered ?? 0;
  const stale = f.reduce((s, x) => s + x.stale, 0);
  if (!top)
    return (
      <Card title="Embudo conciliado">
        <Empty>Sin deals creados en {quarter}</Empty>
      </Card>
    );
  return (
    <Card
      title="Embudo conciliado"
      sub={`En cada etapa, los deals que entran avanzan, se pierden o siguen abiertos; nada se escapa.${stale ? ` ${stale} llevan más de 30 días sin moverse.` : ""}`}
    >
      <div className="space-y-3">
        {f.map((s) => (
          <div key={s.stage}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{label(s.stage)}</span>
              <span className="text-ink-mid">
                {s.entered} entran · {money(s.enteredAmount)}
                {s.advanceRate != null ? ` · avanza el ${pct(s.advanceRate)}` : ""}
              </span>
            </div>
            <div
              className="flex h-7 overflow-hidden rounded-md bg-paper-sunk"
              style={{ width: `${Math.max(8, (s.entered / top) * 100)}%` }}
              title={`${s.advanced} avanzan · ${s.pending} abiertos · ${s.dropped} perdidos`}
            >
              <div className="bg-lime" style={{ width: `${(s.advanced / s.entered) * 100}%` }} />
              <div
                className="bg-state-watch/50"
                style={{ width: `${(s.pending / s.entered) * 100}%` }}
              />
              <div
                className="bg-state-alarm/60"
                style={{ width: `${(s.dropped / s.entered) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-ink-mid">
              {s.advanced} avanzan · {s.pending} abiertos{s.stale ? ` (${s.stale} estancados)` : ""}{" "}
              · {s.dropped} perdidos
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Deals lost in `quarter` (filtered by the caller); `quarter` only names the empty state. */
export function RevopsLost({
  deals,
  history,
  path,
  label,
  quarter,
}: {
  deals: RDeal[];
  history: RHistory[];
  path: string[];
  label: (k: string) => string;
  quarter: string;
}) {
  const { money } = useCurrency();
  const seg = useSegmentNames();
  const l = useMemo(() => lostAnalysis(deals, history, path), [deals, history, path]);
  if (!l.total)
    return (
      <Card title="Deals perdidos">
        <Empty>Ningún deal perdido en {quarter}</Empty>
      </Card>
    );
  const List = ({
    rows,
    name,
  }: {
    rows: { key: string; count: number; amount: number }[];
    name: (k: string) => string;
  }) => (
    <ul className="space-y-2 text-sm">
      {rows.slice(0, 6).map((r) => (
        <li key={r.key}>
          <div className="flex justify-between gap-2">
            <span className="min-w-0 truncate">{name(r.key)}</span>
            <span className="shrink-0 text-ink-mid">
              {r.count} · {money(r.amount)}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-paper-sunk">
            <div
              className="h-full rounded-full bg-state-alarm/70"
              style={{ width: `${(r.count / l.total) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="space-y-5">
      <p className="text-lg">
        {l.total} {l.total === 1 ? "deal perdido" : "deals perdidos"} por {money(l.amount)}. Donde
        más se pierden: <strong>{label(l.byStage[0].key)}</strong>.
      </p>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Etapa en la que se pierden">
          <List rows={l.byStage} name={label} />
        </Card>
        <Card title="Por segmento">
          <List rows={l.bySegment} name={seg} />
        </Card>
        <Card title="Por origen">
          <List rows={l.bySource} name={(k) => SOURCE[k] ?? k} />
        </Card>
      </div>
    </div>
  );
}

// Cohortes and Tendencias do not follow the quarter selector, and say so (SDD-20261106-metrics-honest-data CA-2).
const COHORTS_WINDOW = "Todo el histórico · no depende del trimestre";
const TRENDS_WINDOW = "Últimas 12 semanas · no depende del trimestre";

export function RevopsCohorts({ deals }: { deals: RDeal[] }) {
  const { money } = useCurrency();
  const seg = useSegmentNames();
  const bySource = useMemo(() => cohorts(deals, (d) => d.source ?? "—"), [deals]);
  const bySeg = useMemo(() => cohorts(deals, (d) => d.segment_id ?? "—"), [deals]);
  const Table = ({
    rows,
    name,
  }: {
    rows: ReturnType<typeof cohorts>;
    name: (k: string) => string;
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            {["", "Deals", "Abiertos", "Ganados", "Win rate", "Valor ganado", "Días a ganar"].map(
              (h) => (
                <th key={h} className="eyebrow pb-2 pr-3">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.key} className="border-t">
              <td className="py-2 pr-3">{name(c.key)}</td>
              <td className="pr-3">{c.created}</td>
              <td className="pr-3">{c.open}</td>
              <td className="pr-3">
                {c.won}/{c.won + c.lost}
              </td>
              <td className="pr-3">{c.winRate == null ? "—" : pct(c.winRate)}</td>
              <td className="pr-3">{money(c.wonAmount)}</td>
              <td>{c.medianDaysToWin ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const windowNote = <p className="text-sm text-ink-mid">{COHORTS_WINDOW}</p>;
  if (!deals.length)
    return (
      <div className="space-y-5">
        {windowNote}
        <Card title="Cohortes">
          <Empty>Aún no hay deals.</Empty>
        </Card>
      </div>
    );
  return (
    <div className="space-y-5">
      {windowNote}
      <Card title="Por origen">
        <Table rows={bySource} name={(k) => SOURCE[k] ?? k} />
      </Card>
      <Card title="Por segmento">
        <Table rows={bySeg} name={seg} />
      </Card>
    </div>
  );
}

export function RevopsTrends({ deals }: { deals: RDeal[] }) {
  const w = useMemo(
    () => weeklyTrend(deals, 12).map((x) => ({ ...x, label: x.start.slice(5) })),
    [deals],
  );
  return (
    <Card title={TRENDS_WINDOW} sub="Deals creados, ganados y perdidos por semana.">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={w}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-ink-mid)" }} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "var(--color-ink-mid)" }}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="created"
              name="Creados"
              fill="var(--color-ink-faint)"
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="won" name="Ganados" fill="var(--color-series-3)" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="lost"
              name="Perdidos"
              fill="var(--color-state-alarm)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
