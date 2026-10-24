import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ask } from "@/lib/ai-gateway";
import { accountContext, callTeardownCore, meetingBriefCore, listeningCoachingCore, proposalCore, researchStakeholderCore, U_SYSTEM } from "@/lib/ai-core";
import { ADVISOR_SCHEMA, buildSnapshot, canUseAdvisor, HORIZONS, type AdvisorResult } from "@/lib/advisor";
import type { Stage } from "@/lib/stages";

export const generateMeetingBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meetingId: string }) => d)
  .handler(async ({ data, context }) => {
    const { brief } = await meetingBriefCore(context.supabase, data.meetingId);
    return { brief };
  });

/** AI teardown of a call, saved on the meeting (src/lib/ai-core.ts). */
export const callTeardown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meetingId: string }) => ({ meetingId: String(d?.meetingId ?? "") }))
  .handler(async ({ data, context }) => ({ text: (await callTeardownCore(context.supabase, data.meetingId)).text }));

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string }) => d)
  .handler(async ({ data, context }) => proposalCore(context.supabase, data.accountId));

export const researchStakeholder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { stakeholderId: string }) => d)
  .handler(async ({ data, context }) => ({ text: (await researchStakeholderCore(context.supabase, data.stakeholderId)).text }));

// ---------- ICP ----------

/** «Afinar con IA»: turns the prose of an ICP into the structured fields every search uses. Proposes; the user saves. */
export const structureIcp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { icp: Record<string, unknown>; note?: string }) => ({ icp: d.icp ?? {}, note: String(d.note ?? "").slice(0, 4000) }))
  .handler(async ({ data }) => {
    const { icpBrief, ICP_STRUCTURE_SCHEMA, parseIcpStructure } = await import("@/lib/icp");
    const raw = await ask(
      "Eres experto en prospección B2B. Conviertes un perfil de cliente ideal (ICP) en criterios para bases de datos de empresas y personas (Apollo, Clay, LinkedIn Sales Navigator). search_keywords: hasta 6 palabras clave cortas en inglés del tipo de empresa o sector, como aparecen en LinkedIn. countries: códigos ISO de 2 letras. min_employees y max_employees: rango de empleados si se deduce, si no null. target_titles: hasta 8 cargos en inglés de quien decide o usa el producto. seniorities: niveles entre founder, c_suite, vp, head, director, manager. pains: los dolores principales que resolvemos, en español, en 1-3 frases. No inventes lo que no se deduce: deja arrays vacíos o null.",
      `${icpBrief(data.icp as never)}${data.note ? `\n\nNotas del usuario: ${data.note}` : ""}`,
      { effort: "low", schema: { name: "icp", schema: ICP_STRUCTURE_SCHEMA as never } },
    );
    return parseIcpStructure(raw);
  });

// ---------- Theory U ----------

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
  .handler(async ({ data, context }) => ({ text: (await listeningCoachingCore(context.supabase, data.meetingId)).text }));

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

    const [deals, segments, history, quotas, strat, stages] = await Promise.all([
      supabase.from("deals").select("id,name,stage,amount,probability,health,close_date,closed_at,updated_at,source,segment_id,slip_count,forecast_category,meddpicc,partner_id"),
      supabase.from("segments").select("id,name,acv_min,acv_max,motion,cycle_days,sdr_per_ae,ae_per_se,cac_target,payback_months,win_rate_target,ae_quota,gross_margin_pct,notes").order("acv_min"),
      supabase.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at"),
      supabase.from("quotas").select("period,amount"),
      strategyContext(supabase),
      supabase.from("deal_stages").select("key,label,position,kind,board_group,probability").eq("org_id", orgId),
    ]);
    const snapshot = buildSnapshot({
      stages: (stages.data ?? []) as Stage[],
      deals: (deals.data ?? []) as any,
      segments: (segments.data ?? []) as any,
      history: history.data ?? [],
      quotas: (quotas.data ?? []) as any,
      currency: (member as any).organizations?.currency ?? "EUR",
    });

    const raw = await ask(
      "Eres un VP de Revenue / RevOps senior que asesora a la dirección comercial de empresas B2B. Analizas el objetivo o problema que te plantean usando SOLO los datos aportados (pipeline, métricas, segmentos con sus benchmarks, posicionamiento e ICP) y das recomendaciones de go-to-market priorizadas. Reglas: español neutro (tú), sin signos de exclamación ni emoji; cada hallazgo y recomendación cita cifras concretas del contexto; compara lo real con los benchmarks de cada segmento; marca como supuesto lo que no esté en los datos; usa la moneda indicada; prioriza por impacto en el objetivo y rapidez (priority 1 = lo primero que harías); entre 4 y 7 recomendaciones, cada una con 2–4 acciones concretas, un KPI y un objetivo medible; asigna el rol responsable más adecuado; si faltan datos clave, dilo en data_gaps en lugar de inventar. Referencias generales: cobertura sana 3–4x de la cuota trimestral; forecast preciso si el real queda a ±10% del commit; ABM para ACV >100K.",
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
