// Onboarding status: get_onboarding_status (read, any member). Part of the single registry in ../tools.ts.
// It says where the person is in the onboarding, the company's GTM diagnosis and what the strategy still lacks. It never returns the
// proposal, the findings, the sources or the annual ticket: they can hold text from the company's documents (SDD-20261111 CA-8).
import { z } from "zod";
import { def } from "../tool-kit";
import type { AgentTool, ToolCtx } from "../tool-kit";
import { loadSetupData } from "@/lib/org-data";
import { companyOnboardingStatus } from "@/lib/onboarding";

/**
 * The company's GTM diagnosis: the RPC (migration 0065) and, when it answers null or fails, the same rule in code. The privileged client
 * (Telegram, cron) has no auth.uid(), so the RPC returns null there; with the person's client the policy reduces the rows to their own.
 * Your own diagnosis first, otherwise the most recent one a colleague made. Only user_id, diagnosis and updated_at are read, plus org_id for the in-memory company check.
 */
export async function companyDiagnosisFor(c: ToolCtx): Promise<unknown> {
  try {
    const r = await c.db.rpc("company_diagnosis", { _org: c.orgId });
    if (!r.error && r.data != null) return r.data;
  } catch {
    // falls through to the rule in code
  }
  try {
    const r = await c.db
      .from("onboarding_sessions")
      .select("user_id,diagnosis,updated_at,org_id")
      .eq("org_id", c.orgId)
      .not("diagnosis", "is", null);
    if (r.error) return null;
    // The query already filters by company; the check is repeated in memory, as the privileged client skips RLS.
    const rows = (r.data ?? []).filter((x) => x.org_id === c.orgId && x.diagnosis != null);
    const own = rows.find((x) => x.user_id === c.userId);
    const latest = [...rows].sort((a, b) =>
      String(b.updated_at).localeCompare(String(a.updated_at)),
    )[0];
    return (own ?? latest)?.diagnosis ?? null;
  } catch {
    return null;
  }
}

/** The person's own row; a failed read is treated as no row. Only step and diagnosis. */
async function myRow(c: ToolCtx) {
  const { data, error } = await c.db
    .from("onboarding_sessions")
    .select("step,diagnosis")
    .eq("org_id", c.orgId)
    .eq("user_id", c.userId)
    .maybeSingle();
  return error ? null : data;
}

export const ONBOARDING_TOOLS: AgentTool[] = [
  def({
    name: "get_onboarding_status",
    kind: "read",
    description:
      "Solo lee. Dice en qué paso del onboarding está la persona, el diagnóstico GTM de la empresa (arquetipo, motion, etapa y siguiente paso), qué piezas de la estrategia faltan y si hay lo mínimo para el diagnóstico de plays. No devuelve la propuesta ni los hallazgos.",
    input: z.object({}),
    run: async (c) => {
      const [mine, companyDiagnosis, setup] = await Promise.all([
        myRow(c),
        companyDiagnosisFor(c),
        loadSetupData(c.db, c.orgId),
      ]);
      return companyOnboardingStatus({ mine, companyDiagnosis, setup });
    },
  }),
];
