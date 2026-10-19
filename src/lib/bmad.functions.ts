import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ask } from "@/lib/ai-gateway";
import { loadSetupData, type Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { ARTIFACTS, getWorkflow, missingPrereqs, type ArtifactKind } from "@/lib/bmad/workflows";
import { getPersona, PERSONAS } from "@/lib/bmad/personas";
import { canConvene, DEBATE_LEVELS, resolveParticipants, withRebuttal, type DebateLevel } from "@/lib/bmad/teams";

const KINDS = Object.keys(ARTIFACTS) as ArtifactKind[];
const LEVELS = Object.keys(DEBATE_LEVELS) as DebateLevel[];
const STYLE = "Español neutro (tú). Concreto, basado en los datos; si falta información, dilo y marca supuestos como [Supuesto].";

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

async function subjectData(db: Db, orgId: string, type: string | null, id: string | null) {
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

export const draftArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: string; notes?: string; dealId?: string | null }) => {
    if (!KINDS.includes(d.kind as ArtifactKind)) throw new Error("Tipo de documento no válido");
    return { kind: d.kind as ArtifactKind, notes: String(d.notes ?? "").slice(0, 6000), dealId: d.dealId ? String(d.dealId) : null };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const wf = getWorkflow(data.kind)!;
    const persona = PERSONAS.find((p) => p.menu.some((m) => m.workflow === wf.id))!;
    const cc = await companyContext(ctx.db, ctx.orgId);
    const missing = missingPrereqs(wf, Object.keys(cc.documentos_aprobados) as ArtifactKind[]);
    const spec = ARTIFACTS[data.kind];
    const extra = data.dealId ? await subjectData(ctx.db, ctx.orgId, "deal", data.dealId) : await cycleData(ctx.db, ctx.orgId, data.kind);
    const content = (await ask(
      `Eres ${persona.name} (${persona.title}) en GTM Brain. ${persona.tone}\nRedacta el documento "${spec.label}" en markdown con exactamente estas secciones (## título): ${spec.sections.join(" · ")}. ${STYLE} Moneda: ${ctx.currency}. Máximo ~900 palabras.${missing.length ? ` Aviso: faltan documentos aprobados previos (${missing.map((k) => ARTIFACTS[k].label).join(", ")}); indícalo al inicio y trabaja con lo disponible.` : ""}`,
      JSON.stringify({ empresa: ctx.orgName, contexto: cc, datos: extra, notas_del_usuario: data.notes || null }),
      { effort: "medium" },
    )).trim();
    if (!content) throw new Error("La IA no devolvió el documento. Inténtalo de nuevo.");
    const { data: prev } = await ctx.db.from("gtm_artifacts").select("version").eq("org_id", ctx.orgId).eq("kind", data.kind).order("version", { ascending: false }).limit(1).maybeSingle();
    const title = data.dealId && extra && "name" in (extra as object) ? `${spec.label}: ${(extra as { name: string }).name}` : spec.label;
    const { data: row, error } = await ctx.db.from("gtm_artifacts").insert({ org_id: ctx.orgId, kind: data.kind, title, version: (prev?.version ?? 0) + 1, content, persona: persona.id, meta: data.dealId ? { deal_id: data.dealId } : {} }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const METHODS: Record<string, string> = {
  premortem: "Pre-mortem: imagina que dentro de 6 meses esto ha fracasado y explica por qué.",
  redteam: "Red team: ataca el documento como lo haría el competidor más fuerte.",
  first_principles: "Primeros principios: cuestiona cada supuesto y reconstruye desde lo que sabemos seguro.",
  socratic: "Preguntas socráticas: las preguntas incómodas que un consejero haría.",
  power_map: "Mapa de poder: quién decide, quién bloquea y qué intereses mueven a cada parte.",
};
export const REVIEW_METHODS = Object.keys(METHODS);

const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "findings", "revised"],
  properties: {
    summary: { type: "string" },
    findings: { type: "array", items: { type: "object", additionalProperties: false, required: ["severity", "issue", "fix"], properties: { severity: { type: "string", enum: ["alta", "media", "baja"] }, issue: { type: "string" }, fix: { type: "string" } } } },
    revised: { type: "string", description: "Documento completo revisado en markdown con los cambios aplicados" },
  },
};

export const deepReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { artifactId: string; method: string }) => {
    if (!METHODS[d.method]) throw new Error("Método no válido");
    return { artifactId: String(d.artifactId), method: d.method };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    const art = await subjectData(ctx.db, ctx.orgId, "artifact", data.artifactId);
    if (!art) throw new Error("Documento no encontrado");
    const cc = await companyContext(ctx.db, ctx.orgId);
    const raw = await ask(
      `Eres un revisor GTM senior. Aplica este método al documento: ${METHODS[data.method]} Devuelve de 3 a 7 hallazgos ordenados por severidad y el documento completo revisado. ${STYLE}`,
      JSON.stringify({ documento: art, contexto: cc }),
      { effort: "medium", schema: { name: "deep_review", schema: REVIEW_SCHEMA } },
    );
    try { return JSON.parse(raw) as { summary: string; findings: { severity: string; issue: string; fix: string }[]; revised: string }; }
    catch { throw new Error("La IA no devolvió una revisión válida. Inténtalo de nuevo."); }
  });

const SYNTH_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "agreements", "disagreements", "risks", "actions"],
  properties: {
    summary: { type: "string" },
    agreements: { type: "array", items: { type: "string" } },
    disagreements: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "owner_persona", "due_in_days"], properties: { title: { type: "string" }, owner_persona: { type: "string" }, due_in_days: { type: "integer" } } } },
  },
};

export const runDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { level: string; topic: string; subjectType?: string | null; subjectId?: string | null; participants?: string[] }) => {
    if (!LEVELS.includes(d.level as DebateLevel)) throw new Error("Nivel no válido");
    const topic = String(d.topic ?? "").trim();
    if (!topic) throw new Error("Escribe el tema del debate");
    const st = ["deal", "account", "artifact"].includes(String(d.subjectType)) ? String(d.subjectType) : null;
    return { level: d.level as DebateLevel, topic: topic.slice(0, 2000), subjectType: st, subjectId: st && d.subjectId ? String(d.subjectId) : null, participants: Array.isArray(d.participants) ? d.participants.map(String) : [] };
  })
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.supabase as Db, context.userId);
    if (!canConvene(data.level, ctx.roles)) throw new Error("Tu rol no puede convocar este nivel de debate");
    const ids = resolveParticipants(data.level, data.participants);
    const [cc, subject] = await Promise.all([companyContext(ctx.db, ctx.orgId), subjectData(ctx.db, ctx.orgId, data.subjectType, data.subjectId)]);
    const shared = JSON.stringify({ empresa: ctx.orgName, moneda: ctx.currency, tema: data.topic, sujeto: subject, contexto: cc });
    const speak = (pid: string, round: string) => {
      const p = getPersona(pid)!;
      return ask(`Eres ${p.name} (${p.title}), personaje inspirado en ${p.inspiredBy}, en una mesa de debate "${DEBATE_LEVELS[data.level].label}" de GTM Brain. ${p.tone} Tu foco: ${p.focus} ${round} Máximo 120 palabras, en primera persona, sin saludos. ${STYLE}`, shared, { effort: "low" }).then((t) => ({ persona: pid, round: round.startsWith("Ronda 1") ? 1 : 2, text: t.trim() }));
    };
    const r1 = await Promise.all(ids.map((id) => speak(id, "Ronda 1: da tu postura y tu recomendación principal desde tu papel.")));
    let turns = r1;
    if (withRebuttal(ids)) {
      const said = r1.map((t) => `${getPersona(t.persona)!.name}: ${t.text}`).join("\n\n");
      const r2 = await Promise.all(ids.map((id) => speak(id, `Ronda 2 (réplica): esto dijeron los demás:\n${said}\nResponde a la postura con la que más discrepes y ajusta tu recomendación.`)));
      turns = [...r1, ...r2];
    }
    const raw = await ask(
      `Eres GTM Brain, moderador del debate. Sintetiza: resumen, acuerdos, desacuerdos, riesgos y de 3 a 6 acciones concretas (owner_persona = id de uno de: ${ids.join(", ")}). ${STYLE}`,
      JSON.stringify({ tema: data.topic, turnos: turns.map((t) => ({ quien: getPersona(t.persona)!.name, ronda: t.round, texto: t.text })) }),
      { effort: "low", schema: { name: "debate_synthesis", schema: SYNTH_SCHEMA } },
    );
    let synthesis: unknown;
    try { synthesis = JSON.parse(raw); } catch { throw new Error("La IA no devolvió la síntesis. Inténtalo de nuevo."); }
    const { data: row, error } = await ctx.db.from("debates").insert({ org_id: ctx.orgId, level: data.level, topic: data.topic, subject_type: data.subjectType, subject_id: data.subjectId, participants: ids, turns: turns as any, synthesis: synthesis as any }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
