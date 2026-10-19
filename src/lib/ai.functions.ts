import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ask(system: string, user: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "",
      "X-Lovable-AIG-SDK": "fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: system,
      input: [{ role: "user", content: user }],
      reasoning: { effort: "low" },
      store: false,
      stream: true,
    }),
  });
  if (res.status === 429) throw new Error("Demasiadas peticiones, inténtalo en un momento.");
  if (res.status === 402) throw new Error("Sin créditos de IA disponibles.");
  if (!res.ok || !res.body) throw new Error("La IA no respondió");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
      } catch { /* ignore partial */ }
    }
  }
  return out;
}

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
