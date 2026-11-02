// Moving a deal to «Ganado» needs an approval (SDD-20261031-deal-won-duplicate-approvals): one pending request per deal,
// no other move while it is pending, and a clear message in every case. Pure rules plus one thin writer.

export type ApprovalRow = { id?: string; kind: string; status: string; evidence: string | null };

const DEAL_ID = /"deal_id"\s*:\s*"([0-9a-f-]{36})"/i;

/** The deal an approval is about: it lives in the evidence text as JSON; anything else yields null. */
export function approvalDealId(evidence: string | null | undefined): string | null {
  return evidence?.match(DEAL_ID)?.[1]?.toLowerCase() ?? null;
}

/** Pending «change stage» requests for one deal. */
export function pendingStageChanges(rows: ApprovalRow[], dealId: string): ApprovalRow[] {
  const id = dealId.toLowerCase();
  return rows.filter((r) => r.kind === "stage_change" && r.status === "pending" && approvalDealId(r.evidence) === id);
}

/** Ids of every deal that is waiting for approval (for the «Pendiente de aprobación» mark). */
export function pendingWonDealIds(rows: ApprovalRow[]): Set<string> {
  const out = new Set<string>();
  for (const r of rows) if (r.kind === "stage_change" && r.status === "pending") { const id = approvalDealId(r.evidence); if (id) out.add(id); }
  return out;
}

export const WON_COPY = {
  sent: "Enviado a Aprobaciones: mover a Ganado requiere aprobación.",
  alreadyPending: "Ya está pendiente de aprobación. Míralo en Aprobaciones.",
  alreadyWon: "Este deal ya está Ganado.",
  blockedByPending: "Tiene una solicitud pendiente para pasar a Ganado. Resuélvela en Aprobaciones.",
  mark: "Pendiente de aprobación",
} as const;

/** The error PostgREST returns when the unique index of migration 0074 rejects a second pending request. */
export const isUniqueViolation = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "23505" || /duplicate key/i.test(e.message ?? ""));

/** What to do when somebody asks for a deal to become «Ganado». */
export function wonRequestOutcome(a: { dealStage: string | null | undefined; pending: number }): "create" | "already-pending" | "already-won" {
  if (a.dealStage === "won") return "already-won";
  return a.pending > 0 ? "already-pending" : "create";
}

/** Any other stage change while a «Ganado» request is pending is refused (CA-6). */
export const blockedByPendingWon = (pending: number, targetStage: string) => pending > 0 && targetStage !== "won";

type Reader = {
  from(table: "approvals"): {
    select(cols: string): { eq(c: string, v: string): { eq(c: string, v: string): PromiseLike<{ data: ApprovalRow[] | null; error: { message: string } | null }> } };
  };
};
type Writer = {
  from(table: "approvals"): { insert(row: Record<string, unknown>): PromiseLike<{ error: { code?: string; message: string } | null }> };
};

/** Pending stage-change requests of the active company (row security keeps it to that company). */
export async function fetchPendingStageChanges(db: Reader): Promise<ApprovalRow[]> {
  const { data, error } = await db.from("approvals").select("id,kind,status,evidence").eq("kind", "stage_change").eq("status", "pending");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type WonResult = { result: "created" | "already-pending" | "already-won" } | { result: "error"; error: { code?: string; message: string } };

/** Creates the «Ganado» request unless the deal already has one or already is Ganado; a lost race counts as already pending. */
export async function requestWonApproval(
  db: Writer,
  a: { dealId: string; dealName: string; dealStage: string | null | undefined; wonKey: string; pending: ApprovalRow[]; orgId?: string },
): Promise<WonResult> {
  const outcome = wonRequestOutcome({ dealStage: a.dealStage, pending: pendingStageChanges(a.pending, a.dealId).length });
  if (outcome !== "create") return { result: outcome };
  const { error } = await db.from("approvals").insert({
    ...(a.orgId ? { org_id: a.orgId } : {}),
    kind: "stage_change",
    title: `Marcar como Ganado: ${a.dealName}`,
    evidence: JSON.stringify({ deal_id: a.dealId, stage: a.wonKey }),
  });
  if (!error) return { result: "created" };
  return isUniqueViolation(error) ? { result: "already-pending" } : { result: "error", error };
}
