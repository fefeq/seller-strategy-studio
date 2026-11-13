// Spend logging for the orchestrator, in its own module so the gateways (apollo-gateway.ts) can
// log without importing the runner (which already imports them). Shared by runner and gateways.
import type { ToolCtx } from "@/lib/agent/tool-kit";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import type { Need, Service } from "./planner";

export type Trigger = "manual" | "automatic";
export type Used = { service: Service; cost: number };

export async function logUsage(c: ToolCtx, need: Need, used: Used[], trigger: Trigger) {
  if (!used.length) return;
  const { error } = await c.db.from("integration_usage").insert(
    used.map((u) => ({
      org_id: c.orgId,
      user_id: c.userId,
      service: u.service,
      need,
      trigger,
      cost: u.cost,
    })),
  );
  if (error) console.error("integration_usage insert failed", safeErrorLog(error));
}
