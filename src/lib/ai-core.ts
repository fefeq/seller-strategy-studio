// AI generations shared by the screens (server functions in ai.functions.ts, user client with RLS) and the
// agent tools (also run with the privileged client from Telegram). With a scope, every query filters by
// the company and team knowledge, so the privileged path reads exactly what the user could read in the app.
import { ask } from "@/lib/ai-gateway";
import {
  loadAgentRules,
  RULES_READ_FAILED,
  rulesBlock,
  type LoadedRules,
} from "@/lib/knowledge-rules";
import {
  loadVoice,
  VOICE_FORM_RULE,
  VOICE_READ_FAILED,
  voiceBlock,
  type LoadedVoice,
} from "@/lib/knowledge-voice";
import { callNotesText, hasCallNotes, normalizeCallNotes, TEARDOWN_SYSTEM } from "@/lib/call-notes";
import { searchBoth } from "@/lib/web-search";
import { companyName, sourcesMarkdown, type NewsItem } from "@/lib/web-research";
import type { Db } from "@/lib/org-data";
import { safeErrorLog } from "@/lib/agent/safe-error-log";

/** Company and user the generation runs for; null = the caller's RLS client already limits the rows. */
export type AiScope = { orgId: string; userId: string } | null;
/** Any PostgREST filter builder on a table with org_id: with a scope it adds the company filter, else it is left as is. */
const inOrg = <Q extends { eq(column: "org_id", value: string): Q }>(q: Q, scope: AiScope): Q =>
  scope ? q.eq("org_id", scope.orgId) : q;

/**
 * The team's rules for a generation (SDD-20261109-rules-in-ai-readers): with a scope, the company is scope.orgId; with
 * scope = null, the org_id of the row already read under RLS. No company to read with is a failure, never «no rules».
 */
async function rulesFor(
  db: Db,
  scope: AiScope,
  rowOrg: unknown,
  opts: AiOptions,
): Promise<Guidance> {
  // Who reads the answer decides what an «Escalar» rule asks (NK-0128): a screen (scope = null) has a person in front; the
  // autopilot and the background jobs call with a scope and no option, so they have none; the agent's tools say it explicitly.
  const withPerson = opts.withPerson ?? scope === null;
  const orgId = scope ? scope.orgId : typeof rowOrg === "string" ? rowOrg : "";
  if (!orgId) {
    console.error("knowledge rules load failed", "no org");
    return { ok: false, rules: [], voice: await loadVoice({ db, orgId }), withPerson };
  }
  const [r, voice] = await Promise.all([loadAgentRules({ db, orgId }), loadVoice({ db, orgId })]);
  return { ...r, voice, withPerson };
}

/** What a generation reads about the company: the team's rules and, apart, its voice (NK-0128). Each reports its own failure. */
type Guidance = LoadedRules & { voice: LoadedVoice; withPerson: boolean };

/** withPerson: a person reads the answer now (see rulesFor). */
export type AiOptions = {
  withPerson?: boolean;
  onCost?: (cost: number | null, provider: string) => Promise<void>;
};

/**
 * The system text with the rules block after it; without rules, the system text as it was. With voice examples it adds the one
 * fixed sentence that says how to use them: the examples themselves go in the user text (withVoice), never in the system text.
 */
function withRules(system: string, r: Guidance) {
  const block = rulesBlock(r.rules, { withPerson: r.withPerson });
  const base = block ? `${system}\n${block}` : system;
  return r.voice.examples.length ? `${base}\n${VOICE_FORM_RULE}` : base;
}

/** The user text with the company's voice as a data block after it; unchanged without examples. */
function withVoice(user: string, r: Guidance) {
  const block = voiceBlock(r.voice.examples);
  return block ? `${user}\n\n${block}` : user;
}

/** A failed read is said before the text, also in the saved one: the rules first, then the voice (same format as draft_followup). */
const notices = (r: Guidance) =>
  `${r.ok ? "" : `${RULES_READ_FAILED}\n\n`}${r.voice.ok ? "" : `${VOICE_READ_FAILED}\n\n`}`;
const warned = (text: string, r: Guidance) => `${notices(r)}${text}`;

export const U_SYSTEM =
  "Eres facilitador experto en Theory U (Otto Scharmer, Presencing Institute) aplicada a go-to-market B2B. Respondes en español neutro (tú), markdown conciso y accionable; empiezas por la conclusión, sin signos de exclamación ni emoji. Distingues lo observado (datos) de las hipótesis.";

export async function accountContext(db: Db, accountId: string, scope: AiScope = null) {
  let docs = inOrg(
    db
      .from("knowledge_docs")
      .select("section,title,body")
      .in("section", ["company", "objections", "playbooks", "methodology"]),
    scope,
  );
  // RLS shows team docs plus the user's own personal ones; the privileged path applies the same rule.
  if (scope) docs = docs.or(`scope.eq.team,created_by.eq.${scope.userId}`);
  const [acc, plan, sh, calls, deals, kd, pos, pillars, icp] = await Promise.all([
    inOrg(db.from("accounts").select("*").eq("id", accountId), scope).maybeSingle(),
    inOrg(db.from("account_plans").select("*").eq("account_id", accountId), scope).maybeSingle(),
    inOrg(
      db
        .from("stakeholders")
        .select("name,title,buying_role,support,priorities,research")
        .eq("account_id", accountId),
      scope,
    ),
    inOrg(
      db.from("calls").select("title,occurred_at,summary,next_steps").eq("account_id", accountId),
      scope,
    )
      .order("occurred_at", { ascending: false })
      .limit(5),
    inOrg(db.from("deals").select("name,stage,amount,meddpicc").eq("account_id", accountId), scope),
    docs.order("section").limit(30),
    inOrg(
      db
        .from("positioning")
        .select(
          "target_customer,need,product_name,category,key_benefit,competitive_alternative,differentiator,tagline,one_liner,short_pitch,elevator_pitch,alternatives,differentiation,value,trend",
        ),
      scope,
    )
      .limit(1)
      .maybeSingle(),
    inOrg(db.from("messaging_pillars").select("title,pain,message,proof"), scope).order("position"),
    inOrg(
      db
        .from("icp_profiles")
        .select(
          "name,industries,company_size,min_employees,max_employees,geography,countries,tech_stack,growth_stage,hiring_signals,funding_signals,pains,target_titles,seniorities,why_fit,anti_icp",
        ),
      scope,
    ).limit(5),
  ]);
  // Playbooks (discovery, objections, demo, negotiation) are what the call prep must follow; cap each so the prompt stays bounded.
  const conocimiento = (kd.data ?? []).map(
    (d: { section: string; title: string; body: string }) => ({
      ...d,
      body: d.body.slice(0, 5000),
    }),
  );
  return JSON.stringify({
    cuenta: acc.data,
    account_plan: plan.data,
    stakeholders: sh.data,
    llamadas: calls.data,
    deals: deals.data,
    conocimiento_empresa: conocimiento,
    posicionamiento: pos.data,
    pilares_de_mensaje: pillars.data,
    icp: icp.data,
  });
}

/** Call prep for a meeting (shared by the screen and the day-before autopilot). Saves it on the meeting. */
export async function meetingBriefCore(
  db: Db,
  meetingId: string,
  scope: AiScope = null,
  opts: AiOptions = {},
): Promise<{ brief: string; title: string; accountId: string | null; rulesRead: boolean }> {
  const { data: m } = await inOrg(
    db.from("meetings").select("*").eq("id", meetingId),
    scope,
  ).maybeSingle();
  if (!m) throw new Error("Reunión no encontrada");
  const [ctx, rules] = await Promise.all([
    m.account_id ? accountContext(db, m.account_id, scope) : Promise.resolve("{}"),
    rulesFor(db, scope, m.org_id, opts),
  ]);
  const text = await ask(
    withRules(
      "Eres un coach de ventas B2B senior. Responde en español neutro (tú), en markdown conciso. Empieza por la conclusión, sin signos de exclamación ni emoji. Si en conocimiento_empresa hay playbooks de discovery, objeciones, demo o negociación, síguelos: toma de ahí las preguntas y las respuestas y adáptalas a esta cuenta en vez de inventar otras. Estructura: 1) Brief de cuenta (3-5 bullets) 2) Stakeholders: quién es quién y cómo abordarlo 3) Preguntas de discovery sugeridas (5-7) 4) Objeciones probables y respuesta 5) Huecos MEDDPICC a cerrar en esta reunión 6) Próximo paso a proponer.",
      rules,
    ),
    withVoice(
      `Reunión: ${JSON.stringify({ titulo: m.title, objetivo: m.objective, asistentes: m.attendees, agenda: m.agenda, resultado_deseado: m.desired_outcome })}\n\nContexto del equipo:\n${ctx}`,
      rules,
    ),
    { onCost: opts.onCost },
  );
  const brief = warned(text, rules);
  await inOrg(db.from("meetings").update({ ai_brief: brief }).eq("id", m.id), scope);
  return { brief, title: m.title, accountId: m.account_id, rulesRead: rules.ok };
}

/**
 * AI teardown of a call: compares the five-line notes (and free notes) with the meeting's goal, the brief
 * and the deal's MEDDPICC, and says what worked, what is missing and what to update. Saved on the meeting.
 */
export async function callTeardownCore(
  db: Db,
  meetingId: string,
  scope: AiScope = null,
  opts: AiOptions = {},
) {
  const { data: m } = await inOrg(
    db
      .from("meetings")
      .select(
        "id,title,scheduled_at,objective,desired_outcome,agenda,questions,objections,attendees,ai_brief,notes,call_notes,account_id,deal_id,org_id",
      )
      .eq("id", meetingId),
    scope,
  ).maybeSingle();
  if (!m) throw new Error("Reunión no encontrada");
  const lines = normalizeCallNotes(m.call_notes);
  if (!hasCallNotes(lines) && !(m.notes ?? "").trim())
    throw new Error("Escribe primero las notas de la llamada (las 5 líneas o tus notas libres)");
  const [deal, ctx, rules] = await Promise.all([
    m.deal_id
      ? inOrg(
          db.from("deals").select("name,stage,amount,close_date,meddpicc").eq("id", m.deal_id),
          scope,
        ).maybeSingle()
      : Promise.resolve({ data: null }),
    m.account_id ? accountContext(db, m.account_id, scope) : Promise.resolve("{}"),
    rulesFor(db, scope, m.org_id, opts),
  ]);
  const reunion = {
    titulo: m.title,
    fecha: m.scheduled_at,
    objetivo: m.objective,
    resultado_deseado: m.desired_outcome,
    agenda: m.agenda,
    preguntas_previstas: m.questions,
    objeciones_esperadas: m.objections,
    asistentes: m.attendees,
    preparacion: (m.ai_brief ?? "").slice(0, 6000),
    notas_en_5_lineas: callNotesText(lines) || "(sin notas en 5 líneas)",
    notas_libres: m.notes ?? "",
  };
  const text = warned(
    await ask(
      withRules(TEARDOWN_SYSTEM, rules),
      withVoice(
        `Reunión:\n${JSON.stringify(reunion)}\n\nDeal:\n${JSON.stringify(deal.data ?? null)}\n\nContexto de la cuenta:\n${ctx}`,
        rules,
      ),
      { effort: "medium" },
    ),
    rules,
  );
  const { error } = await inOrg(
    db.from("meetings").update({ call_review: text }).eq("id", m.id),
    scope,
  );
  if (error) throw new Error(error.message);
  return { text, title: m.title as string, rulesRead: rules.ok };
}

/** Business case draft for an account. Returns the text; nothing is saved or sent. */
export async function proposalCore(
  db: Db,
  accountId: string,
  scope: AiScope = null,
  opts: AiOptions = {},
) {
  // Without a scope, the account's org_id (read under RLS) says whose rules apply; not found = no org = failure.
  const [ctx, rules] = await Promise.all([
    accountContext(db, accountId, scope),
    scope
      ? rulesFor(db, scope, null, opts)
      : inOrg(db.from("accounts").select("org_id").eq("id", accountId), scope)
          .maybeSingle()
          .then((r: { data: { org_id?: unknown } | null }) =>
            rulesFor(db, scope, r.data?.org_id, opts),
          ),
  ]);
  const text = await ask(
    withRules(
      "Eres un estratega comercial. Redacta en español neutro (tú), sin signos de exclamación ni emoji, en markdown, un borrador de propuesta / business case: resumen ejecutivo, situación y dolores, solución propuesta, impacto y ROI estimado (indica supuestos), plan de implementación, próximos pasos. No inventes cifras sin marcarlas como supuesto.",
      rules,
    ),
    withVoice(ctx, rules),
  );
  return { text: warned(text, rules), rulesRead: rules.ok };
}

/**
 * Stakeholder research: searches the web (Firecrawl) for the person at their company, then writes facts
 * with their source links and marks the rest as hypotheses. Without web results it falls back to
 * hypotheses from the account context. Saved on the stakeholder.
 */
export async function researchStakeholderCore(
  db: Db,
  stakeholderId: string,
  scope: AiScope = null,
  opts: AiOptions = {},
) {
  const { data: s } = await inOrg(
    db.from("stakeholders").select("*").eq("id", stakeholderId),
    scope,
  ).maybeSingle();
  if (!s) throw new Error("No encontrado");
  const [{ data: acc }, ctx, rules] = await Promise.all([
    inOrg(db.from("accounts").select("name,domain").eq("id", s.account_id), scope).maybeSingle(),
    accountContext(db, s.account_id, scope),
    rulesFor(db, scope, s.org_id, opts),
  ]);
  let web: NewsItem[] = [];
  let webNote = "";
  // Their own LinkedIn posts (Apify), when the stakeholder has a profile; never blocks the research.
  const postsP = (async () => {
    if (!process.env["APIFY_API_KEY"] || !s.linkedin_url) return [];
    const [{ linkedinProfileUrl }, { profilePosts }] = await Promise.all([
      import("@/lib/apify"),
      import("@/lib/apify-core"),
    ]);
    const url = linkedinProfileUrl(s.linkedin_url);
    return url
      ? profilePosts(url, 3).catch((e) => {
          console.error("Apify profile posts failed", safeErrorLog(e));
          return [];
        })
      : [];
  })();
  try {
    const who = `"${s.name}" ${companyName(acc?.name, acc?.domain)}`.trim();
    web = await searchBoth(
      { query: `${who} ${s.title ?? ""}`.trim(), limit: 6, sources: ["web", "news"] },
      {
        queries: [`${who} ${s.title ?? ""}`.trim(), `${who} entrevista OR podcast OR nombramiento`],
        maxResults: 4,
      },
      8,
      s.org_id
        ? {
            db,
            orgId: s.org_id,
            userId: scope?.userId || null,
            tool: "research_stakeholder",
            trigger: "manual",
          }
        : undefined,
    );
    if (!web.length) webNote = "No he encontrado resultados en internet sobre esta persona.";
  } catch (e) {
    webNote = `No he podido buscar en internet: ${(e as Error).message}`;
  }
  const posts = await postsP;
  const body = await ask(
    withRules(
      "Eres analista de research de ventas. En español neutro (tú), sin signos de exclamación ni emoji, y markdown breve. Primero «Lo que dicen las fuentes»: solo hechos de resultados_web sobre esta persona, cada uno con su enlace markdown a la fuente; si los resultados son de un homónimo o de otra empresa, ignóralos y dilo. Si hay publicaciones_linkedin (suyas o que ha compartido), añade «De qué habla en LinkedIn» con los temas y su enlace. Después: prioridades probables según su cargo, qué le importa, cómo encaja nuestra propuesta, riesgos y 3 aperturas de conversación, marcando como «(hipótesis)» lo que no venga de las fuentes ni del contexto.",
      rules,
    ),
    withVoice(
      `Persona: ${JSON.stringify({ nombre: s.name, cargo: s.title, empresa: acc?.name ?? null, linkedin: s.linkedin_url, rol: s.buying_role, apoyo: s.support, notas: s.priorities })}\n\nresultados_web: ${JSON.stringify(web.map((w) => ({ titulo: w.title, url: w.url, extracto: w.snippet, fecha: w.date })))}\n\npublicaciones_linkedin: ${JSON.stringify(posts.map((p) => ({ url: p.url, fecha: p.date, compartida: p.repost, texto: p.text })))}\n\nContexto:\n${ctx}`,
      rules,
    ),
  );
  // The rules warning goes before the web note.
  const text = `${notices(rules)}${webNote ? `_${webNote}_\n\n` : ""}${body}${sourcesMarkdown([...web, ...posts.map((p) => ({ title: `LinkedIn · ${p.text.slice(0, 80)}`, url: p.url, snippet: "", date: p.date, source: "LinkedIn" }))])}`;
  await inOrg(db.from("stakeholders").update({ research: text }).eq("id", s.id), scope);
  return { text, name: s.name as string, rulesRead: rules.ok };
}

/** Listening coaching for a meeting, saved on the meeting. */
export async function listeningCoachingCore(
  db: Db,
  meetingId: string,
  scope: AiScope = null,
  opts: AiOptions = {},
) {
  const { data: row } = await inOrg(
    db
      .from("meetings")
      .select(
        "title,objective,attendees,questions,notes,next_steps,call_notes,listening_level,listening_reflection,account_id,org_id",
      )
      .eq("id", meetingId),
    scope,
  ).maybeSingle();
  if (!row) throw new Error("Reunión no encontrada");
  // The account name is read with the company filter instead of an embedded join, so a meeting pointing at
  // another company's account can never put that name in the prompt.
  // org_id only says whose rules apply; it never goes in the prompt.
  const { account_id, org_id, ...fields } = row;
  const [acc, rules] = await Promise.all([
    account_id
      ? inOrg(db.from("accounts").select("name").eq("id", account_id), scope).maybeSingle()
      : Promise.resolve({ data: null }),
    rulesFor(db, scope, org_id, opts),
  ]);
  const m = { ...fields, accounts: acc.data ? { name: acc.data.name } : null };
  const lines = normalizeCallNotes(m.call_notes);
  if (!m.notes && !hasCallNotes(lines) && !m.listening_reflection)
    throw new Error("Escribe las notas o tu reflexión de la reunión primero");
  const text = warned(
    await ask(
      withRules(
        `${U_SYSTEM} Eres coach de escucha para vendedores. Niveles: 1 Descarga (confirmo lo que ya sé), 2 Factual (noto lo nuevo), 3 Empática (veo con sus ojos), 4 Generativa (escucho lo que emerge). Estructura: 1) Nivel que reflejan las notas (con evidencias citadas) frente al nivel autoevaluado 2) Momentos donde se pudo escuchar más hondo 3) Qué hacer para subir un nivel en la próxima reunión (3 prácticas concretas) 4) Cinco preguntas abiertas para la próxima conversación con esta cuenta.`,
        rules,
      ),
      withVoice(
        JSON.stringify({ ...m, call_notes: undefined, notas_en_5_lineas: callNotesText(lines) }),
        rules,
      ),
    ),
    rules,
  );
  await inOrg(db.from("meetings").update({ listening_coaching: text }).eq("id", meetingId), scope);
  return { text, title: m.title as string, rulesRead: rules.ok };
}
