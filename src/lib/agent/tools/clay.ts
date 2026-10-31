// Clay: find companies (prospecting), find a company's people (stakeholders) and propose account data.
// All three only read; saving goes through create_account / create_stakeholder / update_account, so it
// stays pending until the user confirms. Same cores as the Cuentas and account screens (clay-gateway.ts).
import { z } from "zod";
import { CLAY_REVENUES, CLAY_SENIORITY, ENRICH_LABEL, MAX_PAGE, quotaText } from "@/lib/clay";
import { enrichAccount, findCompanies, findPeople } from "@/lib/clay-gateway";
import { countryName } from "@/lib/assignment";
import { def, type AgentTool } from "../tool-kit";

const list = z.array(z.string().min(1).max(120)).max(15).optional();
const SEARCH_ID = z
  .string()
  .regex(/^[A-Za-z0-9_-]{4,80}$/, "search_id no válido")
  .optional()
  .describe("search_id de una búsqueda anterior para traer los siguientes resultados");
const LIMIT = z
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE)
  .optional()
  .describe(`Resultados a traer (1–${MAX_PAGE}, por defecto 10). Cada uno gasta cupo de Clay.`);

export const CLAY_TOOLS: AgentTool[] = [
  def({
    name: "clay_find_companies",
    kind: "read",
    description:
      "Busca empresas nuevas en Clay para prospectar (por palabras clave en su descripción, sector de LinkedIn en inglés, país ISO, empleados e ingresos). Marca las que ya están en Nokko. Gasta cupo de Clay: pide pocos resultados. Para guardarlas usa create_account; para más resultados repite con search_id.",
    input: z.object({
      keywords: list.describe("Palabras clave en la descripción de la empresa (mejor en inglés)"),
      industries: list.describe(
        "Sectores de LinkedIn en inglés, p. ej. «Software Development», «Financial Services»",
      ),
      countries: list.describe("Códigos ISO de país (ES, MX, US…)"),
      min_employees: z.number().int().min(1).optional(),
      max_employees: z.number().int().min(1).optional(),
      revenues: z
        .array(z.enum(CLAY_REVENUES))
        .optional()
        .describe("Rangos de ingresos anuales en USD"),
      search_id: SEARCH_ID,
      limit: LIMIT,
    }),
    run: async (c, a) => {
      const r = await findCompanies(c, {
        searchId: a.search_id,
        limit: a.limit,
        query: {
          keywords: a.keywords,
          industries: a.industries,
          countries: a.countries,
          minEmployees: a.min_employees,
          maxEmployees: a.max_employees,
          revenues: a.revenues,
        },
      });
      return {
        search_id: r.searchId,
        hay_mas: r.hasMore,
        cupo: quotaText(r.quota),
        empresas: r.rows.map((x) => ({
          nombre: x.name,
          dominio: x.domain,
          sector: x.industry,
          tamano: x.size,
          pais: x.country ? countryName(x.country) : null,
          pais_iso: x.country,
          ubicacion: x.location,
          ingresos: x.revenue,
          linkedin: x.linkedin,
          descripcion: x.description?.slice(0, 300) ?? null,
          ya_en_nokko: x.existingId,
        })),
      };
    },
  }),
  def({
    name: "clay_find_people",
    kind: "read",
    description:
      "Busca en Clay personas de una cuenta de Nokko (por su dominio): cargos y seniority. Marca las que ya están en su mapa de stakeholders. Gasta cupo de Clay. Para añadirlas usa create_stakeholder con nombre, cargo y LinkedIn.",
    input: z.object({
      account_id: z.string().uuid(),
      titles: list.describe("Palabras del cargo, p. ej. «Sales», «Revenue», «CFO»"),
      seniority: z.array(z.enum(CLAY_SENIORITY)).optional(),
      countries: list.describe("Códigos ISO de país donde trabaja la persona"),
      search_id: SEARCH_ID,
      limit: LIMIT,
    }),
    run: async (c, a) => {
      const r = await findPeople(c, {
        accountId: a.account_id,
        searchId: a.search_id,
        limit: a.limit,
        query: { titles: a.titles, seniority: a.seniority, countries: a.countries },
      });
      return {
        cuenta: r.account,
        search_id: r.searchId,
        hay_mas: r.hasMore,
        cupo: quotaText(r.quota),
        personas: r.rows.map((p) => ({
          nombre: p.name,
          cargo: p.title,
          linkedin: p.linkedin_url,
          ubicacion: p.location,
          ya_en_el_mapa: p.existingId,
        })),
      };
    },
  }),
  def({
    name: "clay_enrich_account",
    kind: "read",
    description:
      "Consulta en Clay los datos de una cuenta de Nokko por su dominio (sector, tamaño, país, descripción) y dice qué campos están vacíos o son distintos. No cambia nada: para aplicarlo usa update_account con source: clay (sector→industry, tamaño→size, país→country, descripción→notes), preferiblemente solo con los vacíos. Gasta 1 de cupo de Clay.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const r = await enrichAccount(c, a.account_id);
      if (!r.found)
        return {
          encontrada: false,
          mensaje: "Clay no tiene datos de esa empresa por su dominio.",
          cupo: quotaText(r.quota),
        };
      return {
        encontrada: true,
        cupo: quotaText(r.quota),
        empresa: r.company,
        cambios: r.changes.map((x) => ({
          campo: ENRICH_LABEL[x.field],
          columna: x.field,
          actual: x.current,
          clay: x.field === "country" ? `${countryName(x.proposed)} (${x.proposed})` : x.proposed,
          vacio_en_nokko: x.empty,
          source: "clay",
        })),
      };
    },
  }),
];
