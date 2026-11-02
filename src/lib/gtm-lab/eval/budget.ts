// Spend cap and ledger of the GTM Lab eval passes (SDD-20261101-gtm-lab-1-core CA-14). Eval-only (node:fs), never
// imported by the app. The cap rules are those of gtm-lab@44f385b scripts/eval-suggest.mjs: checked AFTER each call,
// the call in progress may go past it, and the judge is skipped once the generation is past it. On top of that each
// approved pass keeps its own ledger, so repeating a run after an error never adds up past what Fede approved.
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type EvalPass = "pilot" | "reference" | "full";
export const EVAL_PASSES: readonly EvalPass[] = ["pilot", "reference", "full"];

/** USD approved by Fede on 2026-11-02 (SDD §15). Changing them is a code change with his OK, never an env var. */
export const APPROVED_USD: Readonly<Record<EvalPass, number>> = Object.freeze({
  pilot: 1,
  reference: 1.5,
  full: 2,
});

export interface ManualCost {
  costUsd: number;
  /** Where the figure was read: the OpenRouter or the Anthropic panel. */
  source: string;
  approvedBy: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface RunEntry {
  startedAt: string;
  endedAt: string | null;
  spentUsd: number;
  calls: number;
}

export interface SpendLedger {
  pass: EvalPass;
  approvedUsd: number;
  spentUsd: number;
  /** Set by a call without a measured cost: the pass is blocked until a manual cost is recorded. */
  noData: { reason: string; at: string } | null;
  runs: RunEntry[];
  manual: ManualCost[];
}

export const ledgerPath = (dir: string, pass: EvalPass) => join(dir, `spend-${pass}.json`);
export const lockPath = (dir: string, pass: EvalPass) => join(dir, `spend-${pass}.lock`);

export function loadLedger(dir: string, pass: EvalPass): SpendLedger {
  const path = ledgerPath(dir, pass);
  const empty: SpendLedger = {
    pass,
    approvedUsd: APPROVED_USD[pass],
    spentUsd: 0,
    noData: null,
    runs: [],
    manual: [],
  };
  if (!existsSync(path)) return empty;
  const saved = JSON.parse(readFileSync(path, "utf8")) as Partial<SpendLedger>;
  // The approved amount always comes from the code, never from the file.
  return { ...empty, ...saved, pass, approvedUsd: APPROVED_USD[pass] };
}

function saveLedger(dir: string, ledger: SpendLedger) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(ledgerPath(dir, ledger.pass), JSON.stringify(ledger, null, 2));
}

const remaining = (ledger: SpendLedger) => ledger.approvedUsd - ledger.spentUsd;

type Lock = { ok: true; release: () => void } | { ok: false; message: string };

function takeLock(dir: string, pass: EvalPass, pid: number, now: Date): Lock {
  mkdirSync(dir, { recursive: true });
  const path = lockPath(dir, pass);
  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch {
    let holder = "desconocido";
    try {
      const { pid: p, at } = JSON.parse(readFileSync(path, "utf8")) as {
        pid?: number;
        at?: string;
      };
      holder = `pid ${p ?? "?"}, desde ${at ?? "?"}`;
    } catch {
      /* unreadable lock: still a lock */
    }
    return {
      ok: false,
      message: `Ya hay una ejecución de la pasada «${pass}» (${holder}). Si esa ejecución ya no corre, borra a mano ${path} y vuelve a lanzar.`,
    };
  }
  writeFileSync(fd, JSON.stringify({ pid, at: now.toISOString() }));
  closeSync(fd);
  return { ok: true, release: () => existsSync(path) && unlinkSync(path) };
}

export interface Run {
  /** What is left of the approved amount when the run started. */
  capUsd: number;
  /** Adds a measured cost (USD) to the ledger and writes it; null means «sin dato» and blocks the pass. */
  record(costUsd: number | null, label: string): "ok" | "no-data";
  /** True once this run spent more than its cap, or after a call without a cost. */
  overCap(): boolean;
  /** The judge runs only while the run is within its cap. */
  canJudge(): boolean;
  spentUsd(): number;
  close(): void;
}

export interface RunClock {
  now: () => Date;
  pid: number;
}

export function openRun(
  dir: string,
  pass: EvalPass,
  { now, pid }: RunClock,
): { ok: true; run: Run } | { ok: false; message: string } {
  const lock = takeLock(dir, pass, pid, now());
  if (!lock.ok) return lock;
  const ledger = loadLedger(dir, pass);
  if (ledger.noData) {
    lock.release();
    return {
      ok: false,
      message: `La pasada «${pass}» está en «sin dato» (${ledger.noData.reason}). Anota el coste real con GTM_LAB_EVAL_MODE=record-cost antes de seguir.`,
    };
  }
  const capUsd = remaining(ledger);
  if (capUsd <= 0) {
    lock.release();
    return {
      ok: false,
      message: `La pasada «${pass}» no queda saldo: gastado $${ledger.spentUsd.toFixed(4)} de $${ledger.approvedUsd} aprobados.`,
    };
  }

  const entry: RunEntry = { startedAt: now().toISOString(), endedAt: null, spentUsd: 0, calls: 0 };
  ledger.runs.push(entry);
  saveLedger(dir, ledger);
  let blocked = false;
  let closed = false;

  const run: Run = {
    capUsd,
    record(costUsd, label) {
      entry.calls += 1;
      if (costUsd === null) {
        blocked = true;
        ledger.noData = { reason: `${label}: coste nulo`, at: now().toISOString() };
        saveLedger(dir, ledger);
        return "no-data";
      }
      entry.spentUsd += costUsd;
      ledger.spentUsd += costUsd;
      saveLedger(dir, ledger);
      return "ok";
    },
    overCap: () => blocked || entry.spentUsd > capUsd,
    canJudge: () => !run.overCap(),
    spentUsd: () => entry.spentUsd,
    close() {
      if (closed) return;
      closed = true;
      entry.endedAt = now().toISOString();
      saveLedger(dir, ledger);
      lock.release();
    },
  };
  return { ok: true, run };
}

/** Opens a run, gives it to `fn` and always releases the lock in finally. Refuses to start with an Error. */
export async function withRun<T>(
  dir: string,
  pass: EvalPass,
  clock: RunClock,
  fn: (run: Run) => Promise<T>,
): Promise<T> {
  const opened = openRun(dir, pass, clock);
  if (!opened.ok) throw new Error(opened.message);
  try {
    return await fn(opened.run);
  } finally {
    opened.run.close();
  }
}

/** The only way out of «sin dato»: a cost read by hand, with its source, who approved it and the date. */
export function recordManualCost(
  dir: string,
  pass: EvalPass,
  entry: ManualCost,
  clock: RunClock = { now: () => new Date(), pid: 0 },
): { ok: true; ledger: SpendLedger } | { ok: false; message: string } {
  const valid =
    typeof entry.costUsd === "number" &&
    Number.isFinite(entry.costUsd) &&
    entry.costUsd >= 0 &&
    entry.source.trim() !== "" &&
    entry.approvedBy.trim() !== "" &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date);
  if (!valid)
    return {
      ok: false,
      message:
        "Coste manual incompleto: hace falta un importe ≥ 0, la fuente, quién lo aprueba y la fecha (AAAA-MM-DD).",
    };
  const lock = takeLock(dir, pass, clock.pid, clock.now());
  if (!lock.ok) return lock;
  try {
    const ledger = loadLedger(dir, pass);
    ledger.manual.push({
      costUsd: entry.costUsd,
      source: entry.source,
      approvedBy: entry.approvedBy,
      date: entry.date,
    });
    ledger.spentUsd += entry.costUsd;
    ledger.noData = null;
    saveLedger(dir, ledger);
    return { ok: true, ledger };
  } finally {
    lock.release();
  }
}
