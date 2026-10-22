// Leads and pipeline: lead detail and manual entry (same writer as the CSV and the lead link), deal detail,
// owner, product lines, mutual action plan, the quarter board and the Monday report.
import { z } from "zod";
import { normalizeLead, PRE_DEAL_STAGES } from "@/lib/leads";
import { delayText, leadDelay, leadStageLabel, readSla } from "@/lib/lead-funnel";
import { fitText, scoreLead } from "@/lib/scoring";
import { followupStatus } from "@/lib/followup";
import { checkLineField, dealTotals, lineFromProduct, type DealLine, type Product } from "@/lib/deal-lines";
import { closingIn, pipelineBoard } from "@/lib/pipeline-board";
import { quarterOf, quarterRange } from "@/lib/metrics";
import { stageLabel } from "@/lib/stages";
import { DATE_ARG, accountNames, canPrice, def, defined, isLeader, mustBeMember, mustFind, ok, orgStages, type AgentTool, type ToolCtx } from "../tool-kit";

const QUARTER = z.string().regex(/^\d{4}-Q[1-4]$/, "Trimestre en formato AAAA-QN").describe("AAAA-QN; por defecto, el actual");
const MAP_SIDES = ["nosotros", "cliente"] as const;
// Same words as the deal_lines_scope trigger, which the privileged client (Telegram) does not run into.
const PRICING_ONLY = "Solo el Owner, el Sales Leader o Deal Desk pueden fijar precios, costes o descuentos. Añade el producto tal como está en el catálogo, cambia la cantidad o pide el descuento a Deal Desk (request_approval).";

/** A number the line editor would accept, or the same error message the screen shows. */
function lineNumber(field: "quantity" | "unit_price" | "unit_cost" | "discount_pct", v: number | null | undefined) {
  if (v === undefined) return undefined;
  const r = checkLineField(field, v == null ? "" : String(v));
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

async function lineOfOrg(c: ToolCtx, lineId: string) {
  const line = await mustFind<{ id: string; deal_id: string; name: string }>(c, "deal_lines", lineId, "esa línea del deal", "id,deal_id,name");
  return line;
}

export const PIPELINE_TOOLS: AgentTool[] = [
  // ---------- LEADS ----------
  def({
    name: "get_lead", kind: "read",
    description: "Detalle de un lead: datos, etapa, retraso frente al plazo de su etapa, puntuación con el encaje ICP explicado, estado de la secuencia de seguimiento (día 3, 7, 14) y sus últimas entradas.",
    input: z.object({ lead_id: z.string().uuid() }),
    run: async (c, a) => {
      const l = ok(await c.db.from("leads").select("*").eq("org_id", c.orgId).eq("id", a.lead_id).maybeSingle()) as any;
      if (!l) return { error: "Lead no encontrado en esta empresa" };
      const [s, icp, acc, seg, events] = await Promise.all([
        c.db.from("lead_settings").select("sla").eq("org_id", c.orgId).maybeSingle(),
        c.db.from("icp_profiles").select("id,segment_id,industries,company_size,geography,anti_icp").eq("org_id", c.orgId),
        l.account_id ? c.db.from("accounts").select("id,segment_id,industry,size,tier,name").eq("org_id", c.orgId).eq("id", l.account_id) : Promise.resolve({ data: [] as any[] }),
        c.db.from("segments").select("id,name").eq("org_id", c.orgId),
        c.db.from("lead_events").select("received_at,channel,status,summary").eq("org_id", c.orgId).eq("lead_id", a.lead_id).order("received_at", { ascending: false }).limit(5),
      ]);
      const now = new Date();
      const delay = leadDelay(l, readSla(s.data?.sla), now);
      const score = scoreLead({ ...l, late: delay.late }, (icp.data ?? []) as any, new Map((acc.data ?? []).map((x: any) => [x.id, x])), now, new Map((seg.data ?? []).map((x) => [x.id, x.name])));
      const seq = followupStatus(l, now);
      return {
        id: l.id, empresa: l.company, contacto: l.contact_name, email: l.email, cargo: l.title, etapa: leadStageLabel(l.stage), origen: l.source,
        cuenta_id: l.account_id, deal_id: l.deal_id, propietario_id: l.owner_id, importe: l.amount, notas: l.notes, proximo_paso: l.next_step, seguimiento: l.next_step_at,
        retraso: delay.late ? delayText(delay) : null, puntuacion: score.total, encaje_icp: score.total == null ? "sin datos" : fitText(score.fit), actividad: score.activity,
        criterios_icp: score.fit.criteria.map((k) => ({ criterio: k.label, estado: k.status, nota: k.note })),
        secuencia: { dias_sin_respuesta: seq.daysSinceContact, toca: seq.due?.label ?? null, siguiente: seq.next ? `${seq.next.step.label} el ${seq.next.date}` : null, pausada_o_terminada: seq.reason },
        entradas: events.data,
      };
    },
  }),
  def({
    name: "create_lead", kind: "write",
    description: `Da de alta un lead a mano por el mismo camino que la importación CSV y el enlace de leads: busca la cuenta por dominio o nombre (y la crea si no existe), la persona por email y no duplica un lead abierto. Etapas: ${PRE_DEAL_STAGES.join(", ")} (por defecto new).`,
    input: z.object({
      company: z.string().min(1).max(200), contact_name: z.string().max(200).optional(), email: z.string().max(200).optional(), title: z.string().max(200).optional(),
      linkedin_url: z.string().max(500).optional(), domain: z.string().max(200).optional(), stage: z.enum(PRE_DEAL_STAGES).optional(),
      source: z.string().max(100).optional(), segment: z.string().max(200).optional().describe("Nombre del segmento"), amount: z.number().nonnegative().optional(), notes: z.string().max(4000).optional(),
    }),
    summarize: (a) => `Dar de alta el lead «${a.company}»${a.contact_name ? ` (${a.contact_name})` : ""}${a.stage ? ` en ${leadStageLabel(a.stage)}` : ""}`,
    run: async (c, a) => {
      const norm = normalizeLead({ company: a.company, name: a.contact_name, email: a.email, title: a.title, linkedin: a.linkedin_url, domain: a.domain, stage: a.stage, source: a.source ?? "Asistente", segment: a.segment, amount: a.amount }, { defaultStage: "new" });
      if ("error" in norm) throw new Error(norm.error);
      const { data: segments } = await c.db.from("segments").select("id,name").eq("org_id", c.orgId);
      const { ingestLead } = await import("@/lib/leads-ingest");
      const r = await ingestLead(c.db, { orgId: c.orgId, segments: segments ?? [] }, norm.lead);
      if (r.leadId && a.notes) {
        // An existing lead keeps its notes: the new one is added below them, never written over them.
        let notes = a.notes;
        if (r.status === "updated") {
          const { data: cur } = await c.db.from("leads").select("notes").eq("org_id", c.orgId).eq("id", r.leadId).maybeSingle();
          if (cur?.notes?.trim()) notes = `${cur.notes.trim()}\n\n${new Date().toISOString().slice(0, 10)}: ${a.notes}`;
        }
        await c.db.from("leads").update({ notes }).eq("org_id", c.orgId).eq("id", r.leadId);
      }
      return { ...r, mensaje: r.status === "updated" ? `Ya existía: ${r.summary}` : r.summary };
    },
  }),

  // ---------- DEALS ----------
  def({
    name: "get_deal", kind: "read",
    description: "Detalle de un deal: cuenta, etapa, importe, cierre, salud, forecast, MEDDPICC, líneas de producto con margen, historial de etapas, plan de acción mutuo, tareas abiertas y reuniones.",
    input: z.object({ deal_id: z.string().uuid() }),
    run: async (c, a) => {
      const d = ok(await c.db.from("deals").select("*").eq("org_id", c.orgId).eq("id", a.deal_id).maybeSingle()) as any;
      if (!d) return { error: "Deal no encontrado en esta empresa" };
      const [lines, hist, map, tasks, meet, stages] = await Promise.all([
        c.db.from("deal_lines").select("id,product_id,name,quantity,unit_price,unit_cost,discount_pct,billing").eq("org_id", c.orgId).eq("deal_id", a.deal_id),
        c.db.from("deal_stage_history").select("from_stage,to_stage,changed_at").eq("org_id", c.orgId).eq("deal_id", a.deal_id).order("changed_at", { ascending: false }).limit(10),
        c.db.from("mutual_action_items").select("id,title,due_date,owner_side,done").eq("org_id", c.orgId).eq("deal_id", a.deal_id).order("due_date"),
        c.db.from("tasks").select("id,title,due_date,owner_id").eq("org_id", c.orgId).eq("deal_id", a.deal_id).eq("done", false),
        c.db.from("meetings").select("id,title,scheduled_at").eq("org_id", c.orgId).eq("deal_id", a.deal_id).order("scheduled_at", { ascending: false }).limit(5),
        orgStages(c),
      ]);
      const names = await accountNames(c, [d.account_id]);
      const t = dealTotals((lines.data ?? []) as DealLine[]);
      return {
        id: d.id, nombre: d.name, cuenta: names.get(d.account_id) ?? null, cuenta_id: d.account_id, etapa: stageLabel(d.stage, stages), probabilidad: d.probability,
        importe: d.amount, cierre: d.close_date, salud: d.health, forecast: d.forecast_category, propietario_id: d.owner_id, origen: d.source, meddpicc: d.meddpicc,
        lineas: lines.data, totales: (lines.data ?? []).length ? { importe: t.amount, pagos_unicos: t.oneOff, margen: t.margin, margen_pct: t.marginPct == null ? null : Math.round(t.marginPct) } : null,
        historial: (hist.data ?? []).map((h) => ({ de: h.from_stage ? stageLabel(h.from_stage, stages) : null, a: stageLabel(h.to_stage, stages), fecha: h.changed_at })),
        plan_accion_mutuo: map.data, tareas: tasks.data, reuniones: meet.data,
      };
    },
  }),
  def({
    name: "assign_deal", kind: "write",
    description: "Cambia el propietario de un deal (owner_id de un miembro del equipo, o null para dejarlo sin propietario). Owner y Sales Leader pueden reasignar cualquiera; el resto, los suyos o los que no tienen propietario.",
    input: z.object({ deal_id: z.string().uuid(), owner_id: z.string().uuid().nullable() }),
    summarize: (a) => (a.owner_id ? "Asignar el deal a otro miembro del equipo" : "Dejar el deal sin propietario"),
    run: async (c, a) => {
      const d = await mustFind<{ owner_id: string | null; name: string }>(c, "deals", a.deal_id, "ese deal", "id,owner_id,name");
      if (!isLeader(c.roles) && d.owner_id && d.owner_id !== c.userId) throw new Error("Solo Owner o Sales Leader pueden reasignar un deal de otra persona.");
      if (a.owner_id) await mustBeMember(c, a.owner_id);
      return ok(await c.db.from("deals").update({ owner_id: a.owner_id }).eq("org_id", c.orgId).eq("id", a.deal_id).select("id,name,owner_id").single());
    },
  }),
  def({
    name: "add_deal_line", kind: "write",
    description: "Añade una línea a un deal: un producto del catálogo (product_id, con su precio, coste y cobro de hoy) o una línea libre (name, unit_price y billing monthly/annual/one_off). El importe del deal pasa a ser el de sus líneas; los pagos únicos no cuentan en el ACV. Las líneas libres y cambiar precio, coste o descuento son de Owner, Sales Leader o Deal Desk; el resto pide el descuento con request_approval.",
    input: z.object({
      deal_id: z.string().uuid(), product_id: z.string().uuid().optional(), name: z.string().min(1).max(200).optional(),
      unit_price: z.number().optional(), billing: z.enum(["monthly", "annual", "one_off"]).optional(), unit_cost: z.number().nullable().optional(),
      quantity: z.number().optional(), discount_pct: z.number().optional(),
    }),
    summarize: (a) => `Añadir ${a.quantity ?? 1} × ${a.product_id ? "un producto del catálogo" : `«${a.name ?? "línea"}»`} al deal${a.discount_pct ? ` con ${a.discount_pct} % de descuento` : ""}`,
    run: async (c, a) => {
      await mustFind(c, "deals", a.deal_id, "ese deal");
      if (!canPrice(c.roles) && (!a.product_id || a.unit_price !== undefined || a.unit_cost !== undefined || (a.discount_pct ?? 0) !== 0)) throw new Error(PRICING_ONLY);
      let line: DealLine;
      if (a.product_id) {
        const p = await mustFind<Product>(c, "products", a.product_id, "ese producto del catálogo", "id,name,price,cost,billing,active");
        if (!p.active) throw new Error(`«${p.name}» ya no está a la venta. Elige otro producto o vuelve a ponerlo a la venta en Productos.`);
        line = lineFromProduct(p);
      } else {
        if (!a.name || a.unit_price === undefined || !a.billing) throw new Error("Una línea sin producto necesita nombre, precio unitario y tipo de cobro (monthly, annual u one_off).");
        line = { product_id: null, name: a.name, quantity: 1, unit_price: lineNumber("unit_price", a.unit_price)!, unit_cost: null, discount_pct: 0, billing: a.billing };
      }
      const extra = defined({ quantity: lineNumber("quantity", a.quantity), unit_cost: lineNumber("unit_cost", a.unit_cost), discount_pct: lineNumber("discount_pct", a.discount_pct), ...(a.product_id ? { unit_price: lineNumber("unit_price", a.unit_price) } : {}) });
      return ok(await c.db.from("deal_lines").insert({ ...line, ...extra, deal_id: a.deal_id, org_id: c.orgId } as never).select("id,name").single());
    },
  }),
  def({
    name: "update_deal_line", kind: "write",
    description: "Cambia la cantidad, el precio unitario, el coste unitario (null = sin coste) o el descuento (%) de una línea de un deal. Precio, coste y descuento son de Owner, Sales Leader o Deal Desk; el resto solo cambia la cantidad.",
    input: z.object({ line_id: z.string().uuid(), quantity: z.number().optional(), unit_price: z.number().optional(), unit_cost: z.number().nullable().optional(), discount_pct: z.number().optional() }),
    summarize: (a) => `Cambiar la línea del deal: ${[a.quantity !== undefined && `cantidad ${a.quantity}`, a.unit_price !== undefined && `precio ${a.unit_price}`, a.unit_cost !== undefined && `coste ${a.unit_cost ?? "sin coste"}`, a.discount_pct !== undefined && `descuento ${a.discount_pct} %`].filter(Boolean).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      await lineOfOrg(c, a.line_id);
      if (!canPrice(c.roles) && (a.unit_price !== undefined || a.unit_cost !== undefined || a.discount_pct !== undefined)) throw new Error(PRICING_ONLY);
      const patch = defined({ quantity: lineNumber("quantity", a.quantity), unit_price: lineNumber("unit_price", a.unit_price), unit_cost: lineNumber("unit_cost", a.unit_cost), discount_pct: lineNumber("discount_pct", a.discount_pct) });
      if (!Object.keys(patch).length) throw new Error("No has indicado qué cambiar de la línea.");
      return ok(await c.db.from("deal_lines").update(patch as never).eq("org_id", c.orgId).eq("id", a.line_id).select("id,name").single());
    },
  }),
  def({
    name: "remove_deal_line", kind: "write",
    description: "Quita una línea de un deal; el importe del deal se recalcula con las que quedan.",
    input: z.object({ line_id: z.string().uuid() }),
    summarize: () => "Quitar una línea del deal",
    run: async (c, a) => {
      const l = await lineOfOrg(c, a.line_id);
      ok(await c.db.from("deal_lines").delete().eq("org_id", c.orgId).eq("id", a.line_id).select("id"));
      return { ok: true, mensaje: `«${l.name}» quitada del deal.` };
    },
  }),
  def({
    name: "add_mutual_action_item", kind: "write",
    description: "Añade un hito al plan de acción mutuo de un deal, con fecha y de qué lado es (nosotros o cliente).",
    input: z.object({ deal_id: z.string().uuid(), title: z.string().min(1).max(300), due_date: DATE_ARG.optional(), owner_side: z.enum(MAP_SIDES).optional() }),
    summarize: (a) => `Añadir «${a.title}» al plan de acción mutuo${a.due_date ? ` para el ${a.due_date}` : ""}`,
    run: async (c, a) => {
      await mustFind(c, "deals", a.deal_id, "ese deal");
      return ok(await c.db.from("mutual_action_items").insert({ deal_id: a.deal_id, title: a.title, due_date: a.due_date ?? null, owner_side: a.owner_side ?? "nosotros", org_id: c.orgId }).select("id,title").single());
    },
  }),
  def({
    name: "complete_mutual_action_item", kind: "write",
    description: "Marca un hito del plan de acción mutuo como hecho (o lo reabre con done = false).",
    input: z.object({ item_id: z.string().uuid(), done: z.boolean().optional() }),
    summarize: (a) => (a.done === false ? "Reabrir un hito del plan de acción mutuo" : "Marcar un hito del plan de acción mutuo como hecho"),
    run: async (c, a) => {
      await mustFind(c, "mutual_action_items", a.item_id, "ese hito del plan de acción mutuo");
      return ok(await c.db.from("mutual_action_items").update({ done: a.done ?? true }).eq("org_id", c.orgId).eq("id", a.item_id).select("id,title,done").single());
    },
  }),
  def({
    name: "get_pipeline_board", kind: "read",
    description: "Tablero del trimestre como en Métricas: leads abiertos (Nuevo→SQL), oportunidades, deals en curso y ganados, con número, importe y retrasos por columna, más los deals abiertos que cierran en el trimestre.",
    input: z.object({ quarter: QUARTER.optional() }),
    run: async (c, a) => {
      const range = quarterRange(a.quarter ?? quarterOf(new Date()));
      const [l, d, s, stages] = await Promise.all([
        c.db.from("leads").select("id,company,contact_name,owner_id,stage,stage_entered_at,next_step_at,amount").eq("org_id", c.orgId).order("created_at", { ascending: false }).limit(2000),
        c.db.from("deals").select("id,name,owner_id,stage,amount,close_date,closed_at,updated_at").eq("org_id", c.orgId),
        c.db.from("lead_settings").select("sla").eq("org_id", c.orgId).maybeSingle(),
        orgStages(c),
      ]);
      const deals = (d.data ?? []) as any[];
      const board = pipelineBoard((l.data ?? []) as any, deals, range, readSla(s.data?.sla), new Date(), stages);
      const closing = closingIn(deals, range);
      return {
        trimestre: a.quarter ?? quarterOf(new Date()),
        grupos: board.map((g) => ({
          grupo: g.label, numero: g.count, importe: g.amount,
          columnas: g.columns.map((col) => ({ etapa: col.label, numero: col.count, importe: col.amount, retrasados: col.items.filter((i) => i.late).length, principales: col.items.slice(0, 5).map((i) => ({ id: i.id, tipo: i.kind, nombre: i.name, importe: i.amount, retraso: i.lateText })) })),
        })),
        cierran_en_el_trimestre: { numero: closing.length, importe: closing.reduce((t, x) => t + Number(x.amount ?? 0), 0) },
      };
    },
  }),
  def({
    name: "get_weekly_report", kind: "read",
    description: "Informe semanal del pipeline calculado ahora (lo mismo que llega los lunes): avances de etapa, ganados y perdidos, deals enfriados, cierres vencidos, leads y lo que toca esta semana. No envía nada.",
    input: z.object({}),
    run: async (c) => {
      const { buildOrgReport } = await import("@/lib/weekly-report.server");
      const { report, text } = await buildOrgReport(c.db, c.orgId);
      return { titular: report.headline, informe: text };
    },
  }),
];
