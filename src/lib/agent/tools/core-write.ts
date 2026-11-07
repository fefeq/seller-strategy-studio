// Core writes on records: accounts, deals, leads, stakeholders, meetings, tasks, trials, experiments. Part of the single registry in ../tools.ts (order there is the order the model sees).
import { z } from "zod";
import {
  STAGE_ARG,
  accountByName,
  def,
  mustBeMember,
  mustFind,
  ok,
  one,
  orgStages,
  resolveStage,
} from "../tool-kit";
import { BUYING_ROLES } from "@/lib/roles";
import { firstOpenStage, stagePath } from "@/lib/stages";
import { TRACKS, stageGate } from "@/lib/bmad/tracks";
import { lineFromProduct, type Product } from "@/lib/deal-lines";
import { leadStageLabel } from "@/lib/lead-funnel";
import { isLostStage, LOSS_REASONS, lossLabel, parseLoss } from "@/lib/loss-reasons";
import { ask } from "@/lib/ai-gateway";
import { CALL_NOTE_FIELDS, callLogEntry, filledCount, mergeCallNotes } from "@/lib/call-notes";
import { CORE_READ_TOOLS } from "./core-read";
import { LEAD_STAGE_IDS } from "../tool-kit";
import type { AgentTool } from "../tool-kit";
import {
  WON_COPY,
  blockedByPendingWon,
  pendingStageChanges,
  requestWonApproval,
  type ApprovalRow,
} from "@/lib/won-approval";

export const CORE_WRITE_TOOLS: AgentTool[] = [
  def({
    name: "create_account",
    kind: "write",
    description: "Crea una cuenta.",
    input: z.object({
      name: z.string().min(1),
      domain: z.string().optional(),
      industry: z.string().optional(),
      is_target: z.boolean().optional(),
    }),
    summarize: (a) => `Crear la cuenta «${a.name}»${a.is_target ? " como objetivo" : ""}`,
    run: async (c, a) =>
      ok(
        await c.db
          .from("accounts")
          .insert({ ...a, org_id: c.orgId, owner_id: c.userId })
          .select("id,name")
          .single(),
      ),
  }),
  def({
    name: "create_deal",
    kind: "write",
    description:
      "Crea un deal (oportunidad). Sin account_id lo asocia a la cuenta con ese nombre (account_name, o el nombre del deal) y la crea si no existe, como la entrada de leads.",
    input: z.object({
      name: z.string().min(1),
      account_id: z.string().uuid().optional(),
      account_name: z.string().optional(),
      segment_id: z.string().uuid().optional(),
      amount: z.number().nonnegative().optional(),
      close_date: z.string().optional().describe("AAAA-MM-DD"),
      stage: STAGE_ARG.optional(),
      product_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Producto del catálogo (list_products): añade una línea y el importe pasa a ser el de sus líneas",
        ),
      quantity: z.number().positive().optional(),
    }),
    summarize: (a) =>
      `Crear el deal «${a.name}»${a.product_id ? ` con ${a.quantity ?? 1} × un producto del catálogo (el importe sale de su precio)` : a.amount ? ` por ${a.amount}` : ""}${a.stage ? ` en la etapa «${a.stage}»` : ""}`,
    run: async (c, a) => {
      // Every way of creating a deal ends with an account, so the asistente, the pipeline and the CSV
      // produce the same data (a deal created here used to have no account; one from the CSV did).
      const { account_name, product_id, quantity, ...deal } = a;
      const product = product_id
        ? ok(
            await c.db
              .from("products")
              .select("id,name,price,cost,billing,active")
              .eq("org_id", c.orgId)
              .eq("id", product_id)
              .maybeSingle(),
          )
        : null;
      if (product_id && !product)
        throw new Error("Ese producto no existe en el catálogo de esta empresa.");
      if (product && !(product as Product).active)
        throw new Error(
          `«${(product as Product).name}» ya no está a la venta. Elige otro producto o vuelve a ponerlo a la venta en Productos.`,
        );
      if (deal.account_id) await mustFind(c, "accounts", deal.account_id, "esa cuenta");
      if (deal.segment_id) await mustFind(c, "segments", deal.segment_id, "ese segmento");
      const st = deal.stage ? await resolveStage(c, deal.stage) : null;
      const first = st ? null : firstOpenStage(await orgStages(c));
      const account_id =
        deal.account_id ??
        (await accountByName(c, (account_name ?? deal.name).trim(), deal.segment_id));
      const created = ok(
        await c.db
          .from("deals")
          .insert({
            ...deal,
            account_id,
            stage: st?.key ?? first!.key,
            probability: st?.probability ?? first!.probability,
            org_id: c.orgId,
            owner_id: c.userId,
          })
          .select("id,name,account_id")
          .single(),
      );
      if (product) {
        const line = await c.db
          .from("deal_lines")
          .insert({
            ...lineFromProduct(product as Product, quantity ?? 1),
            deal_id: (created as { id: string }).id,
            org_id: c.orgId,
          } as never)
          .select("id");
        if (line.error) {
          // No half-created deal: without its line it would have no amount and a retry would duplicate it.
          await c.db
            .from("deals")
            .delete()
            .eq("org_id", c.orgId)
            .eq("id", (created as { id: string }).id);
          throw new Error(
            `No se ha creado el deal: no se pudo añadir el producto (${line.error.message}).`,
          );
        }
      }
      return created;
    },
  }),
  def({
    name: "update_deal",
    kind: "write",
    description:
      "Actualiza un deal: etapa, importe, fecha de cierre, salud (green/yellow/red), categoría de forecast (pipeline/best_case/commit) o un campo MEDDPICC. Como en Pipeline, pasar a Ganado no se aplica directamente: crea una aprobación. Si el deal tiene líneas de producto, su importe sale de ellas y no se cambia aquí.",
    input: z.object({
      deal_id: z.string().uuid(),
      stage: STAGE_ARG.optional(),
      amount: z.number().nonnegative().optional(),
      close_date: z.string().optional(),
      health: z.enum(["green", "yellow", "red"]).optional(),
      forecast_category: z.enum(["pipeline", "best_case", "commit"]).optional(),
      meddpicc_field: z.string().optional(),
      meddpicc_value: z.string().optional(),
      lost_reason: z
        .string()
        .optional()
        .describe(
          `Solo en deals perdidos (o al pasarlos a Perdido); opcional. Uno de: ${LOSS_REASONS.map((r) => `${r.key} (${r.label})`).join(", ")}`,
        ),
      lost_reason_detail: z
        .string()
        .optional()
        .describe("Texto libre del motivo de pérdida, hasta 500 caracteres"),
      lost_competitor: z
        .string()
        .optional()
        .describe("Competidor al que se perdió, texto libre; opcional"),
    }),
    summarize: (a) => {
      const won = !!a.stage && ["won", "ganado"].includes(a.stage.trim().toLowerCase());
      const parts = [
        a.lost_reason && `motivo de pérdida → ${lossLabel(a.lost_reason)}`,
        a.lost_competitor && `competidor → ${a.lost_competitor}`,
        a.stage && (won ? "pedir aprobación para pasar a Ganado" : `etapa → «${a.stage}»`),
        a.amount != null && `importe → ${a.amount}`,
        a.close_date && `cierre → ${a.close_date}`,
        a.health && `salud → ${a.health}`,
        a.forecast_category && `forecast → ${a.forecast_category}`,
        a.meddpicc_field && `MEDDPICC ${a.meddpicc_field}`,
      ].filter(Boolean);
      return `Actualizar el deal: ${parts.join(", ") || "sin cambios"}`;
    },
    run: async (c, a) => {
      const {
        deal_id,
        meddpicc_field,
        meddpicc_value,
        lost_reason,
        lost_reason_detail,
        lost_competitor,
        ...rest
      } = a;
      const cur = ok(
        await c.db
          .from("deals")
          .select("id,name,amount,meddpicc,stage")
          .eq("org_id", c.orgId)
          .eq("id", deal_id)
          .maybeSingle(),
      ) as {
        id: string;
        name: string;
        amount: number | null;
        meddpicc: Record<string, unknown> | null;
        stage?: string;
      } | null;
      if (!cur)
        throw new Error(
          "No encuentro ese deal en esta empresa. Búscalo primero con search o list_deals.",
        );
      const patch: Record<string, unknown> = { ...rest };
      // Reason and competitor of a lost deal (SDD estrategia F0): optional, only what was sent is written, never invented.
      const lossSent = { lost_reason, lost_reason_detail, lost_competitor };
      if (Object.values(lossSent).some((v) => v !== undefined)) {
        const parsed = parseLoss({
          reason: lost_reason,
          detail: lost_reason_detail,
          competitor: lost_competitor,
        });
        if (!parsed.ok) throw new Error(parsed.error);
        const toLost = !!rest.stage && (await resolveStage(c, rest.stage)).kind === "lost";
        if (!toLost && !isLostStage(cur.stage))
          throw new Error(
            "El motivo de pérdida solo se guarda en deals perdidos: pasa el deal a Perdido o indícalo al marcarlo.",
          );
        for (const k of Object.keys(lossSent) as (keyof typeof lossSent)[])
          if (lossSent[k] !== undefined) patch[k] = parsed.patch[k];
      }
      const notes: string[] = [];
      if (rest.amount != null) {
        const { count } = await c.db
          .from("deal_lines")
          .select("id", { count: "exact", head: true })
          .eq("org_id", c.orgId)
          .eq("deal_id", deal_id);
        if (count)
          throw new Error(
            "Este deal tiene líneas de producto: su importe sale de ellas. Cambia las líneas (update_deal_line) en vez del importe.",
          );
      }
      if (meddpicc_field)
        patch.meddpicc = { ...(cur.meddpicc ?? {}), [meddpicc_field]: meddpicc_value ?? "" };
      let wonKey: string | null = null;
      if (rest.stage) {
        const st = await resolveStage(c, rest.stage);
        if (st.kind !== "lost") {
          // Same MEDDPICC warning Pipeline shows on every move except to Perdido: it informs, it does not block.
          const gate = stageGate(
            {
              amount:
                (rest.amount ?? cur.amount) == null ? null : Number(rest.amount ?? cur.amount),
              meddpicc: (patch.meddpicc as Record<string, unknown> | undefined) ?? cur.meddpicc,
            },
            st.key,
            stagePath(st.stages),
          );
          if (gate.missing.length)
            notes.push(
              `Camino ${TRACKS[gate.track].label}: para esta etapa falta ${gate.missing.join(", ")}; complétalo en el MEDDPICC del deal.`,
            );
        }
        if (st.kind === "won") {
          delete patch.stage;
          wonKey = st.key;
        } else {
          patch.stage = st.key;
          patch.probability = st.probability;
        }
      }
      if (!Object.keys(patch).length && !wonKey)
        throw new Error("No has indicado qué cambiar del deal.");
      // Same rules as the Pipeline screen (SDD-20261031-deal-won-duplicate-approvals): one pending request per deal, and
      // no other stage change while it is pending. The approval goes first: if it cannot be created, nothing of the deal changes.
      const pendingRows = ok(
        await c.db
          .from("approvals")
          .select("id,kind,status,evidence")
          .eq("org_id", c.orgId)
          .eq("kind", "stage_change")
          .eq("status", "pending"),
      );
      const pendingForDeal = pendingStageChanges((pendingRows ?? []) as ApprovalRow[], deal_id);
      if (
        (wonKey || patch.stage !== undefined) &&
        blockedByPendingWon(pendingForDeal.length, wonKey ? "won" : String(patch.stage))
      )
        throw new Error(WON_COPY.blockedByPending);
      if (wonKey) {
        const r = await requestWonApproval(c.db as never, {
          dealId: deal_id,
          dealName: String(cur.name),
          dealStage: String(cur.stage ?? ""),
          wonKey,
          pending: pendingForDeal,
          orgId: c.orgId,
        });
        if (r.result === "error") throw new Error(r.error.message);
        notes.push(
          r.result === "created"
            ? "Pasar a Ganado requiere aprobación: lo he enviado a Aprobaciones."
            : r.result === "already-pending"
              ? WON_COPY.alreadyPending
              : WON_COPY.alreadyWon,
        );
      }
      const row = Object.keys(patch).length
        ? ok(
            await c.db
              .from("deals")
              .update(patch as never)
              .eq("org_id", c.orgId)
              .eq("id", deal_id)
              .select("id,name,stage,close_date")
              .single(),
          )
        : cur;
      return { ...row, ...(notes.length ? { mensaje: notes.join(" ") } : {}) };
    },
  }),
  def({
    name: "update_lead",
    kind: "write",
    description:
      "Actualiza un lead: etapa (new, contacted, mql, sql, opportunity, disqualified), próximo paso y fecha de seguimiento. Pasarlo a opportunity crea su deal en la primera etapa del pipeline.",
    input: z.object({
      lead_id: z.string().uuid(),
      stage: z.enum(LEAD_STAGE_IDS).optional(),
      next_step: z.string().optional(),
      next_step_at: z.string().optional().describe("AAAA-MM-DD"),
      disqualified_reason: z.string().optional(),
    }),
    summarize: (a) => {
      const parts = [
        a.stage && `etapa → ${leadStageLabel(a.stage)}`,
        a.next_step && `próximo paso «${a.next_step}»`,
        a.next_step_at && `seguimiento ${a.next_step_at}`,
      ].filter(Boolean);
      return `Actualizar el lead: ${parts.join(", ") || "sin cambios"}`;
    },
    run: async (c, a) => {
      const { lead_id, ...patch } = a;
      const cur = ok(
        await c.db.from("leads").select("stage").eq("org_id", c.orgId).eq("id", lead_id).single(),
      );
      if (cur?.stage === "opportunity" && patch.stage && patch.stage !== "opportunity")
        return { error: "El lead ya es oportunidad; actualiza su deal." };
      const saved = ok(
        await c.db
          .from("leads")
          .update(patch)
          .eq("org_id", c.orgId)
          .eq("id", lead_id)
          .select("id,company,stage,deal_id,next_step_at,contacted_at,enriched_at,created_at")
          .single(),
      );
      // Keeps the follow-up sequence with waits in step (Inngest); never blocks the change.
      const [{ leadEvents }, { trySend }] = await Promise.all([
        import("@/lib/inngest/lead-events"),
        import("@/lib/inngest/send.server"),
      ]);
      if (saved) await trySend(leadEvents(c.orgId, saved));
      return (
        saved && {
          id: saved.id,
          company: saved.company,
          stage: saved.stage,
          deal_id: saved.deal_id,
          next_step_at: saved.next_step_at,
        }
      );
    },
  }),
  def({
    name: "create_stakeholder",
    kind: "write",
    description: `Añade un stakeholder a una cuenta. buying_role: ${Object.keys(BUYING_ROLES).join(", ")}.`,
    input: z.object({
      account_id: z.string().uuid(),
      name: z.string().min(1),
      title: z.string().optional(),
      buying_role: z.string().optional(),
      email: z.string().optional(),
    }),
    summarize: (a) => `Añadir a ${a.name}${a.title ? ` (${a.title})` : ""} como stakeholder`,
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      return ok(
        await c.db
          .from("stakeholders")
          .insert({ ...a, org_id: c.orgId })
          .select("id,name")
          .single(),
      );
    },
  }),
  def({
    name: "create_meeting",
    kind: "write",
    description: "Planifica una reunión (planificador de reuniones).",
    input: z.object({
      title: z.string().min(1),
      account_id: z.string().uuid().optional(),
      deal_id: z.string().uuid().optional(),
      scheduled_at: z.string().optional().describe("ISO 8601"),
      objective: z.string().optional(),
    }),
    summarize: (a) =>
      `Planificar la reunión «${a.title}»${a.scheduled_at ? ` el ${a.scheduled_at.slice(0, 16).replace("T", " ")}` : ""}`,
    run: async (c, a) => {
      if (a.account_id) await mustFind(c, "accounts", a.account_id, "esa cuenta");
      if (a.deal_id) await mustFind(c, "deals", a.deal_id, "ese deal");
      return ok(
        await c.db
          .from("meetings")
          .insert({ ...a, org_id: c.orgId })
          .select("id,title")
          .single(),
      );
    },
  }),
  def({
    name: "prepare_meeting_brief",
    kind: "write",
    description: "Genera con IA la preparación de llamada de una reunión y la guarda.",
    input: z.object({ meeting_id: z.string().uuid() }),
    summarize: () => "Generar y guardar la preparación de llamada de la reunión",
    run: async (c, a) => {
      const m = one(
        await c.db
          .from("meetings")
          .select("*")
          .eq("org_id", c.orgId)
          .eq("id", a.meeting_id)
          .single(),
        "la reunión",
      );
      const acc = m.account_id
        ? await CORE_READ_TOOLS.find((t) => t.name === "get_account")!.run(c, {
            account_id: m.account_id,
          })
        : {};
      const [pos, pillars] = await Promise.all([
        c.db
          .from("positioning")
          .select("one_liner,key_benefit,differentiator,competitive_alternative")
          .eq("org_id", c.orgId)
          .maybeSingle(),
        c.db.from("messaging_pillars").select("title,message,proof").eq("org_id", c.orgId),
      ]);
      const brief = await ask(
        "Eres un coach de ventas B2B. Redacta una preparación de llamada concisa en español neutro (tú), sin signos de exclamación ni emoji, en markdown: objetivo, contexto de la cuenta, stakeholders y qué le importa a cada uno, preguntas de discovery, objeciones probables con respuesta, y próximo paso a pedir. Usa solo los datos dados.",
        JSON.stringify({
          reunion: m,
          contexto: acc,
          posicionamiento: pos.data,
          pilares: pillars.data,
        }),
      );
      ok(
        await c.db
          .from("meetings")
          .update({ ai_brief: brief })
          .eq("org_id", c.orgId)
          .eq("id", a.meeting_id)
          .select("id")
          .single(),
      );
      return { ok: true, meeting: m.title };
    },
  }),
  def({
    name: "save_call_notes",
    kind: "write",
    description: `Guarda las notas de una reunión en 5 líneas (después de la llamada). Campos: ${CALL_NOTE_FIELDS.map((f) => `${f.key} = ${f.label.toLowerCase()}`).join("; ")}. Solo lo que el usuario dijo: no completes huecos. Los campos vacíos mantienen lo que ya había.`,
    input: z.object({
      meeting_id: z.string().uuid(),
      dolor: z.string().optional(),
      impacto: z.string().optional(),
      decision: z.string().optional(),
      freno: z.string().optional(),
      siguiente: z.string().optional(),
    }),
    summarize: (a) =>
      `Guardar las notas de la reunión (${filledCount(mergeCallNotes({}, a))} de 5 líneas)`,
    run: async (c, a) => {
      const { meeting_id, ...lines } = a;
      const m = one(
        await c.db
          .from("meetings")
          .select("id,title,account_id,deal_id,scheduled_at,notes,next_steps,call_notes")
          .eq("org_id", c.orgId)
          .eq("id", meeting_id)
          .single(),
        "la reunión",
      );
      const call_notes = mergeCallNotes(m.call_notes, lines);
      const log = callLogEntry({ ...m, call_notes });
      ok(
        await c.db
          .from("meetings")
          .update({
            call_notes,
            ...(call_notes.siguiente ? { next_steps: call_notes.siguiente } : {}),
          })
          .eq("org_id", c.orgId)
          .eq("id", meeting_id)
          .select("id")
          .single(),
      );
      // Same call-log row the meeting screen writes, so the account history and the call prep see it.
      if (log.hasContent)
        await c.db.from("calls").upsert({
          id: m.id,
          org_id: c.orgId,
          account_id: m.account_id,
          deal_id: m.deal_id,
          title: m.title,
          occurred_at: m.scheduled_at,
          summary: log.summary,
          next_steps: log.next_steps,
        });
      return { ok: true, meeting: m.title, lineas: filledCount(call_notes) };
    },
  }),
  def({
    name: "create_task",
    kind: "write",
    description: "Crea una tarea (opcionalmente ligada a un deal o cuenta).",
    input: z.object({
      title: z.string().min(1),
      due_date: z.string().optional(),
      deal_id: z.string().uuid().optional(),
      account_id: z.string().uuid().optional(),
      owner_id: z.string().uuid().nullable().optional(),
    }),
    summarize: (a) => `Crear la tarea «${a.title}»${a.due_date ? ` para el ${a.due_date}` : ""}`,
    run: async (c, a) => {
      if (a.deal_id) await mustFind(c, "deals", a.deal_id, "ese deal");
      if (a.account_id) await mustFind(c, "accounts", a.account_id, "esa cuenta");
      if (a.owner_id) await mustBeMember(c, a.owner_id);
      return ok(
        await c.db
          .from("tasks")
          .insert({ ...a, owner_id: a.owner_id ?? c.userId, org_id: c.orgId, source: "agent" })
          .select("id,title")
          .single(),
      );
    },
  }),
  def({
    name: "complete_task",
    kind: "write",
    description: "Marca una tarea como hecha.",
    input: z.object({ task_id: z.string().uuid() }),
    summarize: () => "Marcar la tarea como hecha",
    run: async (c, a) =>
      ok(
        await c.db
          .from("tasks")
          .update({ done: true })
          .eq("org_id", c.orgId)
          .eq("id", a.task_id)
          .select("id,title")
          .single(),
      ),
  }),
  def({
    name: "log_trial",
    kind: "write",
    description: "Registra un alta self-service (prueba) o actualiza su activación/pago por email.",
    input: z.object({
      email: z.string().min(3),
      company: z.string().optional(),
      signed_up_at: z.string().optional(),
      activated_at: z.string().optional(),
      converted_at: z.string().optional(),
      mrr: z.number().nonnegative().optional(),
    }),
    summarize: (a) => `Registrar/actualizar la prueba de ${a.email}`,
    run: async (c, a) => {
      const email = a.email.trim().toLowerCase();
      const { data: ex } = await c.db
        .from("trials")
        .select("id")
        .eq("org_id", c.orgId)
        .ilike("email", email)
        .maybeSingle();
      if (ex)
        return ok(
          await c.db
            .from("trials")
            .update({ ...a, email })
            .eq("id", ex.id)
            .select("id")
            .single(),
        );
      return ok(
        await c.db
          .from("trials")
          .insert({ ...a, email, org_id: c.orgId })
          .select("id")
          .single(),
      );
    },
  }),
  def({
    name: "create_experiment",
    kind: "write",
    description: "Crea un prototipo/experimento GTM (Theory U) con hipótesis y métrica.",
    input: z.object({
      title: z.string().min(1),
      hypothesis: z.string().optional(),
      metric: z.string().optional(),
    }),
    summarize: (a) => `Crear el prototipo «${a.title}»`,
    run: async (c, a) =>
      ok(
        await c.db
          .from("gtm_experiments")
          .insert({ ...a, org_id: c.orgId })
          .select("id,title")
          .single(),
      ),
  }),
];
