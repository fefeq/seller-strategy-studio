// Shared drafting core for the Ciclo GTM (server fn + agent tool).
import { ask } from "@/lib/ai-gateway";
import { loadSetupData, type Db } from "@/lib/org-data";
import { ARTIFACTS, getWorkflow, missingPrereqs, type ArtifactKind } from "./workflows";
import { PERSONAS } from "./personas";

type Ctx = { db: Db; orgId: string; userId: string; currency: string; orgName?: string };
export const STYLE = "Español neutro (tú). Concreto, basado en los datos; si falta información, dilo y marca supuestos como [Supuesto].";

/** Company context loaded by every BMAD agent: setup data + latest approved artifacts. */
export async function companyContext(db: Db, orgId: string) {
  const [setup, arts] = await Promise.all([
    loadSetupData(db, orgId),
    db.from("gtm_artifacts").select("kind,title,version,content").eq("org_id", orgId).eq("status", "approved").order("version", { ascending: false }),
  ]);
  const latest: Record<string, string> = {};
  for (const a of arts.data ?? []) if (!latest[a.kind]) latest[a.kind] = `${a.title} v${a.version}\n${a.content.slice(0, 6000)}`;
  return { setup, documentos_aprobados: latest };
}

export async function subjectData(db: Db, orgId: string, type: string | null, id: string | null) {
  if (!type || !id) return null;
  if (type === "deal") return (await db.from("deals").select("name,stage,amount,close_date,health,meddpicc,forecast_category,source,accounts(name)").eq("org_id", orgId).eq("id", id).maybeSingle()).data;
  if (type === "account") {
    const [a, p, s, d] = await Promise.all([
      db.from("accounts").select("name,domain,industry,health,tier").eq("org_id", orgId).eq("id", id).maybeSingle(),
      db.from("account_plans").select("*").eq("org_id", orgId).eq("account_id", id).maybeSingle(),
      db.from("stakeholders").select("name,title,buying_role,support").eq("org_id", orgId).eq("account_id", id),
      db.from("deals").select("name,stage,amount,health").eq("org_id", orgId).eq("account_id", id),
    ]);
    return { cuenta: a.data, plan: p.data, stakeholders: s.data, deals: d.data };
  }
  if (type === "artifact") return (await db.from("gtm_artifacts").select("kind,title,version,status,content").eq("org_id", orgId).eq("id", id).maybeSingle()).data;
  return null;
}

async function cycleData(db: Db, orgId: string, kind: ArtifactKind) {
  if (kind === "winloss" || kind === "retro") {
    const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
    return (await db.from("deals").select("name,stage,amount,closed_at,meddpicc,source,accounts(name)").eq("org_id", orgId).in("stage", ["won", "lost"]).gte("updated_at", since).limit(40)).data;
  }
  if (kind === "architecture" || kind === "readiness") {
    const [segs, quotas, members] = await Promise.all([
      db.from("segments").select("name,acv_min,acv_max,motion,cycle_days,sdr_per_ae,ae_per_se,win_rate_target,ae_quota,cac_target,payback_months").eq("org_id", orgId),
      db.from("quotas").select("period,amount").eq("org_id", orgId),
      db.from("org_members").select("role").eq("org_id", orgId),
    ]);
    return { segmentos: segs.data, cuotas: quotas.data, equipo_por_rol: (members.data ?? []).reduce<Record<string, number>>((m, r) => ((m[r.role] = (m[r.role] ?? 0) + 1), m), {}) };
  }
  return null;
}


export async function draftArtifactCore(ctx: Ctx, data: { kind: ArtifactKind; notes: string; dealId: string | null }) {
    const wf = getWorkflow(data.kind)!;
    const persona = PERSONAS.find((p) => p.menu.some((m) => m.workflow === wf.id))!;
    const cc = await companyContext(ctx.db, ctx.orgId);
    const missing = missingPrereqs(wf, Object.keys(cc.documentos_aprobados) as ArtifactKind[]);
    const spec = ARTIFACTS[data.kind];
    const extra = data.dealId ? await subjectData(ctx.db, ctx.orgId, "deal", data.dealId) : await cycleData(ctx.db, ctx.orgId, data.kind);
    const content = (await ask(
      `Eres ${persona.name} (${persona.title}) en Nokko. ${persona.tone}\nRedacta el documento "${spec.label}" en markdown con exactamente estas secciones (## título): ${spec.sections.join(" · ")}. ${STYLE} Moneda: ${ctx.currency}. Máximo ~900 palabras.${missing.length ? ` Aviso: faltan documentos aprobados previos (${missing.map((k) => ARTIFACTS[k].label).join(", ")}); indícalo al inicio y trabaja con lo disponible.` : ""}`,
      JSON.stringify({ empresa: (ctx.orgName ?? "la empresa"), contexto: cc, datos: extra, notas_del_usuario: data.notes || null }),
      { effort: "medium" },
    )).trim();
    if (!content) throw new Error("La IA no devolvió el documento. Inténtalo de nuevo.");
    const { data: prev } = await ctx.db.from("gtm_artifacts").select("version").eq("org_id", ctx.orgId).eq("kind", data.kind).order("version", { ascending: false }).limit(1).maybeSingle();
    const title = data.dealId && extra && "name" in (extra as object) ? `${spec.label}: ${(extra as { name: string }).name}` : spec.label;
    const { data: row, error } = await ctx.db.from("gtm_artifacts").insert({ org_id: ctx.orgId, kind: data.kind, title, version: (prev?.version ?? 0) + 1, content, persona: persona.id, meta: data.dealId ? { deal_id: data.dealId } : {} }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
}
