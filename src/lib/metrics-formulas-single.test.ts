// SDD-20261109-metrics-strategy-no-estimates · U-0 · CA-2, CA-6, CA-13 (source guards).
// CA-2: outside src/lib/unit-economics.ts no file of src/ computes a CAC or a payback on its own.
// CA-6: the NK-0068 marks that described an assumption turned into a number are gone from the product code.
// CA-13: every «—» left in the surfaces of this SDD is in the closed inventory below as «no aplica» (or belongs to
// another metric, NK-0106); a «—» that meant «falta el dato» for CAC, payback, ACV, margin or win rate is gone.
// The scans skip tests (*.test.ts, *.test.tsx) and src/test/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return p === join(SRC, "test") ? [] : sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}
const FILES = sources(SRC).map((p) => ({ path: relative(ROOT, p), text: readFileSync(p, "utf8") }));
const MODULE = "src/lib/unit-economics.ts";

/** Each pattern is one way the code computed a CAC or a payback by itself (SDD §3.1, §3.2). */
const FORMULAS: [string, RegExp][] = [
  ["payback: ACV × margin / 12", /acv[\w.?!]*\s*\*\s*[\w.?!]*margin[\w.?!]*\s*\)?\s*\/\s*12\b/i],
  ["CAC: cost / customers", /\bcost\s*\/\s*[\w.]*customers\b/i],
  ["CAC: cost / won", /\bcost\s*\/\s*[\w.]*\bwon\b(?!\.length)/i],
  ["CAC: cost / expectedWins", /\bcost\s*\/\s*[\w.]*expectedWins\b/i],
  ["CAC: acquisition / newCustomers", /acquisition\s*\/\s*[\w.]*newCustomers\b/i],
  ["CAC: planAcq / planNew", /planAcq\s*\/\s*planNew\b/],
  // Also the averages of /metrics «CAC real» that divided a cost total by a count of won deals or customers.
  ["CAC: total / won count", /\btotal(\[\w+\])?\s*\/\s*won(\[\w+\])?(?!\.length)\b/],
  ["CAC: cost / customers total", /\b\w*[cC]ost\w*\s*\/\s*\w*[cC]ustomers\b/],
  ["CAC: c / w", /\bmoney\(\s*c\s*\/\s*w\s*\)/],
];

describe("CA-2: one CAC formula and one payback formula, in src/lib/unit-economics.ts", () => {
  it("the module exists and holds them", () => {
    const mod = FILES.find((f) => f.path === MODULE);
    expect(mod, MODULE).toBeDefined();
    expect(mod!.text).toMatch(/export function cacOf\b/);
    expect(mod!.text).toMatch(/export function paybackOf\b/);
  });

  it("no other file of src/ computes a CAC or a payback", () => {
    const hits = FILES.filter((f) => f.path !== MODULE).flatMap((f) =>
      f.text
        .split("\n")
        .flatMap((line, i) =>
          FORMULAS.filter(([, re]) => re.test(line)).map(
            ([name]) => `${f.path}:${i + 1} (${name}): ${line.trim()}`,
          ),
        ),
    );
    expect(hits).toEqual([]);
  });

  it("the scan does catch a CAC or a payback computed in place (guards the patterns)", () => {
    const caught = (line: string) => FORMULAS.some(([, re]) => re.test(line));
    for (const line of [
      "const paybackMonths = acv && p.cac ? p.cac / ((acv * margin) / 12) : null;",
      "cac: customers > 0 && cost > 0 ? cost / customers : null,",
      "const realCac = p.cost && p.won ? p.cost / p.won : null;",
      "p.cost / expectedWins",
      "cac: acquisition && newCustomers ? acquisition / newCustomers : null,",
      "const planCac = planAcq != null && planNew ? planAcq / planNew : null;",
      "{won[q] && t.total[q] ? money(t.total[q] / won[q]) : null}",
      "{totalCustomers && totalCost ? money(totalCost / totalCustomers) : null}",
      "return w && c ? money(c / w) : null;",
    ])
      expect(caught(line), line).toBe(true);
    expect(caught("ticket_medio: won.length ? Math.round(sum(won) / won.length) : 0,")).toBe(false);
  });
});

describe("CA-6: no mark presents an assumption as a number", () => {
  it("no product file says «margen del 100 % supuesto», «mínimo del rango × 1,5» or «repartido a partes iguales»", () => {
    const hits = FILES.flatMap((f) =>
      ["margen del 100 % supuesto", "mínimo del rango × 1,5", "repartido a partes iguales"]
        .filter((t) => f.text.includes(t))
        .map((t) => `${f.path}: «${t}»`),
    );
    expect(hits).toEqual([]);
  });
});

/**
 * CA-13 inventory of «—» (SDD §3.6, classified in U-0). Each entry is a fragment of the only lines that may keep a «—»
 * in that file: `no_aplica` (nothing is missing: a placeholder, a name, a market range) or `otra_metrica` (a target
 * nobody typed, revenue, cost, cycle, coverage, capacity: outside CAC, payback, ACV, margin and win rate; NK-0106).
 * The lines classified `falta_el_dato` are listed apart, for the record: they must not exist any more.
 */
type Allowed = [fragment: string, kind: "no_aplica" | "otra_metrica", maxLines?: number];
const DASH_ALLOWED: Record<string, Allowed[]> = {
  "src/components/strategy/motions.tsx": [
    ['if (!r) return "—"', "no_aplica"], // market reference range without upper bound
    ['const days = (n: number | null | undefined) => (n == null ? "—"', "otra_metrica"], // cycle
    ['n == null ? "—" : n.toLocaleString("es-ES", { maximumFractionDigits: 1 })', "otra_metrica"], // capacity
    ['seg.cycle_days ? `${seg.cycle_days} días` : "—"', "otra_metrica"],
    ['.join(" · ") || "—"', "no_aplica"], // team ratios not set
    ['seg.win_rate_target ? `${seg.win_rate_target}%` : "—"', "otra_metrica"],
    ['seg.ae_quota ? money(Number(seg.ae_quota)) : "—"', "otra_metrica"],
    ['seg.cac_target ? money(Number(seg.cac_target)) : "—"', "otra_metrica"],
    ['seg.payback_months ? `${seg.payback_months} meses` : "—"', "otra_metrica"],
    ['seg.payback_months ? `${seg.payback_months} m` : "—"', "otra_metrica"],
    // Only two bare `: "—",` lines may stay in the real-vs-target table: the target ACV range and the real cycle.
    [': "—",', "otra_metrica", 2],
    ['plan.dealsPerYear != null ? fmt1(Math.ceil(plan.dealsPerYear)) : "—"', "otra_metrica"],
    ['plan.oppsPerYear != null ? fmt1(Math.ceil(plan.oppsPerYear)) : "—"', "otra_metrica"],
    ['const pctTarget = (n: number | null | undefined) => (n == null ? "—"', "otra_metrica"],
  ],
  "src/components/budget-quarters.tsx": [
    ['placeholder="—"', "no_aplica"],
    ['{value == null ? "—" : field === "plan_new_customers"', "otra_metrica"], // typed budget values
    [
      'real: (c) => val(c.r!.actual.acquisition ? money(c.r!.actual.acquisition) : "—")',
      "otra_metrica",
    ],
    ['{yr.payback.target != null ? `${yr.payback.target} m` : "—"}', "otra_metrica"],
  ],
  "src/components/budget-panel.tsx": [
    ['real={r.actual.revenue != null ? money(r.actual.revenue) : "—"}', "otra_metrica"],
    ['plan={r.plan.revenue != null ? money(r.plan.revenue) : "—"}', "otra_metrica"],
    ['real={r.actual.acquisition ? money(r.actual.acquisition) : "—"}', "otra_metrica"],
    ['plan={r.plan.acquisition != null ? money(r.plan.acquisition) : "—"}', "otra_metrica"],
  ],
  "src/components/segment-coverage.tsx": [
    ['{cov ? `${cov.ratio.toFixed(1)}x` : "—"}', "otra_metrica"], // pipeline coverage
    ['{r.target ? money(r.target) : "—"}', "otra_metrica"],
    ['/ obj. {r.cac.target != null ? money(r.cac.target) : "—"}', "otra_metrica"],
    ['/ obj. {r.payback.target != null ? `${r.payback.target} m` : "—"}', "otra_metrica"],
    ['<span className="text-muted-foreground"> / {target ?? "—"}</span>', "otra_metrica"],
  ],
  "src/components/cac-panel.tsx": [
    ['const cell = (n: number) => (n ? money(n) : "—")', "otra_metrica"], // cost per channel
    ['{v && Number(v.amount) ? money(Number(v.amount)) : "—"}', "otra_metrica"], // typed cost
    ['cells={rows.map((r) => (r.cac.target != null ? money(r.cac.target) : "—"))}', "otra_metrica"],
  ],
  "src/components/quarter-kpis-panel.tsx": [
    ['const money0 = (n: number | null) => (n == null ? "—" : money(n))', "otra_metrica"], // revenue, cost, spend
    ['show: (n) => (n == null ? "—" : String(n))', "otra_metrica"], // new customers
  ],
  "src/components/pipeline-board-panel.tsx": [
    ['?.full_name ?? "—"', "no_aplica"], // owner without a name
    ['value={view.cost ? money(view.cost) : "—"}', "otra_metrica"], // acquisition spend
  ],
  "src/components/payback-card.tsx": [
    ['<span className="text-muted-foreground">—</span>', "otra_metrica"], // target not set / no trend yet
  ],
  "src/components/payback-quarters.tsx": [],
};

/** For the record (U-0): lines whose «—» meant «falta el dato»; CA-13 replaces them with «Sin dato · motivo». */
const DASH_MISSING_DATA = [
  "motions.tsx: ACV real (tabla real vs objetivo, tarjetas y tabla de segmentos), win rate real, CAC real, payback real, payback del plan",
  "budget-quarters.tsx: margen (pct), payback (pb), CAC presupuestado y real, payback del año (real y presupuestado)",
  "budget-panel.tsx: margen (pct), CAC real y presupuestado, payback real y presupuestado",
  "segment-coverage.tsx: win rate real, CAC real, payback real",
  "cac-panel.tsx: CAC medio por trimestre, del total y de la cabecera, CAC real, payback real",
  "quarter-kpis-panel.tsx: margen (pct), payback de la tabla y de la cabecera, «plan —»",
  "pipeline-board-panel.tsx: meses de payback, CAC real, CAC proyectado",
  "payback-card.tsx: payback por trimestre y la leyenda «— = sin costes…»",
  "payback-quarters.tsx: celda sin payback",
];

describe("CA-13: «—» only where nothing is missing (closed inventory)", () => {
  it("the inventory covers the nine files of SDD §3.6", () => {
    expect(Object.keys(DASH_ALLOWED)).toHaveLength(DASH_MISSING_DATA.length);
  });
  for (const [path, allowed] of Object.entries(DASH_ALLOWED)) {
    it(`${path}: every «—» line is in the inventory`, () => {
      const text = readFileSync(join(ROOT, path), "utf8");
      const used = new Map<string, number>();
      const stray = text
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => line.includes("—"))
        .filter(({ line }) => {
          // The most specific fragment wins, so a generic one never uses up its budget on a listed line.
          const hit = [...allowed]
            .sort((a, b) => b[0].length - a[0].length)
            .find(([frag]) => line.includes(frag));
          if (!hit) return true;
          used.set(hit[0], (used.get(hit[0]) ?? 0) + 1);
          return hit[2] != null && used.get(hit[0])! > hit[2];
        })
        .map(({ line, n }) => `${path}:${n}: ${line.trim()}`);
      expect(stray).toEqual([]);
    });
  }
});
