// SDD-20261109-metrics-sin-dato-rest · U-1 · CA-1 (source guard), CA-6 (keys by value).
// CA-1: in the files /metrics paints, a line with «—» is only in the closed list below, as «N» (nothing is missing:
// page title, a target nobody typed, an input cell, a name that does not exist) or «K» (a grouping key, not text),
// with a ceiling of lines per fragment. A «—» that meant «falta el dato» is gone («Sin dato · motivo», «sin plan»,
// «sin dato»). The set is computed from the direct imports of metrics.tsx, so a new file with «—» fails here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NO_SOURCE } from "./metrics-quarter";

const ROOT = join(__dirname, "..", "..");
const METRICS = "src/routes/_authenticated/metrics.tsx";
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

type Allowed = [fragment: string, kind: "N" | "K", maxLines?: number];
/** Closed list (ceiling per fragment). Files with `[]` have no «—» left. Only ever shrink it. */
const METRICS_DASH_ALLOWED: Record<string, Allowed[]> = {
  [METRICS]: [
    ['title: "Métricas RevOps — Nokko"', "N"], // page title
    ['content: "Métricas RevOps — Nokko"', "N"], // og:title
    ['eur(Number(q.amount)) : "—"', "N"], // quota nobody typed
  ],
  "src/lib/revops.ts": [
    ['lostFrom ?? "—"', "N"], // lost stage unknown (empty path)
    ['d.segment_id ?? "—"', "K"], // grouping key «Sin segmento»
  ],
  "src/lib/metrics-quarter.ts": [['NO_SOURCE = "—"', "K"]],
  "src/components/metrics/revops-panels.tsx": [
    ['id === "—" ? "Sin segmento"', "K"],
    ['d.segment_id ?? "—"', "K"],
  ],
  "src/components/metrics/finance-panel.tsx": [],
  "src/components/metrics/performance-panels.tsx": [],
  "src/components/self-service-funnel.tsx": [],
  "src/components/leads/lead-funnel-panel.tsx": [],
  "src/components/stripe-panel.tsx": [],
  "src/components/segment-coverage.tsx": [
    ['{r.target ? money(r.target) : "—"}', "N"],
    ['/ obj. {r.cac.target != null ? money(r.cac.target) : "—"}', "N"],
    ['/ obj. {r.payback.target != null ? `${r.payback.target} m` : "—"}', "N"],
    ['/ {target ?? "—"}', "N"],
  ],
  "src/components/cac-panel.tsx": [
    ['const cell = (n: number) => (n ? money(n) : "—")', "N"], // input table
    ['{v && Number(v.amount) ? money(Number(v.amount)) : "—"}', "N"],
    ['cells={rows.map((r) => (r.cac.target != null ? money(r.cac.target) : "—"))}', "N"],
  ],
  "src/components/quarter-kpis-panel.tsx": [],
  "src/components/pipeline-board-panel.tsx": [['?.full_name ?? "—"', "N"]], // owner without a name
  "src/components/budget-panel.tsx": [],
  "src/components/won-deals-panel.tsx": [['?.name ?? "—"', "N"]], // segment that does not exist
};

/** metrics.tsx + its direct imports under src/components + the two src/lib files that group deals. */
function metricsFiles(): string[] {
  const imports = [...read(METRICS).matchAll(/from "@\/components\/([^"]+)"/g)].map(
    (m) => `src/components/${m[1]}`,
  );
  const files = imports.flatMap((base) =>
    [".tsx", ".ts"].flatMap((ext) => {
      try {
        read(base + ext);
        return [base + ext];
      } catch {
        return [];
      }
    }),
  );
  return [METRICS, ...files, "src/lib/revops.ts", "src/lib/metrics-quarter.ts"];
}

describe("CA-1: «—» in /metrics only where nothing is missing (closed list)", () => {
  const files = metricsFiles();

  it("the list covers the 15 files of the set and nothing else", () => {
    expect(Object.keys(METRICS_DASH_ALLOWED).sort()).toEqual(
      files.filter((f) => read(f).includes("—") || f in METRICS_DASH_ALLOWED).sort(),
    );
    expect(Object.keys(METRICS_DASH_ALLOWED)).toHaveLength(15);
  });

  it("a file of the set with «—» that is not in the list fails", () => {
    const unlisted = files.filter((f) => read(f).includes("—") && !(f in METRICS_DASH_ALLOWED));
    expect(unlisted).toEqual([]);
  });

  for (const [path, allowed] of Object.entries(METRICS_DASH_ALLOWED)) {
    it(`${path}: every «—» line is in the list, within its ceiling`, () => {
      const used = new Map<string, number>();
      const stray = read(path)
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
          return used.get(hit[0])! > (hit[2] ?? 1);
        })
        .map(({ line, n }) => `${path}:${n}: ${line.trim()}`);
      expect(stray).toEqual([]);
    });
  }
});

describe("CA-6: grouping keys stay as they are, by value", () => {
  it("NO_SOURCE is «—», the key of a deal without source", () => {
    expect(NO_SOURCE).toBe("—");
  });
});
