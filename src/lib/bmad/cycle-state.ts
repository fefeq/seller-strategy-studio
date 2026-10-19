// Loads the inputs of the pure cycle rules. Filters org_id explicitly (safe with privileged clients).
import { loadSetupData, type Db } from "@/lib/org-data";
import { setupStatus } from "@/lib/setup-schema";
import type { CycleState } from "./phases";
import type { ArtifactKind } from "./workflows";

export async function loadCycleState(db: Db, orgId: string) {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [setup, arts, open, closed] = await Promise.all([
    loadSetupData(db, orgId),
    db.from("gtm_artifacts").select("id,kind,title,version,status,meta,updated_at").eq("org_id", orgId).neq("status", "archived").order("updated_at", { ascending: false }),
    db.from("deals").select("id", { count: "exact", head: true }).eq("org_id", orgId).not("stage", "in", "(won,lost)"),
    db.from("deals").select("id").eq("org_id", orgId).in("stage", ["won", "lost"]).gte("updated_at", since),
  ]);
  const list = arts.data ?? [];
  return { state: buildCycleState(setupStatus(setup).pct, list, open.count ?? 0, (closed.data ?? []).map((d) => d.id)), artifacts: list };
}

export function buildCycleState(
  setupPct: number,
  artifacts: { kind: string; status: string; meta: unknown; updated_at: string }[],
  openDeals: number,
  recentClosedDealIds: string[],
  now = new Date(),
): CycleState {
  const approved = [...new Set(artifacts.filter((a) => a.status === "approved").map((a) => a.kind as ArtifactKind))];
  const drafts = [...new Set(artifacts.filter((a) => a.status === "draft").map((a) => a.kind as ArtifactKind))];
  const covered = new Set(artifacts.filter((a) => a.kind === "winloss").map((a) => (a.meta as { deal_id?: string } | null)?.deal_id).filter(Boolean));
  const retro = artifacts.filter((a) => a.kind === "retro" && a.status === "approved").map((a) => +new Date(a.updated_at)).sort((a, b) => b - a)[0];
  return {
    approved, drafts, setupPct, openDeals,
    closedDealsWithoutWinloss: recentClosedDealIds.filter((id) => !covered.has(id)).length,
    daysSinceRetro: retro ? Math.floor((+now - retro) / 86_400_000) : null,
  };
}
