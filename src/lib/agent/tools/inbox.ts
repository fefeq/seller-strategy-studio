// Tasks, proactive suggestions and approvals. Visibility and decision rights mirror the database rules,
// because Telegram runs these with the privileged client: members act on their own and unassigned
// suggestions, Owner/Sales Leader on all; only Owner, Sales Leader and Deal Desk decide approvals.
import { z } from "zod";
import { DATE_ARG, clip, def, defined, mustBeMember, mustFind, ok, resolveStage, type AgentTool } from "../tool-kit";

export const INBOX_TOOLS: AgentTool[] = [
  def({
    name: "update_task", kind: "write",
    description: "Actualiza una tarea: título, fecha (AAAA-MM-DD o null), responsable (miembro del equipo o null), notas, o la reabre con done = false.",
    input: z.object({ task_id: z.string().uuid(), title: z.string().min(1).max(300).optional(), due_date: DATE_ARG.nullable().optional(), owner_id: z.string().uuid().nullable().optional(), notes: z.string().max(4000).optional(), done: z.boolean().optional() }),
    summarize: (a) => `Actualizar la tarea: ${Object.keys(defined({ ...a, task_id: undefined })).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      const { task_id, ...rest } = a;
      await mustFind(c, "tasks", task_id, "esa tarea");
      if (rest.owner_id) await mustBeMember(c, rest.owner_id);
      const patch = defined(rest);
      if (!Object.keys(patch).length) throw new Error("No has indicado qué cambiar de la tarea.");
      return ok(await c.db.from("tasks").update(patch).eq("org_id", c.orgId).eq("id", task_id).select("id,title,due_date,done").single());
    },
  }),
  def({
    name: "decide_suggestion", kind: "write",
    description: "Gestiona una sugerencia pendiente (ids de list_suggestions): approve ejecuta su acción si tiene una (o la marca hecha), snooze la pospone 3 días y dismiss la descarta para siempre.",
    input: z.object({ suggestion_id: z.string().uuid(), decision: z.enum(["approve", "snooze", "dismiss"]) }),
    summarize: (a) => ({ approve: "Aprobar la sugerencia", snooze: "Posponer la sugerencia 3 días", dismiss: "Descartar la sugerencia" })[a.decision],
    run: async (c, a) => {
      const { decideSuggestionCore } = await import("@/lib/agent.functions");
      const r = await decideSuggestionCore(c, a.suggestion_id, a.decision);
      return { ...r, ...(r.message === "Hecho" ? {} : { mensaje: r.message }) };
    },
  }),
  def({
    name: "assign_suggestion", kind: "write", roles: ["owner", "sales_leader"],
    description: "Asigna una sugerencia a un miembro del equipo (user_id) o la deja sin asignar (null), como el panel de equipo de Sugerencias.",
    input: z.object({ suggestion_id: z.string().uuid(), user_id: z.string().uuid().nullable() }),
    summarize: (a) => (a.user_id ? "Asignar la sugerencia a un miembro del equipo" : "Dejar la sugerencia sin asignar"),
    run: async (c, a) => {
      await mustFind(c, "suggestions", a.suggestion_id, "esa sugerencia");
      if (a.user_id) await mustBeMember(c, a.user_id);
      return ok(await c.db.from("suggestions").update({ user_id: a.user_id }).eq("org_id", c.orgId).eq("id", a.suggestion_id).select("id,title").single());
    },
  }),
  def({
    name: "list_approvals", kind: "read",
    description: "Aprobaciones (cambios importantes con evidencia): pendientes por defecto, o aplicadas u omitidas. Incluye si el usuario puede decidirlas.",
    input: z.object({ status: z.enum(["pending", "applied", "skipped"]).optional() }),
    run: async (c, a) => {
      const rows = ok(await c.db.from("approvals").select("id,kind,title,evidence,status,created_at").eq("org_id", c.orgId).eq("status", a.status ?? "pending").order("created_at", { ascending: false }).limit(30));
      return { puedes_decidir: c.roles.some((r) => r === "owner" || r === "sales_leader" || r === "deal_desk"), aprobaciones: (rows ?? []).map((x) => ({ id: x.id, tipo: x.kind, titulo: x.title, evidencia: clip(x.evidence, 800), estado: x.status, fecha: x.created_at })) };
    },
  }),
  def({
    name: "decide_approval", kind: "write", roles: ["owner", "sales_leader", "deal_desk"],
    description: "Aplica u omite una aprobación pendiente. Aplicar un cambio de etapa (p. ej. pasar a Ganado) mueve el deal.",
    input: z.object({ approval_id: z.string().uuid(), decision: z.enum(["apply", "skip"]) }),
    summarize: (a) => (a.decision === "apply" ? "Aplicar la aprobación" : "Omitir la aprobación"),
    run: async (c, a) => {
      const ap = await mustFind<{ id: string; kind: string; title: string; evidence: string | null; status: string }>(c, "approvals", a.approval_id, "esa aprobación", "id,kind,title,evidence,status");
      if (ap.status !== "pending") return { estado: ap.status, mensaje: "Esa aprobación ya estaba decidida." };
      const status = a.decision === "apply" ? "applied" : "skipped";
      // Claim first: a double confirmation cannot apply it twice, and nothing moves if the decision is refused.
      const claimed = ok(await c.db.from("approvals").update({ status }).eq("org_id", c.orgId).eq("id", ap.id).eq("status", "pending").select("id"));
      if (!claimed?.length) return { estado: status, mensaje: "Esa aprobación ya estaba decidida." };
      if (status === "applied" && ap.kind === "stage_change") {
        // Like the Aprobaciones screen: evidence that is not structured is applied as a plain decision.
        let p: { deal_id?: string; stage?: string } = {};
        try { p = JSON.parse(ap.evidence ?? "{}"); } catch { /* evidence not structured */ }
        if (p.deal_id && p.stage) {
          try {
            const st = await resolveStage(c, p.stage);
            ok(await c.db.from("deals").update({ stage: st.key, probability: st.probability }).eq("org_id", c.orgId).eq("id", p.deal_id).select("id").single());
          } catch (e) {
            const back = await c.db.from("approvals").update({ status: "pending" }).eq("org_id", c.orgId).eq("id", ap.id);
            throw new Error(back.error
              ? `No se ha podido mover el deal y la aprobación ha quedado como aplicada: revísala en Aprobaciones. ${(e as Error).message}`
              : `No se ha podido mover el deal; la aprobación sigue pendiente. ${(e as Error).message}`);
          }
        }
      }
      return { estado: status, mensaje: status === "applied" ? `Aplicada: ${ap.title}` : `Omitida: ${ap.title}` };
    },
  }),
  def({
    name: "request_approval", kind: "write",
    description: "Pide una aprobación con evidencia (p. ej. un descuento para Deal Desk). Para pasar un deal a Ganado usa update_deal: la aprobación se crea sola.",
    input: z.object({ kind: z.enum(["discount", "other"]), title: z.string().min(1).max(300), evidence: z.string().max(4000).optional() }),
    summarize: (a) => `Pedir aprobación: «${a.title}»`,
    run: async (c, a) => ok(await c.db.from("approvals").insert({ org_id: c.orgId, kind: a.kind, title: a.title, evidence: a.evidence ?? null }).select("id,title").single()),
  }),
];

