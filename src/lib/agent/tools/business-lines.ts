// NK-0167 SDD 4: list_business_lines (read, any member). Uses the safe projection summarizeLines, so the annual ticket (acv)
// and any reason that carries it never reach the assistant; the label is the line's own name (company-written, no customers).
import { z } from "zod";
import { def, ok } from "../tool-kit";
import type { AgentTool } from "../tool-kit";
import { summarizeLines } from "@/lib/business-lines";

export const BUSINESS_LINE_TOOLS: AgentTool[] = [
  def({
    name: "list_business_lines",
    kind: "read",
    description: "Lista las líneas de negocio de la empresa (hasta 4) con su arquetipo GTM, motion, etapa y siguiente paso, marcando la principal. Nunca devuelve el ticket anual.",
    input: z.object({}),
    run: async (c) => {
      const rows = ok(await c.db.from("business_lines").select("id,org_id,name,is_primary,position,model,acv,friction,stage").eq("org_id", c.orgId));
      const mine = (rows ?? []).filter((r) => r.org_id === c.orgId);
      const names = new Map(mine.map((r) => [r.id, r.name]));
      return summarizeLines(mine).map((l) => ({
        nombre: names.get(l.id) ?? null, principal: l.isPrimary, arquetipo: l.archetype, motion: l.motion, etapa: l.stage, siguiente_paso: l.nextStep,
      }));
    },
  }),
];
