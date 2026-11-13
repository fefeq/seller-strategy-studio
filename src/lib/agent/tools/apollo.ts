// Apollo: people search (free), company search and enrichment (read, spend credits), and reveals
// (write: they spend credits and save emails/phones, so they wait for the user's confirmation).
// Same cores as the account and Cuentas screens (apollo-gateway.ts).
import { z } from "zod";
import { APOLLO_SENIORITY, MAX_REVEAL } from "@/lib/apollo";
import { ENRICH_LABEL } from "@/lib/clay";
import {
  enrichAccount,
  findCompanies,
  findPeople,
  revealStakeholder,
  revealToAccount,
} from "@/lib/apollo-gateway";
import { countryName } from "@/lib/assignment";
import { def, type AgentTool } from "../tool-kit";

const list = z.array(z.string().min(1).max(120)).max(15).optional();
const PAGE = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe("Página de resultados (1 por defecto)");
const phoneNote = (phone?: boolean) =>
  phone ? " y pedir su móvil (llega en unos minutos y cuesta más créditos)" : "";

export const APOLLO_TOOLS: AgentTool[] = [
  def({
    name: "apollo_find_people",
    kind: "read",
    description:
      "Busca en Apollo personas de una cuenta de Nokko por su dominio, cargo y seniority. Gratis, pero el apellido y el contacto vienen ocultos: para verlos y añadirlas al mapa usa apollo_reveal_contacts con sus apollo_id.",
    input: z.object({
      account_id: z.string().uuid(),
      titles: list.describe("Cargos, p. ej. «Head of Sales», «CFO»"),
      seniorities: z.array(z.enum(APOLLO_SENIORITY)).optional(),
      page: PAGE,
    }),
    run: async (c, a) => {
      const r = await findPeople(c, {
        accountId: a.account_id,
        page: a.page,
        query: { titles: a.titles, seniorities: a.seniorities },
      });
      return {
        cuenta: r.account,
        pagina: r.page,
        hay_mas: r.hasMore,
        personas: r.rows.map((p) => ({
          apollo_id: p.apolloId,
          nombre: p.name,
          cargo: p.title,
          tiene_email: p.hasEmail,
          tiene_telefono: p.hasPhone,
        })),
      };
    },
  }),
  def({
    name: "apollo_find_companies",
    kind: "read",
    description:
      "Busca empresas nuevas en Apollo por palabras clave, país ISO y empleados. Gasta créditos de Apollo por página: pide solo las páginas necesarias. Marca las que ya están en Nokko; para guardarlas usa create_account.",
    input: z.object({
      keywords: list.describe("Palabras clave del sector o producto (mejor en inglés)"),
      countries: list.describe("Códigos ISO de país (ES, MX, US…)"),
      min_employees: z.number().int().min(1).optional(),
      max_employees: z.number().int().min(1).optional(),
      page: PAGE,
    }),
    run: async (c, a) => {
      const r = await findCompanies(c, {
        page: a.page,
        query: {
          keywords: a.keywords,
          countries: a.countries,
          minEmployees: a.min_employees,
          maxEmployees: a.max_employees,
        },
      });
      return {
        pagina: r.page,
        hay_mas: r.hasMore,
        empresas: r.rows.map((x) => ({
          nombre: x.name,
          dominio: x.domain,
          sector: x.industry,
          tamano: x.size,
          pais: x.country ? countryName(x.country) : null,
          pais_iso: x.country,
          ubicacion: x.location,
          linkedin: x.linkedin,
          ya_en_nokko: x.existingId,
        })),
      };
    },
  }),
  def({
    name: "apollo_enrich_account",
    kind: "read",
    description:
      "Consulta en Apollo los datos de una cuenta por su dominio (sector, tamaño, país, descripción) y dice qué campos están vacíos o son distintos. No cambia nada: para aplicarlo usa update_account con source: apollo. Gasta 1 crédito de Apollo.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const r = await enrichAccount(c, a.account_id);
      if (!r.found)
        return {
          encontrada: false,
          mensaje: "Apollo no tiene datos de esa empresa por su dominio.",
        };
      return {
        encontrada: true,
        empresa: r.company,
        cambios: r.changes.map((x) => ({
          campo: ENRICH_LABEL[x.field],
          columna: x.field,
          actual: x.current,
          apollo: x.field === "country" ? `${countryName(x.proposed)} (${x.proposed})` : x.proposed,
          vacio_en_nokko: x.empty,
          source: "apollo",
        })),
      };
    },
  }),
  def({
    name: "apollo_reveal_contacts",
    kind: "write",
    description: `Revela con Apollo (nombre completo, email, LinkedIn) hasta ${MAX_REVEAL} personas encontradas con apollo_find_people y las añade al mapa de stakeholders de la cuenta (o completa las que ya estén). Opcional: pedir también el móvil. Gasta créditos por persona.`,
    input: z.object({
      account_id: z.string().uuid(),
      apollo_ids: z
        .array(z.string().regex(/^[A-Za-z0-9]{6,64}$/))
        .min(1)
        .max(MAX_REVEAL),
      phone: z.boolean().optional(),
    }),
    summarize: (a) =>
      `Revelar con Apollo ${a.apollo_ids.length} ${a.apollo_ids.length === 1 ? "persona" : "personas"} y añadirlas al mapa de la cuenta${phoneNote(a.phone)}`,
    run: async (c, a) => {
      const r = await revealToAccount(c, {
        accountId: a.account_id,
        apolloIds: a.apollo_ids,
        phone: a.phone,
      });
      const emails = r.filter((x) => x.contact.email).length;
      return {
        mensaje: `${r.length} reveladas (${emails} con email)${a.phone ? "; los móviles llegarán en unos minutos" : ""}.`,
        personas: r.map((x) => ({
          nombre: x.contact.name,
          cargo: x.contact.title,
          email: x.contact.email,
          linkedin: x.contact.linkedin_url,
          stakeholder_id: x.stakeholderId,
          nueva: x.created,
        })),
      };
    },
  }),
  def({
    name: "apollo_reveal_stakeholder",
    kind: "write",
    description:
      "Revela con Apollo el email (y si se pide, el móvil) de un stakeholder que ya está en un mapa y lo guarda en su ficha. Gasta créditos; el móvil llega en unos minutos y, si ya se pidió antes, se reutiliza sin coste.",
    input: z.object({ stakeholder_id: z.string().uuid(), phone: z.boolean().optional() }),
    summarize: (a) => `Revelar con Apollo el email${phoneNote(a.phone)} de un stakeholder`,
    run: async (c, a) => {
      const r = await revealStakeholder(c, { stakeholderId: a.stakeholder_id, phone: a.phone });
      if (!r.found) return { mensaje: "Apollo no ha encontrado a esa persona." };
      const parts = [
        r.contact?.email ? `email ${r.contact.email}` : r.contact ? "sin email disponible" : null,
        r.phone === "cached"
          ? `móvil ${r.phoneNumber}`
          : r.phone === "pending"
            ? "el móvil ya estaba pedido y llegará en unos minutos"
            : r.phone === "requested"
              ? "el móvil llegará en unos minutos"
              : null,
        r.proposedEmail
          ? `Apollo propone otro email: ${r.proposedEmail}. No lo he cambiado; edítalo tú si quieres usarlo`
          : null,
      ].filter(Boolean);
      return { mensaje: `Apollo: ${parts.join("; ")}.` };
    },
  }),
];
