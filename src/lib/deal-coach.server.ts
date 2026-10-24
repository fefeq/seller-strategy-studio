// Deal Coach (ported from the Postin CRM edge function): reads a deal with its account, MEDDPICC, stakeholders,
// lines, mutual plan and latest activity, and returns a summary, risks and 3–5 next steps. The steps become
// suggestions (so they land in the Sugerencias deck with a «Crear tarea» action) and the summary is written to
// the deal timeline as a note. Runs in the background job runner with the admin client, always org-filtered.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ask } from "@/lib/ai-gateway";
import { buildTimeline } from "@/lib/crm";

type Admin = SupabaseClient<Database>;
export type CoachResult = { summary: string; risks: string[]; steps: { title: string; why: string; due_in_days: number }[] };

const SYSTEM = "Eres un coach de ventas B2B experto. Con los datos de una oportunidad devuelves: summary (3-5 frases: quién, qué, valor, etapa y contexto clave), risks (máximo 4, concretos) y steps (3-5 acciones concretas con title imperativo y corto, why en una frase y due_in_days en cuántos días hacerla). Basado en los datos; si falta algo importante (decisor, criterios, proceso de compra, fecha), dilo como riesgo y propón la acción para conseguirlo. Español neutro (tú), sin signos de exclamación ni emoji.";
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "risks", "steps"],
  properties: {
    summary: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "why", "due_in_days"], properties: { title: { type: "string" }, why: { type: "string" }, due_in_days: { type: "number" } } } },
  },
};

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").slice(0, 60);

export async function dealCoachCore(db: Admin, orgId: string, userId: string, dealId: string, step: (s: string) => Promise<void>) {
  const { data: deal } = await db.from("deals").select("*").eq("org_id", orgId).eq("id", dealId).maybeSingle();
  if (!deal) throw new Error("No encuentro ese deal en esta empresa.");
  await step("Leyendo el deal y su historia");
  const [acc, sh, lines, map, acts, calls, meetings, stages] = await Promise.all([
    deal.account_id ? db.from("accounts").select("name,industry,size,domain,notes").eq("org_id", orgId).eq("id", deal.account_id).maybeSingle() : Promise.resolve({ data: null }),
    deal.account_id ? db.from("stakeholders").select("name,title,buying_role,support,priorities").eq("org_id", orgId).eq("account_id", deal.account_id).limit(15) : Promise.resolve({ data: [] }),
    db.from("deal_lines").select("name,quantity,unit_price,billing,discount_pct").eq("org_id", orgId).eq("deal_id", dealId),
    db.from("mutual_action_items").select("title,due_date,done,owner_side").eq("org_id", orgId).eq("deal_id", dealId),
    db.from("activities").select("id,kind,subject,body,occurred_at").eq("org_id", orgId).eq("deal_id", dealId).order("occurred_at", { ascending: false }).limit(15),
    db.from("calls").select("id,title,occurred_at,summary,created_at").eq("org_id", orgId).eq("deal_id", dealId).limit(10),
    db.from("meetings").select("id,title,scheduled_at,notes,created_at").eq("org_id", orgId).eq("deal_id", dealId).limit(10),
    db.from("deal_stage_history").select("deal_id,from_stage,to_stage,changed_at").eq("deal_id", dealId),
  ]);
  const timeline = buildTimeline({ activities: acts.data ?? [], calls: calls.data ?? [], meetings: meetings.data ?? [], stages: stages.data ?? [] }).slice(0, 20);
  await step("Pensando riesgos y siguientes pasos");
  const raw = await ask(SYSTEM, JSON.stringify({
    deal: { nombre: deal.name, etapa: deal.stage, importe_anual: deal.amount, pago_unico: deal.one_off_amount, cierre: deal.close_date, probabilidad: deal.probability, salud: deal.health, forecast: deal.forecast_category, retrasos: deal.slip_count, meddpicc: deal.meddpicc },
    cuenta: acc.data, stakeholders: sh.data ?? [], lineas: lines.data ?? [], plan_conjunto: map.data ?? [],
    historia: timeline.map((t) => ({ fecha: t.at.slice(0, 10), tipo: t.kind, titulo: t.title, detalle: t.body?.slice(0, 400) ?? null })),
  }), { effort: "low", schema: { name: "deal_coach", schema: SCHEMA } });
  let r: CoachResult;
  try { r = JSON.parse(raw) as CoachResult; } catch { throw new Error("La IA no devolvió una respuesta válida. Inténtalo de nuevo."); }
  r.steps = (r.steps ?? []).slice(0, 5);
  r.risks = (r.risks ?? []).slice(0, 4);

  await step("Guardando en Sugerencias y en la historia del deal");
  const owner = deal.owner_id ?? userId;
  const day = 86_400_000;
  for (const s of r.steps) {
    const due = new Date(Date.now() + Math.max(0, Math.round(s.due_in_days || 2)) * day).toISOString().slice(0, 10);
    await db.from("suggestions").upsert({
      org_id: orgId, user_id: owner, detector: "deal_coach", dedupe_key: `deal_coach:${dealId}:${slug(s.title)}`, priority: 2,
      title: `${deal.name}: ${s.title}`.slice(0, 200), body: s.why.slice(0, 2000), link: `/deals?deal=${dealId}`,
      action: { tool: "create_task", args: { title: s.title.slice(0, 200), due_date: due, deal_id: dealId, ...(deal.account_id ? { account_id: deal.account_id } : {}), owner_id: owner } },
    }, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
  }
  const body = [r.summary, r.risks.length ? `Riesgos:\n${r.risks.map((x) => `· ${x}`).join("\n")}` : "", r.steps.length ? `Siguientes pasos (en Sugerencias):\n${r.steps.map((x, i) => `${i + 1}. ${x.title}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  await db.from("activities").insert({ org_id: orgId, kind: "note", subject: "Deal Coach", body, deal_id: dealId, account_id: deal.account_id, created_by: userId });
  return { deal, result: r };
}
