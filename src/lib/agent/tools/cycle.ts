// GTM cycle (BMAD): phase status and artifacts. Part of the single registry in ../tools.ts (order there is the order the model sees).
import { z } from "zod";
import { def } from "../tool-kit";
import type { AgentTool } from "../tool-kit";

export const CYCLE_TOOLS: AgentTool[] = [
  def({
    name: "get_cycle_status",
    kind: "read",
    description:
      "Estado del Ciclo GTM: fase actual, documentos (brief, plan, arquitectura, revisión, retros) aprobados y en borrador, y siguientes pasos recomendados para el rol del usuario con el agente adecuado.",
    input: z.object({}),
    run: async (c) => {
      const { loadCycleState } = await import("@/lib/bmad/cycle-state");
      const { currentPhase, nextSteps } = await import("@/lib/bmad/phases");
      const s = await loadCycleState(c.db, c.orgId);
      return {
        fase: currentPhase(s.state),
        estado: s.state,
        documentos: s.artifacts,
        siguientes_pasos: nextSteps(s.state, c.roles),
      };
    },
  }),
  def({
    name: "get_artifact",
    kind: "read",
    description:
      "Lee el contenido de un documento del Ciclo GTM por id o la última versión de un tipo (brief, plan, architecture, readiness, retro, winloss).",
    input: z.object({
      id: z.string().uuid().optional(),
      kind: z.enum(["brief", "plan", "architecture", "readiness", "retro", "winloss"]).optional(),
    }),
    run: async (c, a) => {
      let q = c.db
        .from("gtm_artifacts")
        .select("id,kind,title,version,status,content,updated_at")
        .eq("org_id", c.orgId);
      q = a.id ? q.eq("id", a.id) : q.eq("kind", a.kind ?? "plan");
      return (
        (await q.order("version", { ascending: false }).limit(1).maybeSingle()).data ?? {
          error: "No existe todavía",
        }
      );
    },
  }),
  def({
    name: "draft_artifact",
    kind: "write",
    description:
      "Genera con IA un borrador nuevo (nueva versión) de un documento del Ciclo GTM: brief, plan, architecture, readiness, retro o winloss (winloss necesita deal_id). Las notas recogen lo hablado con el usuario.",
    input: z.object({
      kind: z.enum(["brief", "plan", "architecture", "readiness", "retro", "winloss"]),
      notes: z.string().max(6000).optional(),
      deal_id: z.string().uuid().optional(),
    }),
    summarize: (a) =>
      `Crear borrador de ${({ brief: "Brief GTM", plan: "Plan GTM", architecture: "Arquitectura de revenue", readiness: "revisión antes de salir", retro: "retro trimestral", winloss: "win/loss" } as Record<string, string>)[a.kind]} en el Ciclo GTM`,
    run: async (c, a) => {
      const { draftArtifactCore } = await import("@/lib/bmad/drafting");
      return draftArtifactCore(c, {
        kind: a.kind,
        notes: a.notes ?? "",
        dealId: a.deal_id ?? null,
      });
    },
  }),
];
