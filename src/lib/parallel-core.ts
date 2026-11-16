// Parallel cores shared by the screens (parallel.functions.ts), the agent/MCP tools (agent/tools/parallel.ts)
// and the Inngest poller. Runs are written with the admin client after the caller's company was checked.
import { createTaskRun, pollTaskRun, respond } from "@/lib/parallel-gateway";
import {
  LIST_SCHEMA,
  chunk,
  clampCount,
  enrichInput,
  enrichLookup,
  enrichSchema,
  listInput,
  listProcessor,
  readEnrichRows,
  readEntities,
  readReport,
  reportInput,
  reportSchema,
  type EnrichRow,
} from "@/lib/parallel";
import type { Db } from "@/lib/org-data";

export type Scope = { orgId: string; userId: string };
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function queuePoll(researchId: string) {
  const [{ inngestReady, sendEvents }, db] = await Promise.all([
    import("@/lib/inngest/send.server"),
    admin(),
  ]);
  if (await inngestReady(db))
    await sendEvents([{ name: "nokko/parallel.run", data: { research_id: researchId } }]).catch(
      () => undefined,
    );
}

/** Starts the deep report of an account (Task run, minutes). Returns the research row id. */
export async function startAccountReport(db: Db, s: Scope, accountId: string) {
  const { data: acc } = await db
    .from("accounts")
    .select("id,name,domain,country")
    .eq("org_id", s.orgId)
    .eq("id", accountId)
    .maybeSingle();
  if (!acc) throw new Error("No encuentro esa cuenta en esta empresa.");
  const [{ data: org }, { data: pos }] = await Promise.all([
    db.from("organizations").select("name,company_name").eq("id", s.orgId).single(),
    db
      .from("positioning")
      .select("one_liner,category,target_customer")
      .eq("org_id", s.orgId)
      .limit(1)
      .maybeSingle(),
  ]);
  const a = await admin();
  const { data: running } = await a
    .from("research_runs")
    .select("id")
    .eq("org_id", s.orgId)
    .eq("account_id", accountId)
    .eq("kind", "account_report")
    .eq("status", "running")
    .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .limit(1);
  if (running?.length) return { id: running[0].id as string, already: true };
  const runId = await createTaskRun(
    reportInput(acc, {
      company: org?.company_name?.trim() || org?.name || "nuestra empresa",
      ...(pos ?? {}),
    }),
    "core",
    reportSchema(),
  );
  const { data: row, error } = await a
    .from("research_runs")
    .insert({
      org_id: s.orgId,
      user_id: s.userId,
      kind: "account_report",
      account_id: accountId,
      label: `Informe de ${acc.name}`,
      run_id: runId,
      processor: "core",
      input: { account: acc.name },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await queuePoll(row.id);
  return { id: row.id as string, already: false };
}

/** Starts a list of companies matching the ICP (Task run, 5-50 minutes). */
export async function startIcpList(
  db: Db,
  s: Scope,
  opts: { icpId?: string | null; criteria: string; count: number },
) {
  let icp = null;
  if (opts.icpId) {
    const { data } = await db
      .from("icp_profiles")
      .select("*")
      .eq("org_id", s.orgId)
      .eq("id", opts.icpId)
      .maybeSingle();
    if (!data) throw new Error("No encuentro ese ICP en esta empresa.");
    icp = data;
  }
  if (!icp && !opts.criteria.trim())
    throw new Error("Elige un ICP o describe qué empresas buscas.");
  const count = clampCount(opts.count);
  const processor = listProcessor(count);
  const runId = await createTaskRun(listInput(icp, opts.criteria, count), processor, LIST_SCHEMA);
  const a = await admin();
  const label = `${count} cuentas: ${[icp?.industries, icp?.geography, opts.criteria.trim()].filter(Boolean).join(" · ").slice(0, 200) || "ICP"}`;
  const { data: row, error } = await a
    .from("research_runs")
    .insert({
      org_id: s.orgId,
      user_id: s.userId,
      kind: "icp_list",
      label,
      run_id: runId,
      processor,
      input: { icpId: opts.icpId ?? null, criteria: opts.criteria, count },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await queuePoll(row.id);
  return { id: row.id as string };
}

/** Checks a run once (never waits). Writes the result when Parallel has it. */
export async function checkRun(s: Scope | null, researchId: string) {
  const a = await admin();
  let q = a
    .from("research_runs")
    .select("id,org_id,kind,account_id,run_id,status,result,error,created_at")
    .eq("id", researchId);
  if (s) q = q.eq("org_id", s.orgId);
  const { data: r } = await q.maybeSingle();
  if (!r) throw new Error("No encuentro esa investigación en esta empresa.");
  if (r.status !== "running" || !r.run_id) return { status: r.status as string, error: r.error };
  const p = await pollTaskRun(r.run_id);
  const now = new Date().toISOString();
  if (p.status === "running") {
    if (Date.now() - new Date(r.created_at).getTime() > 60 * 60_000) {
      await a
        .from("research_runs")
        .update({
          status: "failed",
          error: "La investigación ha tardado más de una hora. Vuelve a lanzarla.",
          finished_at: now,
        })
        .eq("id", r.id);
      return { status: "failed" };
    }
    return { status: "running" };
  }
  if (p.status === "failed") {
    await a
      .from("research_runs")
      .update({ status: "failed", error: p.error, finished_at: now })
      .eq("id", r.id);
    return { status: "failed", error: p.error };
  }
  if (r.kind === "account_report") {
    const report = readReport(p.output);
    if (!report) {
      await a
        .from("research_runs")
        .update({
          status: "failed",
          error: "Parallel ha devuelto un informe ilegible. Vuelve a lanzarlo.",
          finished_at: now,
        })
        .eq("id", r.id);
      return { status: "failed" };
    }
    await a
      .from("research_runs")
      .update({ status: "done", result: { report }, finished_at: now })
      .eq("id", r.id);
  } else {
    const { data: existing } = await a
      .from("accounts")
      .select("id,domain,name")
      .eq("org_id", r.org_id)
      .limit(10000);
    const entities = readEntities(p.output, existing ?? []);
    await a
      .from("research_runs")
      .update({ status: "done", result: { entities }, finished_at: now })
      .eq("id", r.id);
  }
  return { status: "done" };
}

/** Completes up to 25 accounts at once (Responses, 5 rows per call, in parallel). Proposals only; saves nothing. */
export async function enrichTable(
  db: Db,
  s: Scope,
  accountIds: string[],
): Promise<(EnrichRow & { name: string })[]> {
  const ids = [...new Set(accountIds)].slice(0, 25);
  const { data: accs } = await db
    .from("accounts")
    .select("id,name,domain")
    .eq("org_id", s.orgId)
    .in("id", ids);
  const list = (accs ?? []) as { id: string; name: string; domain: string | null }[];
  if (!list.length) throw new Error("Elige al menos una cuenta de esta empresa.");
  const keyed = list.map((a, i) => ({
    key: `r${i + 1}`,
    name: a.name,
    domain: a.domain,
    id: a.id,
  }));
  const keys = enrichLookup(keyed);
  const parts = await Promise.allSettled(
    chunk(keyed).map((c) =>
      respond(enrichInput(c), enrichSchema, "medium").then((j) => readEnrichRows(j, keys)),
    ),
  );
  const rows = parts.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
  if (!rows.length) {
    const err = parts.find((p) => p.status === "rejected") as PromiseRejectedResult | undefined;
    throw err?.reason ?? new Error("Parallel no ha encontrado datos de esas cuentas.");
  }
  const names = new Map(list.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ ...r, name: names.get(r.account_id) ?? "" }));
}
