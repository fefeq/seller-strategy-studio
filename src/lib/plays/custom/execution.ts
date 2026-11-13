// NK-0171 SDD 4 U-4a: server orchestration contract, no provider or browser dependency.
// Storage adapters must atomically persist each step's writes and receipt; a lease is database-owned.
import { checkProposal, type Proposal } from "./propose";
import { checkSources, type SourceContext, type Step } from "./model";
import type { Trigger } from "@/lib/orchestrator/usage";

export type ExecutionInput = {
  orgId: string;
  playId: string;
  runId: string;
  userId: string;
  trigger: Trigger;
  now: Date;
};
export type StepReceipt = { step: number; evidenceCount: number; suggestionCount: number };
export type PauseReason = "provider_denied" | "credits" | "rate_limit" | "refusal" | "unavailable" | "uncertain";
export type ExecutionPorts = {
  load(input: ExecutionInput): Promise<{
    status: string; member: boolean; archived: boolean; proposal: Proposal; sources: SourceContext;
  } | null>;
  claim(input: ExecutionInput): Promise<boolean>;
  release(input: ExecutionInput): Promise<void>;
  checkpoint(input: ExecutionInput, step: number): Promise<StepReceipt | null>;
  guard(input: ExecutionInput): Promise<{ active: boolean; cancelled: boolean; budgetPaused: boolean }>;
  // Resolves only after the step outputs and its receipt have been committed together.
  runStep(input: ExecutionInput & { step: Step; proposal: Proposal }): Promise<StepReceipt>;
  pause(input: ExecutionInput, reason: PauseReason): Promise<void>;
};
type Status = "done" | "skipped" | "busy" | "blocked" | "paused" | "cancelled";
export type ExecutionResult = {
  status: Status; completedSteps: number; evidenceCount: number; suggestionCount: number;
};

function pauseReason(error: unknown): PauseReason | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { status?: unknown; refusal?: unknown };
  if (e.refusal === true) return "refusal";
  if (e.status === 401 || e.status === 403) return "provider_denied";
  if (e.status === 402) return "credits";
  if (e.status === 429) return "rate_limit";
  if (e.status === 404) return "unavailable";
  return null;
}

/** One already-requested run. It never activates, sends, schedules or fans out work itself. */
export async function executeCustomPlay(ports: ExecutionPorts, input: ExecutionInput): Promise<ExecutionResult> {
  const counts = { completedSteps: 0, evidenceCount: 0, suggestionCount: 0 };
  const result = (status: Status): ExecutionResult => ({ status, ...counts });
  const row = await ports.load(input);
  if (!row || row.status !== "active" || !row.member || row.archived) return result("skipped");
  const p = row.proposal;
  if (!checkProposal(p).ok || new Set(p.steps.map((s) => s.n)).size !== p.steps.length)
    return result("blocked");
  if (!checkSources(p.steps.map((s) => s.source), row.sources).ok) return result("blocked");
  if (!(await ports.claim(input))) return result("busy");
  try {
    // Finite steps from the approved definition, strictly sequential; no recursive next hop.
    for (const step of p.steps) {
      const g = await ports.guard(input);
      if (g.cancelled) return result("cancelled");
      if (!g.active) return result("skipped");
      const previous = await ports.checkpoint(input, step.n);
      if (!previous && input.trigger === "automatic" && g.budgetPaused) return result("blocked");
      const receipt = previous ?? await ports.runStep({ ...input, step, proposal: p });
      if (receipt.step !== step.n || !Number.isInteger(receipt.evidenceCount) || receipt.evidenceCount < 0
          || !Number.isInteger(receipt.suggestionCount) || receipt.suggestionCount < 0)
        throw new Error("No se pudo comprobar el resultado del paso. Revisa la ejecución antes de reintentarlo.");
      counts.completedSteps += 1;
      counts.evidenceCount += receipt.evidenceCount;
      counts.suggestionCount += receipt.suggestionCount;
    }
    return result("done");
  } catch (error) {
    const reason = pauseReason(error);
    if (!reason) throw error;
    await ports.pause(input, reason);
    return result("paused");
  } finally {
    await ports.release(input);
  }
}