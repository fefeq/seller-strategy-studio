// AI generations shared by the screens (server functions in ai.functions.ts, user client with RLS) and the
// agent tools (also run with the privileged client from Telegram). With a scope, every query filters by
// the company and team knowledge, so the privileged path reads exactly what the user could read in the app.
import { ask } from "@/lib/ai-gateway";
import { callNotesText, hasCallNotes, normalizeCallNotes, TEARDOWN_SYSTEM } from "@/lib/call-notes";
import { searchBoth } from "@/lib/web-search";
import { companyName, sourcesMarkdown, type NewsItem } from "@/lib/web-research";

/** Company and user the generation runs for; null = the caller's RLS client already limits the rows. */
export type AiScope = { orgId: string; userId: string } | null;
type Db = any;

const inOrg = (q: any, scope: AiScope) => (scope ? q.eq("org_id", scope.orgId) : q);

export const U_SYSTEM = "Eres facilitador experto en Theory U (Otto Scharmer, Presencing Institute) aplicada a go-to-market B2B. Respondes en español neutro (tú), markdown conciso y accionable; empiezas por la conclusión, sin signos de exclamación ni emoji. Distingues lo observado (datos) de las hipótesis.";

export async function accountContext(db: Db, accountId: string, scope: AiScope = null) {
  let docs = inOrg(db.from("knowledge_docs").select("section,title,body").in("section", ["company", "objections", "playbooks", "methodology"]), scope);
  // RLS shows team docs plus the user's own personal ones; the privileged path applies the same rule.
  if (scope) docs = docs.or(`scope.eq.team,created_by.eq.${scope.userId}`);
  const [acc, plan, sh, calls, deals, kd, pos, pillars, icp] = await Promise.all([
    inOrg(db.from("accounts").select("*").eq("id", accountId), scope).maybeSingle(),
    inOrg(db.from("account_plans").select("*").eq("account_id", accountId), scope).maybeSingle(),
    inOrg(db.from("stakeholders").select("name,title,buying_role,support,priorities,research").eq("account_id", accountId), scope),
    inOrg(db.from("calls").select("title,occurred_at,summary,next_steps").eq("account_id", accountId), scope).order("occurred_at", { ascending: false }).limit(5),
    inOrg(db.from("deals").select("name,stage,amount,meddpicc").eq("account_id", accountId), scope),
    docs.order("section").limit(30),
    inOrg(db.from("positioning").select("target_customer,need,product_name,category,key_benefit,competitive_alternative,differentiator,tagline,one_liner,short_pitch,elevator_pitch,alternatives,differentiation,value,trend"), scope).limit(1).maybeSingle(),
    inOrg(db.from("messaging_pillars").select("title,pain,message,proof"), scope).order("position"),
    inOrg(db.from("icp_profiles").select("name,industries,company_size,tech_stack,growth_stage,hiring_signals,funding_signals,why_fit,anti_icp"), scope).limit(5),
  ]);
  // Playbooks (discovery, objections, demo, negotiation) are what the call prep must follow; cap each so the prompt stays bounded.
  const conocimiento = (kd.data ?? []).map((d: { section: string; title: string; body: string }) => ({ ...d, body: d.body.slice(0, 5000) }));
  return JSON.stringify({ cuenta: acc.data, account_plan: plan.data, stakeholders: sh.data, llamadas: calls.data, deals: deals.data, conocimiento_empresa: conocimiento, posicionamiento: pos.data, pilares_de_mensaje: pillars.data, icp: icp.data });
}

/**
 * AI teardown of a call: compares the five-line notes (and free notes) with the meeting's goal, the brief
 * and the deal's MEDDPICC, and says what worked, what is missing and what to update. Saved on the meeting.
 */
export async function callTeardownCore(db: Db, meetingId: string, scope: AiScope = null) {
  const { data: m } = await inOrg(db.from("meetings").select("id,title,scheduled_at,objective,desired_outcome,agenda,questions,objections,attendees,ai_brief,notes,call_notes,account_id,deal_id").eq("id", meetingId), scope).maybeSingle();
  if (!m) throw new Error("Reunión no encontrada");
  const lines = normalizeCallNotes(m.call_notes);
  if (!hasCallNotes(lines) && !(m.notes ?? "").trim()) throw new Error("Escribe primero las notas de la llamada (las 5 líneas o tus notas libres)");
  const [deal, ctx] = await Promise.all([
    m.deal_id ? inOrg(db.from("deals").select("name,stage,amount,close_date,meddpicc").eq("id", m.deal_id), scope).maybeSingle() : Promise.resolve({ data: null }),
    m.account_id ? accountContext(db, m.account_id, scope) : Promise.resolve("{}"),
  ]);
  const reunion = {
    titulo: m.title, fecha: m.scheduled_at, objetivo: m.objective, resultado_deseado: m.desired_outcome, agenda: m.agenda,
    preguntas_previstas: m.questions, objeciones_esperadas: m.objections, asistentes: m.attendees,
    preparacion: (m.ai_brief ?? "").slice(0, 6000),
    notas_en_5_lineas: callNotesText(lines) || "(sin notas en 5 líneas)", notas_libres: m.notes ?? "",
  };
  const text = await ask(TEARDOWN_SYSTEM, `Reunión:\n${JSON.stringify(reunion)}\n\nDeal:\n${JSON.stringify(deal.data ?? null)}\n\nContexto de la cuenta:\n${ctx}`, { effort: "medium" });
  const { error } = await inOrg(db.from("meetings").update({ call_review: text }).eq("id", m.id), scope);
  if (error) throw new Error(error.message);
  return { text, title: m.title as string };
}

/** Business case draft for an account. Returns the text; nothing is saved or sent. */
export async function proposalCore(db: Db, accountId: string, scope: AiScope = null) {
  const ctx = await accountContext(db, accountId, scope);
  const text = await ask(
    "Eres un estratega comercial. Redacta en español neutro (tú), sin signos de exclamación ni emoji, en markdown, un borrador de propuesta / business case: resumen ejecutivo, situación y dolores, solución propuesta, impacto y ROI estimado (indica supuestos), plan de implementación, próximos pasos. No inventes cifras sin marcarlas como supuesto.",
    ctx,
  );
  return { text };
}

/**
 * Stakeholder research: searches the web (Firecrawl) for the person at their company, then writes facts
 * with their source links and marks the rest as hypotheses. Without web results it falls back to
 * hypotheses from the account context. Saved on the stakeholder.
 */
export async function researchStakeholderCore(db: Db, stakeholderId: string, scope: AiScope = null) {
  const { data: s } = await inOrg(db.from("stakeholders").select("*").eq("id", stakeholderId), scope).maybeSingle();
  if (!s) throw new Error("No encontrado");
  const [{ data: acc }, ctx] = await Promise.all([
    inOrg(db.from("accounts").select("name,domain").eq("id", s.account_id), scope).maybeSingle(),
    accountContext(db, s.account_id, scope),
  ]);
  let web: NewsItem[] = [];
  let webNote = "";
  // Their own LinkedIn posts (Apify), when the stakeholder has a profile; never blocks the research.
  const postsP = (async () => {
    if (!process.env["APIFY_API_KEY"] || !s.linkedin_url) return [];
    const [{ linkedinProfileUrl }, { profilePosts }] = await Promise.all([import("@/lib/apify"), import("@/lib/apify-core")]);
    const url = linkedinProfileUrl(s.linkedin_url);
    return url ? profilePosts(url, 3).catch((e) => { console.error("Apify profile posts failed", (e as Error).message); return []; }) : [];
  })();
  try {
    const who = `"${s.name}" ${companyName(acc?.name, acc?.domain)}`.trim();
    web = await searchBoth({ query: `${who} ${s.title ?? ""}`.trim(), limit: 6, sources: ["web", "news"] }, { queries: [`${who} ${s.title ?? ""}`.trim(), `${who} entrevista OR podcast OR nombramiento`], maxResults: 4 }, 8);
    if (!web.length) webNote = "No he encontrado resultados en internet sobre esta persona.";
  } catch (e) { webNote = `No he podido buscar en internet: ${(e as Error).message}`; }
  const posts = await postsP;
  const body = await ask(
    "Eres analista de research de ventas. En español neutro (tú), sin signos de exclamación ni emoji, y markdown breve. Primero «Lo que dicen las fuentes»: solo hechos de resultados_web sobre esta persona, cada uno con su enlace markdown a la fuente; si los resultados son de un homónimo o de otra empresa, ignóralos y dilo. Si hay publicaciones_linkedin (suyas o que ha compartido), añade «De qué habla en LinkedIn» con los temas y su enlace. Después: prioridades probables según su cargo, qué le importa, cómo encaja nuestra propuesta, riesgos y 3 aperturas de conversación, marcando como «(hipótesis)» lo que no venga de las fuentes ni del contexto.",
    `Persona: ${JSON.stringify({ nombre: s.name, cargo: s.title, empresa: acc?.name ?? null, linkedin: s.linkedin_url, rol: s.buying_role, apoyo: s.support, notas: s.priorities })}\n\nresultados_web: ${JSON.stringify(web.map((w) => ({ titulo: w.title, url: w.url, extracto: w.snippet, fecha: w.date })))}\n\npublicaciones_linkedin: ${JSON.stringify(posts.map((p) => ({ url: p.url, fecha: p.date, compartida: p.repost, texto: p.text })))}\n\nContexto:\n${ctx}`,
  );
  const text = `${webNote ? `_${webNote}_\n\n` : ""}${body}${sourcesMarkdown([...web, ...posts.map((p) => ({ title: `LinkedIn · ${p.text.slice(0, 80)}`, url: p.url, snippet: "", date: p.date, source: "LinkedIn" }))])}`;
  await inOrg(db.from("stakeholders").update({ research: text }).eq("id", s.id), scope);
  return { text, name: s.name as string };
}

/** Listening coaching for a meeting, saved on the meeting. */
export async function listeningCoachingCore(db: Db, meetingId: string, scope: AiScope = null) {
  const { data: row } = await inOrg(db.from("meetings").select("title,objective,attendees,questions,notes,next_steps,call_notes,listening_level,listening_reflection,account_id").eq("id", meetingId), scope).maybeSingle();
  if (!row) throw new Error("Reunión no encontrada");
  // The account name is read with the company filter instead of an embedded join, so a meeting pointing at
  // another company's account can never put that name in the prompt.
  const { account_id, ...fields } = row;
  const acc = account_id ? await inOrg(db.from("accounts").select("name").eq("id", account_id), scope).maybeSingle() : { data: null };
  const m = { ...fields, accounts: acc.data ? { name: acc.data.name } : null };
  const lines = normalizeCallNotes(m.call_notes);
  if (!m.notes && !hasCallNotes(lines) && !m.listening_reflection) throw new Error("Escribe las notas o tu reflexión de la reunión primero");
  const text = await ask(
    `${U_SYSTEM} Eres coach de escucha para vendedores. Niveles: 1 Descarga (confirmo lo que ya sé), 2 Factual (noto lo nuevo), 3 Empática (veo con sus ojos), 4 Generativa (escucho lo que emerge). Estructura: 1) Nivel que reflejan las notas (con evidencias citadas) frente al nivel autoevaluado 2) Momentos donde se pudo escuchar más hondo 3) Qué hacer para subir un nivel en la próxima reunión (3 prácticas concretas) 4) Cinco preguntas abiertas para la próxima conversación con esta cuenta.`,
    JSON.stringify({ ...m, call_notes: undefined, notas_en_5_lineas: callNotesText(lines) }),
  );
  await inOrg(db.from("meetings").update({ listening_coaching: text }).eq("id", meetingId), scope);
  return { text, title: m.title as string };
}
