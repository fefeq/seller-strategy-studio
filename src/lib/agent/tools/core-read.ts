// Core reads: overview, search, records, lists, setup status, follow-up drafts, knowledge. Part of the single registry in ../tools.ts (order there is the order the model sees).
import { z } from "zod";
import { loadSetupData, loadSetupSnoozes } from "@/lib/org-data";
import { STAGE_ARG, def, like, ok, one, orgStages, resolveStage } from "../tool-kit";
import { setupStatus } from "@/lib/setup-schema";
import { canCompleteStep, formatDay, guideState, nextMessage } from "@/lib/setup-guide";
import { buildSnapshot } from "@/lib/advisor";
import { cohort, funnelBySegment, funnelStats } from "@/lib/self-service";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { productMarginPct, type Product } from "@/lib/deal-lines";
import {
  delayText,
  leadCohort,
  leadDelay,
  leadFunnel,
  leadStageLabel,
  readSla,
} from "@/lib/lead-funnel";
import { byScore, fitText, scoreLead } from "@/lib/scoring";
import { readStaleDays, staleDeals, thresholdText } from "@/lib/stale";
import { FOLLOWUP_STEPS, followupDraft, followupStatus } from "@/lib/followup";
import { ask } from "@/lib/ai-gateway";
import {
  loadAgentRules,
  rulesBlock,
  RULES_READ_FAILED,
  VOICE_SECTION,
} from "@/lib/knowledge-rules";
import { loadVoice, VOICE_FORM_RULE, VOICE_READ_FAILED } from "@/lib/knowledge-voice";
import { LEAD_STAGE_IDS } from "../tool-kit";
import type { AgentTool } from "../tool-kit";

export const CORE_READ_TOOLS: AgentTool[] = [
  def({
    name: "get_overview",
    kind: "read",
    description:
      "Resumen del negocio: pipeline abierto, forecast, cobertura del trimestre, win rate, deals en riesgo y funnel self-service del trimestre.",
    input: z.object({}),
    run: async (c) => {
      const [deals, segs, hist, quotas, trials, stages] = await Promise.all([
        c.db
          .from("deals")
          .select(
            "id,name,stage,amount,probability,health,close_date,closed_at,updated_at,source,segment_id,slip_count,forecast_category,meddpicc,partner_id",
          )
          .eq("org_id", c.orgId),
        c.db
          .from("segments")
          .select(
            "id,name,acv_min,acv_max,motion,cycle_days,sdr_per_ae,ae_per_se,cac_target,payback_months,win_rate_target,ae_quota,gross_margin_pct",
          )
          .eq("org_id", c.orgId),
        c.db
          .from("deal_stage_history")
          .select("deal_id,from_stage,to_stage,changed_at")
          .eq("org_id", c.orgId),
        c.db.from("quotas").select("period,amount").eq("org_id", c.orgId),
        c.db
          .from("trials")
          .select("segment_id,signed_up_at,activated_at,converted_at,mrr")
          .eq("org_id", c.orgId),
        orgStages(c),
      ]);
      const { start, end } = quarterRange(quarterOf(new Date()));
      const co = cohort(trials.data ?? [], start, end);
      return {
        moneda: c.currency,
        pipeline: buildSnapshot({
          deals: deals.data ?? [],
          segments: segs.data ?? [],
          history: hist.data ?? [],
          quotas: quotas.data ?? [],
          currency: c.currency,
          stages,
        }),
        self_service_trimestre: { total: funnelStats(co), por_segmento: funnelBySegment(co) },
      };
    },
  }),
  def({
    name: "search",
    kind: "read",
    description:
      "Busca por texto en cuentas, deals, stakeholders y personas. Devuelve ids para usar en otras herramientas.",
    input: z.object({ query: z.string().min(1) }),
    run: async (c, a) => {
      const q = like(a.query);
      const [acc, deals, sh, people] = await Promise.all([
        c.db
          .from("accounts")
          .select("id,name,domain,health,tier")
          .eq("org_id", c.orgId)
          .or(`name.ilike.${q},domain.ilike.${q}`)
          .limit(8),
        c.db
          .from("deals")
          .select("id,name,stage,amount,close_date,account_id")
          .eq("org_id", c.orgId)
          .ilike("name", q)
          .limit(8),
        c.db
          .from("stakeholders")
          .select("id,name,title,buying_role,account_id")
          .eq("org_id", c.orgId)
          .or(`name.ilike.${q},title.ilike.${q}`)
          .limit(8),
        c.db
          .from("people")
          .select("id,full_name,company,title,email")
          .eq("org_id", c.orgId)
          .or(`full_name.ilike.${q},company.ilike.${q},email.ilike.${q}`)
          .limit(8),
      ]);
      return { cuentas: acc.data, deals: deals.data, stakeholders: sh.data, personas: people.data };
    },
  }),
  def({
    name: "get_account",
    kind: "read",
    description:
      "Detalle de una cuenta: plan de cuenta, stakeholders, deals, reuniones y tareas abiertas.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const [acc, plan, sh, deals, meet, tasks] = await Promise.all([
        c.db
          .from("accounts")
          .select("*")
          .eq("org_id", c.orgId)
          .eq("id", a.account_id)
          .maybeSingle(),
        c.db
          .from("account_plans")
          .select("*")
          .eq("org_id", c.orgId)
          .eq("account_id", a.account_id)
          .maybeSingle(),
        c.db
          .from("stakeholders")
          .select("id,name,title,buying_role,support,priorities")
          .eq("org_id", c.orgId)
          .eq("account_id", a.account_id),
        c.db
          .from("deals")
          .select("id,name,stage,amount,close_date,health,meddpicc")
          .eq("org_id", c.orgId)
          .eq("account_id", a.account_id),
        c.db
          .from("meetings")
          .select("id,title,scheduled_at,objective,next_steps")
          .eq("org_id", c.orgId)
          .eq("account_id", a.account_id)
          .order("scheduled_at", { ascending: false })
          .limit(5),
        c.db
          .from("tasks")
          .select("id,title,due_date")
          .eq("org_id", c.orgId)
          .eq("account_id", a.account_id)
          .eq("done", false),
      ]);
      if (!acc.data) return { error: "Cuenta no encontrada" };
      return {
        cuenta: acc.data,
        account_plan: plan.data,
        stakeholders: sh.data,
        deals: deals.data,
        reuniones: meet.data,
        tareas: tasks.data,
      };
    },
  }),
  def({
    name: "get_stripe_metrics",
    kind: "read",
    description:
      "Ingresos reales leídos de Stripe (si la empresa lo ha conectado): MRR, ARR, clientes de pago, en prueba, altas y bajas de los últimos 30 días y churn de clientes y de MRR, con la fecha de la lectura.",
    input: z.object({}),
    run: async (c) => {
      const [conn, snap] = await Promise.all([
        c.db
          .from("stripe_connections")
          .select("status,last_error,last_synced_at,livemode")
          .eq("org_id", c.orgId)
          .maybeSingle(),
        c.db
          .from("stripe_snapshots")
          .select("*")
          .eq("org_id", c.orgId)
          .order("taken_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!conn.data && !snap.data)
        return {
          conectado: false,
          nota: "Stripe no está conectado, o tu rol no ve los ingresos (solo Owner, Sales Leader y Deal Desk). El Owner puede conectarlo en Conexiones.",
        };
      const x = snap.data;
      return {
        conectado: !!conn.data,
        ...(conn.data
          ? {}
          : { nota: "Stripe está desconectado: es la última lectura y ya no se actualiza." }),
        estado: conn.data?.status ?? null,
        error: conn.data?.last_error ?? null,
        datos_de_prueba: conn.data ? !conn.data.livemode : null,
        lectura: x
          ? {
              fecha: x.taken_at,
              moneda: x.currency,
              mrr: Number(x.mrr),
              arr: Number(x.mrr) * 12,
              clientes_de_pago: x.active_customers,
              en_prueba: x.trialing,
              ventana_dias: x.window_days,
              altas: x.new_customers,
              mrr_nuevo: Number(x.new_mrr),
              bajas: x.churned_customers,
              mrr_perdido: Number(x.churned_mrr),
              churn_clientes_pct: x.logo_churn_pct,
              churn_mrr_pct: x.revenue_churn_pct,
              detalles: x.details,
            }
          : null,
      };
    },
  }),
  def({
    name: "list_products",
    kind: "read",
    description:
      "Catálogo de productos de la empresa: id, nombre, precio y coste por periodo, cobro (monthly/annual/one_off) y margen %. Úsalo para crear deals con producto.",
    input: z.object({ include_inactive: z.boolean().optional() }),
    run: async (c, a) => {
      const rows = ok(
        await c.db
          .from("products")
          .select("id,name,price,cost,billing,active")
          .eq("org_id", c.orgId)
          .order("name"),
      ) as Product[];
      return rows
        .filter((p) => a.include_inactive || p.active)
        .map((p) => ({
          id: p.id,
          nombre: p.name,
          precio: Number(p.price),
          coste: p.cost == null ? null : Number(p.cost),
          cobro: p.billing,
          margen_pct: productMarginPct(p) == null ? null : Math.round(productMarginPct(p)!),
          a_la_venta: p.active,
        }));
    },
  }),
  def({
    name: "list_stages",
    kind: "read",
    description:
      "Etapas del pipeline de la empresa en orden: clave, nombre, tipo (open/won/lost) y probabilidad. Úsalas al crear o mover deals.",
    input: z.object({}),
    run: async (c) =>
      (await orgStages(c)).map((s) => ({
        clave: s.key,
        nombre: s.label,
        tipo: s.kind,
        probabilidad: s.probability,
      })),
  }),
  def({
    name: "list_deals",
    kind: "read",
    description:
      "Lista deals con filtros opcionales: etapa, solo míos, solo en riesgo (salud roja), con fecha de cierre pasada o enfriados (sin actividad más días que el umbral de su segmento: un cuarto del ciclo real, 14–60 días, o el número fijado por la empresa). Cada deal trae dias_sin_actividad, umbral_enfriado y enfriado.",
    input: z.object({
      stage: STAGE_ARG.optional(),
      mine: z.boolean().optional(),
      at_risk: z.boolean().optional(),
      overdue: z.boolean().optional(),
      cold: z.boolean().optional(),
    }),
    run: async (c, a) => {
      const stageKey = a.stage ? (await resolveStage(c, a.stage)).key : null;
      const [all, seg, cfg] = await Promise.all([
        c.db
          .from("deals")
          .select(
            "id,name,stage,amount,probability,health,close_date,closed_at,created_at,updated_at,segment_id,owner_id,account_id,forecast_category",
          )
          .eq("org_id", c.orgId)
          .order("close_date"),
        c.db
          .from("segments")
          .select(
            "id,name,acv_min,acv_max,win_rate_target,cac_target,gross_margin_pct,payback_months",
          )
          .eq("org_id", c.orgId),
        c.db.from("lead_settings").select("sla").eq("org_id", c.orgId).maybeSingle(),
      ]);
      if (all.error) throw new Error(all.error.message);
      const now = new Date();
      const cold = new Map(
        staleDeals(all.data ?? [], seg.data ?? [], readStaleDays(cfg.data?.sla), now).map((r) => [
          r.deal.id,
          r,
        ]),
      );
      const today = now.toISOString().slice(0, 10);
      const list = (all.data ?? [])
        .filter((d) => (stageKey ? d.stage === stageKey : d.stage !== "won" && d.stage !== "lost"))
        .filter(
          (d) =>
            (!a.mine || d.owner_id === c.userId) &&
            (!a.at_risk || d.health === "red") &&
            (!a.overdue || (!!d.close_date && d.close_date < today)) &&
            (!a.cold || !!cold.get(d.id)?.stale),
        )
        .slice(0, 40)
        .map(({ closed_at: _c, created_at: _cr, updated_at: _u, segment_id: _s, ...d }) => {
          const r = cold.get(d.id);
          return {
            ...d,
            dias_sin_actividad: r?.idleDays ?? null,
            umbral_enfriado: r ? thresholdText(r.threshold) : null,
            enfriado: r?.stale ?? false,
          };
        });
      return list;
    },
  }),
  def({
    name: "list_leads",
    kind: "read",
    description:
      "Leads antes de ser oportunidad (Nuevo, Contactado, MQL, SQL, Oportunidad, Descartado), ordenados por puntuación (encaje con el ICP 70 % + actividad 30 %): filtra por etapa o solo los retrasados (más días en la etapa de lo permitido o seguimiento vencido). Incluye el embudo del trimestre.",
    input: z.object({
      stage: z.enum(LEAD_STAGE_IDS).optional(),
      late_only: z.boolean().optional(),
    }),
    run: async (c, a) => {
      const [l, d, s, icp, acc, seg] = await Promise.all([
        c.db
          .from("leads")
          .select(
            "id,company,contact_name,email,stage,source,stage_entered_at,updated_at,next_step,next_step_at,created_at,contacted_at,mql_at,sql_at,opportunity_at,deal_id,owner_id,segment_id,account_id",
          )
          .eq("org_id", c.orgId)
          .order("created_at", { ascending: false })
          .limit(1000),
        c.db.from("deals").select("id,stage,closed_at").eq("org_id", c.orgId),
        c.db.from("lead_settings").select("sla").eq("org_id", c.orgId).maybeSingle(),
        c.db
          .from("icp_profiles")
          .select(
            "id,segment_id,industries,company_size,geography,anti_icp,min_employees,max_employees,search_keywords",
          )
          .eq("org_id", c.orgId),
        c.db.from("accounts").select("id,segment_id,industry,size,tier,name").eq("org_id", c.orgId),
        c.db.from("segments").select("id,name").eq("org_id", c.orgId),
      ]);
      const sla = readSla(s.data?.sla);
      const now = new Date();
      const { start, end } = quarterRange(quarterOf(now));
      const accounts = new Map((acc.data ?? []).map((x) => [x.id, x]));
      const segNames = new Map((seg.data ?? []).map((x) => [x.id, x.name]));
      const rows = (l.data ?? []).map((x) => {
        const delay = leadDelay(x, sla, now);
        return {
          ...x,
          delay,
          score: scoreLead({ ...x, late: delay.late }, icp.data ?? [], accounts, now, segNames),
        };
      });
      // Highest score first so the agent prioritises the same way the screen does.
      const list = rows
        .filter((x) => (!a.stage || x.stage === a.stage) && (!a.late_only || x.delay.late))
        .sort(byScore((x) => x.score))
        .slice(0, 40);
      const f = leadFunnel(leadCohort(l.data ?? [], start, end), d.data ?? []);
      return {
        plazos_dias: sla,
        embudo_trimestre: f.steps.map((st) => ({
          paso: st.label,
          leads: st.count,
          entrada_directa: st.direct,
          conversion_paso_anterior: st.fromPrev,
        })),
        leads: list.map((x) => ({
          id: x.id,
          empresa: x.company,
          contacto: x.contact_name ?? x.email,
          etapa: leadStageLabel(x.stage),
          origen: x.source,
          puntuacion: x.score.total,
          encaje_icp: x.score.total == null ? "sin datos" : fitText(x.score.fit),
          actividad: x.score.activity,
          proximo_paso: x.next_step,
          seguimiento: x.next_step_at,
          retraso: x.delay.late ? delayText(x.delay) : null,
          deal_id: x.deal_id,
        })),
      };
    },
  }),
  def({
    name: "list_tasks",
    kind: "read",
    description:
      "Tareas abiertas (por defecto las mías y las sin responsable). Filtros: de todo el equipo, vencidas, para hoy, para los próximos 7 días, de un deal o de una cuenta.",
    input: z.object({
      all: z.boolean().optional(),
      due: z.enum(["overdue", "today", "week"]).optional(),
      deal_id: z.string().uuid().optional(),
      account_id: z.string().uuid().optional(),
    }),
    run: async (c, a) => {
      let q = c.db
        .from("tasks")
        .select("id,title,due_date,deal_id,account_id,owner_id")
        .eq("org_id", c.orgId)
        .eq("done", false)
        .order("due_date");
      if (!a.all) q = q.or(`owner_id.eq.${c.userId},owner_id.is.null`);
      const today = new Date().toISOString().slice(0, 10);
      if (a.due === "overdue") q = q.lt("due_date", today);
      if (a.due === "today") q = q.eq("due_date", today);
      if (a.due === "week")
        q = q
          .gte("due_date", today)
          .lte("due_date", new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
      if (a.deal_id) q = q.eq("deal_id", a.deal_id);
      if (a.account_id) q = q.eq("account_id", a.account_id);
      return ok(await q.limit(40));
    },
  }),
  def({
    name: "list_suggestions",
    kind: "read",
    description: "Sugerencias proactivas pendientes del motor (riesgos y próximos pasos).",
    input: z.object({}),
    run: async (c) => {
      const r = await c.db
        .from("suggestions")
        .select("id,title,body,priority,link,action,detector,dedupe_key")
        .eq("org_id", c.orgId)
        .eq("status", "pending")
        .or(`user_id.is.null,user_id.eq.${c.userId}`)
        .order("priority")
        .limit(40);
      // Price suggestions are only for roles that may see prices (CA-19).
      const { canViewStrategy } = await import("@/lib/strategy-suggestions");
      return ok({
        ...r,
        data: (r.data ?? [])
          .filter((x) => canViewStrategy(x, c.roles))
          .slice(0, 15)
          .map(({ detector: _d, dedupe_key: _k, ...rest }) => rest),
      });
    },
  }),
  def({
    name: "get_setup_status",
    kind: "read",
    description:
      "Estado de la configuración estratégica (% completado, qué falta y qué desbloquea), la guía con el siguiente paso recomendado (guia.mensaje) y los pasos pospuestos, y valores actuales de segmentos, ICP, posicionamiento y pilares.",
    input: z.object({}),
    run: async (c) => {
      const d = await loadSetupData(c.db, c.orgId);
      const [segs, icps, pils] = await Promise.all([
        c.db
          .from("segments")
          .select("id,name,acv_min,acv_max,motion,win_rate_target,ae_quota")
          .eq("org_id", c.orgId),
        c.db
          .from("icp_profiles")
          .select(
            "id,name,industries,company_size,min_employees,max_employees,countries,search_keywords,target_titles,seniorities,pains,why_fit,anti_icp",
          )
          .eq("org_id", c.orgId),
        c.db.from("messaging_pillars").select("id,title,pain,message,proof").eq("org_id", c.orgId),
      ]);
      // The guide (setup-guide.ts) decides the next step by a fixed order, the same as the screen; the agent never picks it.
      const g = guideState(d, await loadSetupSnoozes(c.db, c.orgId), new Date());
      const guia = {
        mensaje: nextMessage(g, c.roles[0]),
        pospuestos: g.snoozed.map((s) => ({
          paso: s.label,
          hasta: s.snoozedUntil ? formatDay(s.snoozedUntil) : null,
        })),
      };
      // What the person's role can complete: the model must not ask an AE about the quota, nor read it as their next step.
      const st = setupStatus(d);
      const mine = st.missing.filter((i) => canCompleteStep(i.id, c.roles[0]));
      const estado = {
        ...st,
        missing: mine,
        next: mine[0] ?? null,
        fuera_de_tu_rol: st.missing
          .filter((i) => !canCompleteStep(i.id, c.roles[0]))
          .map((i) => i.label),
      };
      return {
        estado,
        guia,
        moneda: d.currency,
        posicionamiento: d.positioning,
        segmentos: segs.data,
        icp: icps.data,
        pilares: pils.data,
      };
    },
  }),
  def({
    name: "draft_followup",
    kind: "read",
    description:
      "Redacta con IA el seguimiento del día 3, 7 o 14 para un lead contactado sin respuesta, con el posicionamiento y los pilares de la empresa. Solo devuelve el borrador: no envía nada ni cambia el lead. Si no se indica el paso, usa el que toca.",
    input: z.object({
      lead_id: z.string().uuid(),
      step: z
        .enum(["nudge", "value", "breakup"])
        .optional()
        .describe("nudge = día 3, value = día 7, breakup = día 14"),
      tone: z.string().optional().describe("p. ej. más directo, más cercano, más corto"),
    }),
    run: async (c, a) => {
      const l = one(
        await c.db
          .from("leads")
          .select("id,company,contact_name,title,stage,contacted_at,next_step_at,notes,source,email")
          .eq("org_id", c.orgId)
          .eq("id", a.lead_id)
          .single(),
        "el lead",
      );
      // Email gate (NK-0173): invalid or catch-all blocks the draft with the reason; unverified or
      // unverifiable passes with a visible mark; no address on the lead behaves as before.
      let emailMark: string | null = null;
      if (l.email?.trim()) {
        const { emailBlockReason, emailGateMark, emailStatusFor } = await import("@/lib/email-status");
        const { data: vrow } = await c.db
          .from("email_verifications")
          .select("email,status,checked_at")
          .eq("org_id", c.orgId)
          .eq("email", l.email.trim().toLowerCase())
          .maybeSingle();
        // Database CHECK constrains this string to the shared five-state union.
        const verification = vrow ? { ...vrow, status: vrow.status as import("@/lib/email-verification").EmailStatus } : null;
        const status = emailStatusFor(l.email, verification, new Date());
        const reason = status ? emailBlockReason(status) : null;
        if (reason && status) {
          const { recordEmailDraftBlock } = await import("@/lib/email-verification-writer");
          await recordEmailDraftBlock(c.orgId, {
            surface: "draft_followup",
            status,
            reason,
          });
          return { bloqueado: true, motivo: reason };
        }
        emailMark = status ? emailGateMark(status) : null;
      }
      const st = followupStatus(l, new Date());
      const step = a.step
        ? FOLLOWUP_STEPS.find((x) => x.id === a.step)!
        : (st.due ?? st.next?.step ?? FOLLOWUP_STEPS[0]);
      const [setup, rules, voice] = await Promise.all([
        loadSetupData(c.db, c.orgId),
        loadAgentRules(c),
        loadVoice(c),
      ]);
      const base = followupDraft(step, l, {
        positioning: setup.positioning,
        pillars: setup.pillars,
      });
      const block = rulesBlock(rules.rules, { withPerson: true });
      const text = await ask(
        `Eres un vendedor B2B experimentado que escribe seguimientos cortos en español neutro, de tú, sin signos de exclamación ni emoji, sin promesas ni adjetivos vacíos. Máximo 60 palabras. Una sola idea por mensaje y una pregunta clara al final. No inventes datos del lead ni de la empresa.${block ? `\n${block}` : ""}${voice.examples.length ? `\n${VOICE_FORM_RULE}` : ""}`,
        JSON.stringify({
          paso: `${step.label}: ${step.purpose}`,
          tono: a.tone ?? null,
          lead: {
            empresa: l.company,
            contacto: l.contact_name,
            cargo: l.title,
            origen: l.source,
            notas: (l.notes ?? "").slice(0, 600),
          },
          posicionamiento: setup.positioning,
          pilares: setup.pillars,
          borrador_base: base,
          // The company's voice is data for the model, never part of the system text (NK-0128).
          ...(voice.examples.length ? { voz_de_la_empresa: voice.examples } : {}),
        }),
        { effort: "low" },
      );
      // A failed read of the rules or of the voice is said where the person reads the draft (SDD-20261106-agent-rules-reader,
      // CA-5; NK-0128, CA-4). The rules keep `mensaje`; the voice has its own `mensaje_voz`.
      const draft = {
        paso: step.label,
        dias_sin_respuesta: st.daysSinceContact,
        borrador: text.trim(),
        borrador_base: base,
        marca_email: emailMark,
      };
      const notices = [rules.ok ? "" : RULES_READ_FAILED, voice.ok ? "" : VOICE_READ_FAILED].filter(
        Boolean,
      );
      if (!notices.length) return draft;
      return {
        ...draft,
        borrador: `${notices.join("\n\n")}\n\n${draft.borrador}`,
        ...(rules.ok ? {} : { mensaje: RULES_READ_FAILED }),
        ...(voice.ok ? {} : { mensaje_voz: VOICE_READ_FAILED }),
      };
    },
  }),
  def({
    name: "search_knowledge",
    kind: "read",
    description: "Busca en el hub de conocimiento (playbooks, objeciones, metodología, empresa).",
    input: z.object({ query: z.string().min(1) }),
    run: async (c, a) => {
      // RLS hides other people's personal docs in the app; Telegram uses the privileged client, so filter here too.
      const rows = ok(
        await c.db
          .from("knowledge_docs")
          .select("section,title,body,scope,created_by")
          .eq("org_id", c.orgId)
          // The company's voice is real messages: it reaches the drafts only through loadVoice, never through a search that an
          // external assistant could read over MCP (NK-0128, CA-6b).
          .neq("section", VOICE_SECTION)
          .or(`title.ilike.${like(a.query)},body.ilike.${like(a.query)}`)
          .limit(30),
      );
      return (rows ?? [])
        .filter((d) => d.section !== VOICE_SECTION)
        .filter((d) => d.scope === "team" || d.created_by === c.userId)
        .slice(0, 6)
        .map(({ scope: _s, created_by: _c, ...d }) => d);
    },
  }),

  // ---------- WRITE (require confirmation) ----------
];
