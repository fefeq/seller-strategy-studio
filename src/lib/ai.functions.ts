import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ask(system: string, user: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (res.status === 429) throw new Error("Demasiadas peticiones, inténtalo en un momento.");
  if (res.status === 402) throw new Error("Sin créditos de IA disponibles.");
  if (!res.ok) throw new Error("La IA no respondió");
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  return j.choices[0]?.message.content ?? "";
}

async function accountContext(supabase: any, accountId: string) {
  const [acc, plan, sh, calls, deals, docs] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", accountId).maybeSingle(),
    supabase.from("account_plans").select("*").eq("account_id", accountId).maybeSingle(),
    supabase.from("stakeholders").select("name,title,buying_role,support,priorities,research").eq("account_id", accountId),
    supabase.from("calls").select("title,occurred_at,summary,next_steps").eq("account_id", accountId).order("occurred_at", { ascending: false }).limit(5),
    supabase.from("deals").select("name,stage,amount,meddpicc").eq("account_id", accountId),
    supabase.from("knowledge_docs").select("section,title,body").in("section", ["company", "objections", "playbooks", "methodology"]).limit(20),
  ]);
  return JSON.stringify({ cuenta: acc.data, account_plan: plan.data, stakeholders: sh.data, llamadas: calls.data, deals: deals.data, conocimiento_empresa: docs.data });
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
