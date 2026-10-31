// Strategy: list_segments (read) and the writes for positioning, segments, ICP, pillars, currency, quotas. Part of the single registry in ../tools.ts (order there is the order the model sees).
import { z } from "zod";
import { def, mustBeMember, ok } from "../tool-kit";
import { POSITIONING_FIELDS } from "@/lib/setup-schema";
import { quarterOf } from "@/lib/metrics";
import { loadFunnelDiagnosis } from "@/lib/funnel-diagnosis-data";
import { ACQUISITION_MOTIONS } from "@/lib/acquisition-motion";
import { normalizeIcpFields } from "@/lib/field-normalize";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { AgentTool } from "../tool-kit";

export const STRATEGY_TOOLS: AgentTool[] = [
  def({
    name: "update_positioning",
    kind: "write",
    roles: ["owner", "sales_leader", "marketing"],
    description: `Guarda campos de posicionamiento. Campos: ${POSITIONING_FIELDS.map(([k]) => k).join(", ")}, tagline, short_pitch, product_name.`,
    input: z.object({ fields: z.record(z.string(), z.string()) }),
    summarize: (a) => `Guardar posicionamiento: ${Object.keys(a.fields).join(", ")}`,
    run: async (c, a) => {
      const allowed = new Set<string>([
        ...POSITIONING_FIELDS.map(([k]) => k),
        "tagline",
        "short_pitch",
        "product_name",
      ]);
      const patch: TablesUpdate<"positioning"> = Object.fromEntries(
        Object.entries(a.fields).filter(([k]) => allowed.has(k)),
      );
      const { data: ex } = await c.db
        .from("positioning")
        .select("id")
        .eq("org_id", c.orgId)
        .maybeSingle();
      if (ex)
        return ok(
          await c.db.from("positioning").update(patch).eq("id", ex.id).select("id").single(),
        );
      return ok(
        await c.db
          .from("positioning")
          .insert({ ...patch, org_id: c.orgId })
          .select("id")
          .single(),
      );
    },
  }),
  def({
    name: "list_segments",
    kind: "read",
    description:
      "Lista los segmentos de la empresa por prioridad, con su motion (modelo de venta por ACV), su acquisition_motion (cómo adquiere clientes; null = sin definir) y sus objetivos.",
    input: z.object({}),
    run: async (c) =>
      ok(
        await c.db
          .from("segments")
          .select(
            "id,name,priority,acv_min,acv_max,motion,acquisition_motion,cycle_days,win_rate_target,cac_target,payback_months,gross_margin_pct,ae_quota",
          )
          .eq("org_id", c.orgId)
          .order("priority", { ascending: true, nullsFirst: false })
          .order("acv_min"),
      ),
  }),
  def({
    name: "get_funnel_diagnosis",
    kind: "read",
    description:
      "Diagnóstico AARRR por segmento y trimestre (por defecto el actual): Acquisition (leads), Activation (pruebas activadas con el evento de PostHog de la empresa), Retention (churn de Stripe, solo de la empresa), Revenue (según el motion de adquisición del segmento) y Referral (no medido). Cada fase trae valor, denominador y fuente; sin datos dice «sin datos» y qué falta, nunca 0. «fuga» solo aparece si el segmento tiene objetivo (win rate o payback). Solo lee la base de datos.",
    input: z.object({
      quarter: z
        .string()
        .regex(/^\d{4}-Q[1-4]$/)
        .optional()
        .describe("Trimestre AAAA-QN; por defecto el actual"),
    }),
    run: async (c, a) =>
      ok({
        data: await loadFunnelDiagnosis(c.db, c.orgId, a.quarter ?? quarterOf(new Date())),
        error: null,
      }),
  }),
  def({
    name: "upsert_segment",
    kind: "write",
    roles: ["owner", "sales_leader"],
    description:
      "Crea o actualiza (si se pasa segment_id) un segmento con rango de ACV, motion (modelo de venta por ACV), acquisition_motion (cómo adquiere clientes: plg, slg, marketing o partner; null = sin definir), win rate objetivo (%), cuota anual AE, prioridad (1 = el primero) y una nota. El nombre es solo el nombre: la prioridad y las notas van en sus campos.",
    input: z.object({
      segment_id: z.string().uuid().optional(),
      name: z.string().min(1),
      acv_min: z.number().optional(),
      acv_max: z.number().optional(),
      motion: z.enum(["plg", "inside", "field", "strategic"]).optional(),
      acquisition_motion: z.enum(ACQUISITION_MOTIONS).nullable().optional(),
      win_rate_target: z.number().min(0).max(100).optional(),
      ae_quota: z.number().min(0).optional(),
      gross_margin_pct: z.number().min(0).max(100).optional(),
      priority: z.number().int().min(1).optional(),
      notes: z.string().optional(),
    }),
    summarize: (a) => `${a.segment_id ? "Actualizar" : "Crear"} el segmento «${a.name}»`,
    run: async (c, a) => {
      const { segment_id, ...rest } = a;
      if (segment_id)
        return ok(
          await c.db
            .from("segments")
            .update(rest)
            .eq("org_id", c.orgId)
            .eq("id", segment_id)
            .select("id")
            .single(),
        );
      return ok(
        await c.db
          .from("segments")
          .insert({ ...rest, motion: rest.motion ?? "inside", org_id: c.orgId })
          .select("id")
          .single(),
      );
    },
  }),
  def({
    name: "create_icp",
    kind: "write",
    roles: ["owner", "sales_leader", "marketing"],
    description: "Crea un perfil ICP.",
    input: z.object({
      name: z.string().min(1),
      industries: z.string().optional(),
      company_size: z.string().optional(),
      geography: z.string().optional(),
      why_fit: z.string().optional(),
      anti_icp: z.string().optional(),
      hiring_signals: z.string().optional(),
      tech_stack: z.string().optional(),
      pains: z.string().optional(),
      min_employees: z.number().int().positive().optional(),
      max_employees: z.number().int().positive().optional(),
      countries: z.array(z.string().length(2)).optional().describe("ISO de 2 letras"),
      search_keywords: z
        .array(z.string())
        .optional()
        .describe("palabras clave en inglés para bases de empresas"),
      target_titles: z.array(z.string()).optional().describe("cargos a contactar, en inglés"),
      seniorities: z
        .array(z.enum(["founder", "c_suite", "vp", "head", "director", "manager"]))
        .optional(),
    }),
    summarize: (a) => `Crear el ICP «${a.name}»`,
    run: async (c, a) => {
      const { row, invalid } = normalizeIcpFields(a);
      if (invalid.length) throw new Error(invalid.join(" "));
      return ok(
        await c.db
          .from("icp_profiles")
          .insert({ ...row, org_id: c.orgId })
          .select("id")
          .single(),
      );
    },
  }),
  def({
    name: "create_pillar",
    kind: "write",
    roles: ["owner", "sales_leader", "marketing"],
    description: "Crea un pilar de mensaje (título, dolor, mensaje, prueba).",
    input: z.object({
      title: z.string().min(1),
      pain: z.string().optional(),
      message: z.string().optional(),
      proof: z.string().optional(),
    }),
    summarize: (a) => `Crear el pilar de mensaje «${a.title}»`,
    run: async (c, a) => {
      const { count } = await c.db
        .from("messaging_pillars")
        .select("id", { count: "exact", head: true })
        .eq("org_id", c.orgId);
      return ok(
        await c.db
          .from("messaging_pillars")
          .insert({ ...a, position: count ?? 0, org_id: c.orgId })
          .select("id")
          .single(),
      );
    },
  }),
  def({
    name: "set_currency",
    kind: "write",
    roles: ["owner"],
    description:
      "Cambia la moneda de la empresa (código ISO de 3 letras, p. ej. EUR, USD). Solo reetiqueta importes, no convierte.",
    input: z.object({ currency: z.string().regex(/^[A-Z]{3}$/) }),
    summarize: (a) => `Cambiar la moneda de la empresa a ${a.currency}`,
    run: async (c, a) =>
      ok(
        await c.db
          .from("organizations")
          .update({ currency: a.currency })
          .eq("id", c.orgId)
          .select("id")
          .single(),
      ),
  }),
  def({
    name: "set_quota",
    kind: "write",
    roles: ["owner", "sales_leader"],
    description: "Fija la cuota de un usuario para un trimestre (AAAA-QN). Sin user_id = la mía.",
    input: z.object({
      amount: z.number().positive(),
      period: z
        .string()
        .regex(/^\d{4}-Q[1-4]$/)
        .optional(),
      user_id: z.string().uuid().optional(),
    }),
    summarize: (a) => `Fijar cuota de ${a.amount} para ${a.period ?? quarterOf(new Date())}`,
    run: async (c, a) => {
      if (a.user_id) await mustBeMember(c, a.user_id);
      return ok(
        await c.db
          .from("quotas")
          .upsert(
            {
              org_id: c.orgId,
              user_id: a.user_id ?? c.userId,
              period: a.period ?? quarterOf(new Date()),
              amount: a.amount,
            },
            { onConflict: "org_id,user_id,period" },
          )
          .select("id")
          .single(),
      );
    },
  }),
  // ---------- CICLO GTM (BMAD) ----------
];
