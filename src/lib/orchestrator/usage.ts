// Spend logging for the orchestrator, in its own module so the gateways (apollo-gateway.ts) can
// log without importing the runner (which already imports them). Shared by runner and gateways.
// Ledger (SDD pausa-legal-linkedin-y-gasto, pieza B): every row says which tool, its currency and whether the
// amount is measured, an estimate or unknown («sin dato», cost null — never zero). An operation_id makes a
// retried write idempotent (unique per company), so one attempt is never counted twice.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import type { CostKind } from "@/lib/spend";
import type { Need, Service } from "./planner";

export type Trigger = "manual" | "automatic";
/** cost null = the provider gave no charge («sin dato»). Planner prices are estimates unless kind says otherwise. */
export type Used = {
  service: Service;
  cost: number | null;
  kind?: CostKind;
  currency?: "EUR" | "USD";
  tool?: string;
  volume?: number;
  operationId?: string;
  receiptRef?: string;
};

export async function logUsage(
  c: Pick<ToolCtx, "db" | "orgId" | "userId">,
  need: Need | null,
  used: Used[],
  trigger: Trigger,
) {
  if (!used.length) return;
  const rows = used.map((u) => ({
    org_id: c.orgId,
    user_id: c.userId,
    service: u.service,
    need,
    trigger,
    cost: u.cost,
    cost_kind: u.cost === null ? "unknown" : (u.kind ?? "estimate"),
    currency: u.currency ?? "EUR",
    tool: u.tool ?? null,
    volume: u.volume ?? null,
    operation_id: u.operationId ?? null,
    receipt_ref: u.receiptRef ?? null,
  }));
  const withOp = rows.filter((r) => r.operation_id);
  const plain = rows.filter((r) => !r.operation_id);
  if (plain.length) {
    const { error } = await c.db.from("integration_usage").insert(plain);
    if (error) console.error("integration_usage insert failed", safeErrorLog(error));
  }
  if (withOp.length) {
    // Same operation logged again (retry, wrapper) = no second row.
    const { error } = await c.db
      .from("integration_usage")
      .upsert(withOp, { onConflict: "org_id,operation_id", ignoreDuplicates: true });
    if (error) console.error("integration_usage upsert failed", safeErrorLog(error));
  }
}
