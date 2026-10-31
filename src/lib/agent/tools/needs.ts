// Need-based tools: the agent asks for what it needs and the orchestrator picks the services (src/lib/orchestrator/).
// Prefer these over the per-service tools; those stay for explicit requests («búscalo en Clay»).
import { z } from "zod";
import { ENRICH_LABEL } from "@/lib/clay";
import { countryName } from "@/lib/assignment";
import { completeAccount, findIcpCompanies, findKeyPeople, monthBudget } from "@/lib/orchestrator/runner";
import { LEVELS } from "@/lib/orchestrator/search";
import { def, type AgentTool } from "../tool-kit";

export const NEED_TOOLS: AgentTool[] = [
  def({
    name: "complete_account", kind: "read",
    description: "Completa los datos de una cuenta (sector, tamaño, país, descripción) eligiendo solo los servicios conectados más baratos y cambiando a otro si uno falla. No cambia nada: para aplicarlo usa update_account pasando en source el origen de cada cambio (campo source: apollo, clay o web). Úsala en vez de apollo_enrich_account o clay_enrich_account salvo que el usuario pida un servicio concreto.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const r = await completeAccount(c, a.account_id, "manual");
      if (r.blocked) return { mensaje: r.blocked };
      if (!r.found) return { encontrada: false, fuentes: r.sources, mensaje: "No hay datos públicos de esa empresa por su dominio." };
      return { encontrada: true, fuentes: r.sources, cambios: r.changes.map((x) => ({ campo: ENRICH_LABEL[x.field], campo_id: x.field, ahora: x.current, propuesto: x.field === "country" ? countryName(x.proposed) : x.proposed, vacio: x.empty, source: x.source })) };
    },
  }),
  def({
    name: "find_key_people", kind: "read",
    description: "Busca personas clave de una cuenta por cargo y nivel eligiendo la fuente sola (primero la gratuita, luego otra si no encuentra). Úsala en vez de apollo_find_people o clay_find_people salvo que pidan un servicio concreto. Si el resultado viene «oculto», para añadirlas usa apollo_reveal_contacts con sus apollo_id; si no, create_stakeholder.",
    input: z.object({ account_id: z.string().uuid(), titles: z.array(z.string().min(1).max(120)).max(15).optional().describe("Cargos, p. ej. «Head of Sales», «CFO»"), levels: z.array(z.enum(LEVELS)).optional() }),
    run: async (c, a) => {
      const r = await findKeyPeople(c, { accountId: a.account_id, titles: a.titles, levels: a.levels }, "manual");
      if (r.blocked) return { mensaje: r.blocked };
      return { fuentes: r.sources, oculto: r.masked, personas: r.rows.map((p) => ({ nombre: p.name, cargo: p.title, linkedin: p.linkedin, apollo_id: p.apolloId, tiene_email: p.hasEmail, ya_en_el_mapa: p.existingId })) };
    },
  }),
  def({
    name: "find_icp_companies", kind: "read",
    description: "Busca empresas nuevas que encajen con el ICP (palabras clave, países ISO, empleados) eligiendo la fuente más rápida y barata y cambiando si no encuentra. Úsala en vez de apollo_find_companies o clay_find_companies salvo que pidan un servicio concreto. Para listas largas usa start_icp_account_list. Para guardarlas usa create_account.",
    input: z.object({ keywords: z.array(z.string().min(1).max(120)).max(15).optional(), countries: z.array(z.string().min(2).max(3)).max(15).optional(), min_employees: z.number().int().min(1).optional(), max_employees: z.number().int().min(1).optional() }),
    run: async (c, a) => {
      const r = await findIcpCompanies(c, { query: { keywords: a.keywords, countries: a.countries, minEmployees: a.min_employees, maxEmployees: a.max_employees } }, "manual");
      if (r.blocked) return { mensaje: r.blocked };
      return { fuentes: r.sources, empresas: r.rows.map((x) => ({ nombre: x.name, dominio: x.domain, sector: x.industry, tamano: x.size, pais: x.country ? countryName(x.country) : null, ya_en_nokko: x.existingId })) };
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
