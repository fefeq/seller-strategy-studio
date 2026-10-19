import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ask } from "@/lib/ai-gateway";
import { ADVISOR_SCHEMA, buildSnapshot, canUseAdvisor, HORIZONS, type AdvisorResult } from "@/lib/advisor";

async function accountContext(supabase: any, accountId: string) {
  const [acc, plan, sh, calls, deals, docs, pos, pillars, icp] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", accountId).maybeSingle(),
    supabase.from("account_plans").select("*").eq("account_id", accountId).maybeSingle(),
    supabase.from("stakeholders").select("name,title,buying_role,support,priorities,research").eq("account_id", accountId),
    supabase.from("calls").select("title,occurred_at,summary,next_steps").eq("account_id", accountId).order("occurred_at", { ascending: false }).limit(5),
    supabase.from("deals").select("name,stage,amount,meddpicc").eq("account_id", accountId),
    supabase.from("knowledge_docs").select("section,title,body").in("section", ["company", "objections", "playbooks", "methodology"]).limit(20),
    supabase.from("positioning").select("target_customer,need,product_name,category,key_benefit,competitive_alternative,differentiator,tagline,one_liner,short_pitch,elevator_pitch,alternatives,differentiation,value,trend").limit(1).maybeSingle(),
    supabase.from("messaging_pillars").select("title,pain,message,proof").order("position"),
    supabase.from("icp_profiles").select("name,industries,company_size,tech_stack,growth_stage,hiring_signals,funding_signals,why_fit,anti_icp").limit(5),
  ]);
  return JSON.stringify({ cuenta: acc.data, account_plan: plan.data, stakeholders: sh.data, llamadas: calls.data, deals: deals.data, conocimiento_empresa: docs.data, posicionamiento: pos.data, pilares_de_mensaje: pillars.data, icp: icp.data });
}

export const generateMeetingBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meetingId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: m, error } = await supabase.from("meetings").select("*").eq("id", data.meetingId).single();
    if (error || !m) throw new Error("Reunión no encontrada");
    const ctx = m.account_id ? await accountContext(supabase, m.account_id) : "{}";
    const brief = await ask(
      "Eres un coach de ventas B2B senior. Responde en español neutro, en markdown conciso. Estructura: 1) Brief de cuenta (3-5 bullets) 2) Stakeholders: quién es quién y cómo abordarlo 3) Preguntas de discovery sugeridas (5-7) 4) Objeciones probables y respuesta 5) Huecos MEDDPICC a cerrar en esta reunión 6) Próximo paso a proponer.",
      `Reunión: ${JSON.stringify({ titulo: m.title, objetivo: m.objective, asistentes: m.attendees, agenda: m.agenda, resultado_deseado: m.desired_outcome })}\n\nContexto del equipo:\n${ctx}`,
    );
    await supabase.from("meetings").update({ ai_brief: brief }).eq("id", m.id);
    return { brief };
  });

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string }) => d)
  .handler(async ({ data, context }) => {
    const ctx = await accountContext(context.supabase, data.accountId);
    const text = await ask(
      "Eres un estratega comercial. Redacta en español neutro, markdown, un borrador de propuesta / business case: resumen ejecutivo, situación y dolores, solución propuesta, impacto y ROI estimado (indica supuestos), plan de implementación, próximos pasos. No inventes cifras sin marcarlas como supuesto.",
      ctx,
    );
    return { text };
  });

export const researchStakeholder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { stakeholderId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: s } = await supabase.from("stakeholders").select("*").eq("id", data.stakeholderId).single();
    if (!s) throw new Error("No encontrado");
    const ctx = await accountContext(supabase, s.account_id);
    const text = await ask(
      "Eres analista de research de ventas. En español neutro y markdown breve: hipótesis de prioridades de esta persona según su cargo, qué le importa, cómo encaja nuestra propuesta, riesgos, y 3 aperturas de conversación. Marca como hipótesis lo que no esté en el contexto.",
      `Persona: ${JSON.stringify({ nombre: s.name, cargo: s.title, rol: s.buying_role, apoyo: s.support, notas: s.priorities })}\n\nContexto:\n${ctx}`,
    );
    await supabase.from("stakeholders").update({ research: text }).eq("id", s.id);
    return { text };
  });

// ---------- Theory U ----------

const U_SYSTEM = "Eres facilitador experto en Theory U (Otto Scharmer, Presencing Institute) aplicada a go-to-market B2B. Respondes en español neutro (tú), markdown conciso y accionable. Distingues lo observado (datos) de las hipótesis.";

async function strategyContext(supabase: any) {
  const [pos, pillars, icp, segments] = await Promise.all([
    supabase.from("positioning").select("target_customer,need,category,key_benefit,competitive_alternative,differentiator,one_liner").limit(1).maybeSingle(),
    supabase.from("messaging_pillars").select("title,pain,message").order("position"),
    supabase.from("icp_profiles").select("name,industries,company_size,why_fit,anti_icp").limit(5),
    supabase.from("segments").select("name,acv,motion").limit(10),
  ]);
  return { posicionamiento: pos.data, pilares: pillars.data, icp: icp.data, segmentos: segments.data };
}

export const synthesizeJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { journeyId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: j } = await supabase.from("u_journeys").select("*").eq("id", data.journeyId).single();
    if (!j) throw new Error("Recorrido no encontrado");
    const [notes, exps, strat] = await Promise.all([
      supabase.from("sensing_notes").select("interviewee,kind,heard,surprised,emerging,listening_level").order("occurred_on", { ascending: false }).limit(40),
      supabase.from("gtm_experiments").select("title,hypothesis,status,result,learning").eq("journey_id", j.id),
      strategyContext(supabase),
    ]);
    const text = await ask(
      `${U_SYSTEM} Sintetiza el recorrido U del equipo. Estructura: 1) Lo que estamos viendo (patrones del sensing) 2) Lo que tenemos que soltar 3) Lo que quiere emerger 4) Cambios propuestos en ICP, posicionamiento y motions (concretos, comparando con la estrategia actual) 5) Tres prototipos para los próximos 30 días con hipótesis y métrica 6) Pregunta poderosa para la próxima sesión del equipo.`,
      JSON.stringify({ recorrido: { titulo: j.title, intencion: j.intention, fase_actual: j.phase, respuestas: j.answers }, sensing: notes.data, prototipos: exps.data, estrategia_actual: strat }),
    );
    await supabase.from("u_journeys").update({ ai_synthesis: text }).eq("id", j.id);
    return { text };
  });

export const sensingPatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { journeyId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("sensing_notes").select("interviewee,kind,occurred_on,context,heard,surprised,emerging,listening_level,accounts(name)").order("occurred_on", { ascending: false }).limit(60);
    if (data.journeyId) q = q.eq("journey_id", data.journeyId);
    const { data: notes } = await q;
    if (!notes || notes.length === 0) throw new Error("Añade al menos una nota de sensing");
    const strat = await strategyContext(supabase);
    const text = await ask(
      `${U_SYSTEM} Analiza las notas de sensing con clientes. Estructura: 1) Temas recurrentes (con nº de menciones) 2) Sorpresas que contradicen nuestros supuestos o posicionamiento actual 3) Señales débiles emergentes 4) Implicaciones para mensajes, ICP y producto 5) Calidad de la escucha del equipo (según los niveles registrados) y cómo profundizarla 6) A quién deberíamos escuchar a continuación.`,
      JSON.stringify({ notas: notes, estrategia_actual: strat }),
    );
    return { text };
  });

export const listeningCoaching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meetingId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: m } = await supabase.from("meetings").select("title,objective,attendees,questions,notes,next_steps,listening_level,listening_reflection,accounts(name)").eq("id", data.meetingId).single();
    if (!m) throw new Error("Reunión no encontrada");
    if (!m.notes && !m.listening_reflection) throw new Error("Escribe las notas o tu reflexión de la reunión primero");
    const text = await ask(
      `${U_SYSTEM} Eres coach de escucha para vendedores. Niveles: 1 Descarga (confirmo lo que ya sé), 2 Factual (noto lo nuevo), 3 Empática (veo con sus ojos), 4 Generativa (escucho lo que emerge). Estructura: 1) Nivel que reflejan las notas (con evidencias citadas) frente al nivel autoevaluado 2) Momentos donde se pudo escuchar más hondo 3) Qué hacer para subir un nivel en la próxima reunión (3 prácticas concretas) 4) Cinco preguntas abiertas para la próxima conversación con esta cuenta.`,
      JSON.stringify(m),
    );
    await supabase.from("meetings").update({ listening_coaching: text }).eq("id", data.meetingId);
    return { text };
  });

// ---------- GTM Advisor (Owner / Sales Leader) ----------

export const generateGtmAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { goal: string; horizon: string }) => {
    const goal = String(d?.goal ?? "").trim();
    if (goal.length < 10) throw new Error("Describe el objetivo o problema con algo más de detalle");
    if (goal.length > 4000) throw new Error("El objetivo es demasiado largo (máx. 4000 caracteres)");
    return { goal, horizon: HORIZONS[d.horizon] ? d.horizon : "quarter" };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("current_org_id").eq("id", userId).single();
    const orgId = profile?.current_org_id;
    if (!orgId) throw new Error("Selecciona una empresa");
    const { data: member } = await supabase.from("org_members").select("role, organizations(currency)").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
    if (!member || !canUseAdvisor([member.role])) throw new Error("Solo el Owner y el Sales Leader pueden usar el Asesor GTM");

    const [deals, segments, history, quotas, strat] = await Promise.all([
      supabase.from("deals").select("id,name,stage,amount,probability,health,close_date,closed_at,updated_at,source,segment_id,slip_count,forecast_category,meddpicc,partner_id"),
      supabase.from("segments").select("id,name,acv_min,acv_max,motion,cycle_days,sdr_per_ae,ae_per_se,cac_target,payback_months,win_rate_target,ae_quota,gross_margin_pct").order("acv_min"),
      supabase.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at"),
      supabase.from("quotas").select("period,amount"),
      strategyContext(supabase),
    ]);
    const snapshot = buildSnapshot({
      deals: (deals.data ?? []) as any,
      segments: (segments.data ?? []) as any,
      history: history.data ?? [],
      quotas: (quotas.data ?? []) as any,
      currency: (member as any).organizations?.currency ?? "EUR",
    });

    const raw = await ask(
      "Eres un VP de Revenue / RevOps senior que asesora a la dirección comercial de empresas B2B. Analizas el objetivo o problema que te plantean usando SOLO los datos aportados (pipeline, métricas, segmentos con sus benchmarks, posicionamiento e ICP) y das recomendaciones de go-to-market priorizadas. Reglas: español neutro (tú); cada hallazgo y recomendación cita cifras concretas del contexto; compara lo real con los benchmarks de cada segmento; marca como supuesto lo que no esté en los datos; usa la moneda indicada; prioriza por impacto en el objetivo y rapidez (priority 1 = lo primero que harías); entre 4 y 7 recomendaciones, cada una con 2–4 acciones concretas, un KPI y un objetivo medible; asigna el rol responsable más adecuado; si faltan datos clave, dilo en data_gaps en lugar de inventar. Referencias generales: cobertura sana 3–4x de la cuota trimestral; forecast preciso si el real queda a ±10% del commit; ABM para ACV >100K.",
      JSON.stringify({ objetivo: data.goal, horizonte: HORIZONS[data.horizon], datos: snapshot, estrategia: strat }),
      { effort: "medium", schema: { name: "gtm_advice", schema: ADVISOR_SCHEMA } },
    );
    let result: AdvisorResult;
    try { result = JSON.parse(raw); } catch {
      console.error("Advisor: invalid JSON", raw.slice(0, 300));
      throw new Error("La IA no devolvió recomendaciones válidas. Inténtalo de nuevo.");
    }
    if (!Array.isArray(result?.recommendations) || result.recommendations.length === 0) throw new Error("La IA no devolvió recomendaciones. Inténtalo de nuevo.");

    const { data: row, error } = await supabase.from("gtm_advisories").insert({ goal: data.goal, horizon: data.horizon, result: result as any }).select("id, created_at").single();
    if (error) console.error("Advisor: save failed", error.message);
    return { id: row?.id ?? null, created_at: row?.created_at ?? new Date().toISOString(), result };
  });
