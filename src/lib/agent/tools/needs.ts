// Need-based tools: the agent asks for what it needs and the orchestrator picks the services (src/lib/orchestrator/).
// Prefer these over the per-service tools; those stay for explicit requests («búscalo en Clay»).
import { z } from "zod";
import { ENRICH_LABEL } from "@/lib/clay";
import { countryName } from "@/lib/assignment";
import { completeAccount, monthBudget } from "@/lib/orchestrator/runner";
import { def, type AgentTool } from "../tool-kit";

export const NEED_TOOLS: AgentTool[] = [
  def({
    name: "complete_account", kind: "read",
    description: "Completa los datos de una cuenta (sector, tamaño, país, descripción) eligiendo solo los servicios conectados más baratos y cambiando a otro si uno falla. No cambia nada: para aplicarlo usa update_account. Úsala en vez de apollo_enrich_account o clay_enrich_account salvo que el usuario pida un servicio concreto.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const r = await completeAccount(c, a.account_id, "manual");
      if (r.blocked) return { mensaje: r.blocked };
      if (!r.found) return { encontrada: false, fuentes: r.sources, mensaje: "No hay datos públicos de esa empresa por su dominio." };
      return { encontrada: true, fuentes: r.sources, cambios: r.changes.map((x) => ({ campo: ENRICH_LABEL[x.field], campo_id: x.field, ahora: x.current, propuesto: x.field === "country" ? countryName(x.proposed) : x.proposed, vacio: x.empty })) };
    },
  }),
  def({
    name: "integration_budget", kind: "read",
    description: "Gasto aproximado en integraciones este mes, el límite mensual de la empresa y si lo automático está en pausa.",
    input: z.object({}),
    run: async (c) => {
      const b = await monthBudget(c);
      return { gastado_eur: Math.round(b.spent * 100) / 100, limite_eur: b.limit, aviso_80: b.warn, automatico_en_pausa: b.paused };
    },
  }),
];
