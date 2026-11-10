// Accounts, account plans, touches, stakeholders and people: the same writes the account screen,
// ABM and Personas make, and the same score the Cuentas list sorts by.
import { z } from "zod";
import { RULES_READ_FAILED } from "@/lib/knowledge-rules";
import { BUYING_ROLES, SUPPORT } from "@/lib/roles";
import { countryName } from "@/lib/assignment";
import { byScore, fitText, latestOf, scoreAccount } from "@/lib/scoring";
import { normalizeForSave } from "@/lib/field-normalize";
import { ACCOUNT_SOURCES, keepUnreadable, stampConfirmed } from "@/lib/provenance";
import { dedupePeople, normEmail, normLinkedin } from "@/lib/dedupe";
import {
  HEALTH,
  clearable,
  def,
  defined,
  like,
  mustFind,
  ok,
  type AgentTool,
  type ToolCtx,
} from "../tool-kit";

const TOUCH_CHANNELS = [
  "web_visit",
  "email",
  "linkedin",
  "direct_mail",
  "event",
  "call",
  "meeting",
] as const;
const CRM_STAGES = ["lead", "mql", "sql", "opportunity", "customer", "disqualified"] as const;
const SEQUENCE_STAGES = ["none", "active", "finished", "paused"] as const;
const PLAN_FIELDS = [
  "current_state",
  "pains",
  "objectives",
  "initiatives",
  "whitespace",
  "risks",
  "competitors",
  "action_plan",
] as const;
// An ISO code or a name: the single rule decides at proposal time (agent, MCP and Telegram all parse with this schema), and run checks again.
const COUNTRY = z
  .string()
  .max(100)
  .refine((v) => normalizeForSave("accounts", "country", v).status === "ok", {
    error: (i) =>
      `País no reconocido: «${String(i.input).trim()}». Usa el código ISO de 2 letras o el nombre (ES, España, MX, US…).`,
  });
const optText = z.string().max(4000).optional();
// Columns of accounts that carry an origin mark (accounts.field_sources, migration 0058).
const TRACKED = ["industry", "size", "country", "notes"] as const; // update_account's share of the tracked columns (linkedin_url: apify-core)
/** The value as it would be saved, for comparing: «Spain» and «ES» are the same country, case and spaces do not count. */
const canonical = (col: (typeof TRACKED)[number], v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return "";
  const n = col === "size" || col === "country" ? normalizeForSave("accounts", col, t).value : t;
  return String(n ?? "")
    .trim()
    .toLowerCase();
};

async function segmentNames(c: ToolCtx) {
  const { data } = await c.db.from("segments").select("id,name").eq("org_id", c.orgId);
  return new Map((data ?? []).map((s) => [s.id, s.name]));
}

export const ACCOUNT_TOOLS: AgentTool[] = [
  def({
    name: "list_pending_imports",
    kind: "read",
    description:
      "Lista los lotes de leads o cuentas que han enviado herramientas externas (Sales Navigator, HubSpot, Make…) y esperan revisión en Leads → Entrada, con sus filas y qué pasaría con cada una. Solo lectura: aprobar o descartar lo hace una persona en esa pantalla.",
    input: z.object({ limit: z.number().int().min(1).max(20).optional() }),
    run: async (c, a) => {
      const { data, error } = await c.db
        .from("import_batches")
        .select("id,kind,status,row_count,created_at,lead_source_id")
        .eq("org_id", c.orgId)
        .in("status", ["pending", "partial"])
        .order("created_at", { ascending: false })
        .limit(a.limit ?? 10);
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((b) => b.id);
      const { data: rows } = ids.length
        ? await c.db
            .from("import_rows")
            .select("batch_id,line,summary,action,reason,status")
            .eq("org_id", c.orgId)
            .in("batch_id", ids)
            .order("line")
            .limit(300)
        : { data: [] };
      return {
        lotes: (data ?? []).map((b) => ({
          id: b.id,
          tipo: b.kind === "accounts" ? "cuentas" : "leads",
          estado: b.status,
          filas: b.row_count,
          recibido: b.created_at,
          muestra: (rows ?? [])
            .filter((r) => r.batch_id === b.id)
            .slice(0, 15)
            .map((r) => ({
              fila: r.line,
              registro: r.summary,
              entra: r.action !== "skip",
              motivo: r.reason,
              estado: r.status,
            })),
        })),
        donde_aprobar: "/leads/entrada",
      };
    },
  }),
  def({
    name: "list_accounts",
    kind: "read",
    description:
      "Lista cuentas ordenadas por puntuación (encaje con el ICP 70 % + actividad 30 %, como la pantalla Cuentas). Filtros: texto, segmento, tier (A/B/C), solo mías o sin propietario, solo objetivo ABM y cuentas a las que les falta un dato (segmento, sector, tamaño o país).",
    input: z.object({
      query: z.string().optional(),
      segment_id: z.string().uuid().optional(),
      tier: z.enum(["A", "B", "C"]).optional(),
      owner: z.enum(["mine", "unowned"]).optional(),
      target_only: z.boolean().optional(),
      missing: z.enum(["segment", "industry", "size", "country"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (c, a) => {
      let q = c.db
        .from("accounts")
        .select(
          "id,name,domain,industry,size,country,tier,abm_tier,health,is_target,owner_id,segment_id, deals(amount,stage,updated_at), account_touches(occurred_at), meetings(scheduled_at), calls(occurred_at)",
        )
        .eq("org_id", c.orgId);
      if (a.query) q = q.or(`name.ilike.${like(a.query)},domain.ilike.${like(a.query)}`);
      if (a.segment_id) q = q.eq("segment_id", a.segment_id);
      if (a.tier) q = q.eq("tier", a.tier);
      if (a.owner === "mine") q = q.eq("owner_id", c.userId);
      if (a.owner === "unowned") q = q.is("owner_id", null);
      if (a.target_only) q = q.eq("is_target", true);
      if (a.missing) q = q.is(a.missing === "segment" ? "segment_id" : a.missing, null);
      const [rows, icp, names] = await Promise.all([
        q.limit(1000),
        c.db
          .from("icp_profiles")
          .select(
            "id,segment_id,industries,company_size,geography,anti_icp,min_employees,max_employees,search_keywords",
          )
          .eq("org_id", c.orgId),
        segmentNames(c),
      ]);
      if (rows.error) throw new Error(rows.error.message);
      const now = new Date();
      const today = now.toISOString();
      const scored = (rows.data ?? []).map((x) => {
        const deals = (x.deals ?? []) as {
          amount: number | null;
          stage: string;
          updated_at: string;
        }[];
        const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
        // Same activity rule as the Cuentas screen: touches, past meetings, calls and deal updates.
        const lastActivityAt = latestOf(
          ...(x.account_touches ?? []).map((t: { occurred_at: string }) => t.occurred_at),
          ...(x.meetings ?? [])
            .map((m: { scheduled_at: string | null }) => m.scheduled_at)
            .filter((d: string | null): d is string => !!d && d <= today),
          ...(x.calls ?? []).map((k: { occurred_at: string | null }) => k.occurred_at),
          ...deals.map((d) => d.updated_at),
        );
        return {
          x,
          open,
          lastActivityAt,
          score: scoreAccount(
            { ...x, lastActivityAt, openDeals: open.length },
            icp.data ?? [],
            now,
            names,
          ),
        };
      });
      return scored
        .sort(byScore((r) => r.score))
        .slice(0, a.limit ?? 30)
        .map(({ x, open, lastActivityAt, score }) => ({
          id: x.id,
          nombre: x.name,
          dominio: x.domain,
          segmento: x.segment_id ? (names.get(x.segment_id) ?? null) : null,
          sector: x.industry,
          tamano: x.size,
          pais: x.country ? countryName(x.country) : null,
          tier: x.tier,
          tier_abm: x.abm_tier,
          salud: x.health,
          objetivo_abm: x.is_target,
          propietario_id: x.owner_id,
          puntuacion: score.total,
          encaje_icp: score.total == null ? "sin datos" : fitText(score.fit),
          actividad: score.activity,
          deals_abiertos: open.length,
          importe_abierto: open.reduce((s, d) => s + Number(d.amount ?? 0), 0),
          ultima_actividad: lastActivityAt,
        }));
    },
  }),
  def({
    name: "update_account",
    kind: "write",
    description:
      "Actualiza datos de una cuenta: nombre, dominio, sector, tamaño, país (código ISO de 2 letras o nombre, p. ej. «España»), segmento, tier (A/B/C), tier ABM (1 = 1:1, 2 = 1:few, 3 = 1:many), salud (green/yellow/red), objetivo ABM y notas. El propietario se cambia con el reparto de cuentas, no aquí. Si el valor viene de un proveedor, pasa su origen en source (apollo, clay, parallel o web); sin source se guarda como ia.",
    input: z.object({
      account_id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      domain: clearable(200),
      industry: clearable(200),
      size: clearable(100),
      country: COUNTRY.nullable().optional(),
      segment_id: z.string().uuid().nullable().optional(),
      tier: z.enum(["A", "B", "C"]).optional(),
      abm_tier: z.enum(["1", "2", "3"]).optional(),
      health: HEALTH.optional(),
      is_target: z.boolean().optional(),
      notes: clearable(4000),
      source: z
        .enum(ACCOUNT_SOURCES)
        .optional()
        .describe("Origen del valor: ia (por defecto), apollo, clay, parallel o web"),
    }),
    summarize: (a) => {
      const changed = Object.keys(defined({ ...a, account_id: undefined, source: undefined }));
      return `Actualizar la cuenta: ${changed.join(", ") || "sin cambios"}`;
    },
    run: async (c, a) => {
      const { account_id, source, ...patch } = a;
      // The current values and marks are read right before writing: the origin of what does not change is kept.
      const cur = await mustFind<Record<string, unknown>>(
        c,
        "accounts",
        account_id,
        "esa cuenta",
        `id,name,${TRACKED.join(",")},field_sources`,
      );
      if (patch.segment_id) await mustFind(c, "segments", patch.segment_id, "ese segmento");
      const p = defined(patch);
      if (!Object.keys(p).length) throw new Error("No has indicado qué cambiar de la cuenta.");
      // Size and country go through the one rule (SDD universal-field-definitions, CA-1/CA-3).
      // A size that is not a headcount is kept as written, with a warning; an unknown country is refused before anything is written.
      const warnings: Partial<Record<(typeof TRACKED)[number], string>> = {};
      for (const col of ["size", "country"] as const) {
        if (p[col] === undefined) continue;
        const n = normalizeForSave("accounts", col, p[col]);
        if (n.status === "unnormalized") {
          if (col === "country")
            throw new Error(`País no reconocido: «${n.original}». ${n.reason}`);
          warnings.size = `Tamaño «${n.original}». ${n.reason}`;
        }
        p[col] = n.value as string | null;
      }
      // Origin (SDD field-sources-on-tracked-writers U-3): a tracked field whose value changes is marked with its real
      // source, confirmed by whoever approved this action; a cleared one loses its mark; an equal value keeps its mark.
      // Without this, trigger 0058 would stamp a signed-in caller as «persona».
      const same = (col: (typeof TRACKED)[number]) =>
        canonical(col, cur[col]) === canonical(col, p[col]);
      // A filled field written again with an equal value is not written at all: the trigger would see a changed raw
      // value («fintech» vs «Fintech») with no field_sources change and stamp «persona» over the existing mark.
      // Its warning goes with it: a field that is not written must not say «se guarda como lo escribiste».
      for (const col of TRACKED)
        if (p[col] !== undefined && canonical(col, p[col]) && same(col)) {
          delete p[col];
          delete warnings[col];
        }
      // Nothing left to write: say so, the person must not be told it was saved.
      if (!Object.keys(p).length)
        return {
          id: cur.id,
          name: cur.name,
          mensaje: "Sin cambios: la cuenta ya tenía esos valores y no se ha guardado nada.",
        };
      const changed = TRACKED.filter((col) => p[col] !== undefined && !same(col));
      const cleared = changed.filter((col) => p[col] === null);
      const at = new Date().toISOString();
      const marks = keepUnreadable(
        cur.field_sources,
        stampConfirmed(
          cur.field_sources,
          changed
            .filter((col) => !cleared.includes(col))
            .map((field) => ({ field, source: source ?? "ia" })),
          c.userId,
          at,
        ),
        cleared,
      );
      const withMarks =
        changed.length && JSON.stringify(marks) !== JSON.stringify(cur.field_sources ?? {});
      const row = ok(
        await c.db
          .from("accounts")
          .update((withMarks ? { ...p, field_sources: marks } : p) as never)
          .eq("org_id", c.orgId)
          .eq("id", account_id)
          .select("id,name")
          .single(),
      );
      const notices = Object.values(warnings);
      return notices.length ? { ...row, mensaje: notices.join(" ") } : row;
    },
  }),
  def({
    name: "log_touch",
    kind: "write",
    description: `Registra un toque con una cuenta (cuenta para la actividad de la puntuación y el engagement ABM). Canales: ${TOUCH_CHANNELS.join(", ")}.`,
    input: z.object({
      account_id: z.string().uuid(),
      channel: z.enum(TOUCH_CHANNELS),
      notes: optText,
      occurred_at: z.string().optional().describe("ISO 8601; por defecto, ahora"),
    }),
    summarize: (a) =>
      `Registrar un toque por ${a.channel}${a.notes ? `: «${a.notes.slice(0, 60)}»` : ""}`,
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      return ok(
        await c.db
          .from("account_touches")
          .insert({
            org_id: c.orgId,
            account_id: a.account_id,
            channel: a.channel,
            notes: a.notes ?? null,
            ...(a.occurred_at ? { occurred_at: a.occurred_at } : {}),
          })
          .select("id")
          .single(),
      );
    },
  }),
  def({
    name: "upsert_account_plan",
    kind: "write",
    description: `Guarda campos del plan de cuenta (los que no se indican se mantienen): ${PLAN_FIELDS.join(", ")}.`,
    input: z.object({
      account_id: z.string().uuid(),
      ...(Object.fromEntries(PLAN_FIELDS.map((f) => [f, optText])) as Record<
        (typeof PLAN_FIELDS)[number],
        typeof optText
      >),
    }),
    summarize: (a) =>
      `Guardar el plan de cuenta: ${PLAN_FIELDS.filter((f) => a[f] !== undefined).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      const { account_id, ...fields } = a;
      await mustFind(c, "accounts", account_id, "esa cuenta");
      const patch = defined(fields);
      if (!Object.keys(patch).length)
        throw new Error("No has indicado qué guardar del plan de cuenta.");
      const { data: ex } = await c.db
        .from("account_plans")
        .select("id")
        .eq("org_id", c.orgId)
        .eq("account_id", account_id)
        .maybeSingle();
      if (ex)
        return ok(
          await c.db
            .from("account_plans")
            .update(patch)
            .eq("org_id", c.orgId)
            .eq("id", ex.id)
            .select("id")
            .single(),
        );
      return ok(
        await c.db
          .from("account_plans")
          .insert({ ...patch, account_id, org_id: c.orgId })
          .select("id")
          .single(),
      );
    },
  }),
  def({
    name: "update_stakeholder",
    kind: "write",
    description: `Actualiza un stakeholder: nombre, cargo, email, LinkedIn, rol de compra (${Object.keys(BUYING_ROLES).join(", ")}), apoyo (${Object.keys(SUPPORT).join(", ")}), prioridades y a quién reporta (otro stakeholder de la misma cuenta).`,
    input: z.object({
      stakeholder_id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      title: z.string().max(200).optional(),
      email: z.string().max(200).optional(),
      linkedin_url: z.string().max(500).optional(),
      buying_role: z.enum(Object.keys(BUYING_ROLES) as [string, ...string[]]).optional(),
      support: z.enum(Object.keys(SUPPORT) as [string, ...string[]]).optional(),
      priorities: optText,
      reports_to: z.string().uuid().nullable().optional(),
    }),
    summarize: (a) =>
      `Actualizar el stakeholder: ${Object.keys(defined({ ...a, stakeholder_id: undefined })).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      const { stakeholder_id, ...patch } = a;
      const s = await mustFind<{ id: string; account_id: string }>(
        c,
        "stakeholders",
        stakeholder_id,
        "ese stakeholder",
        "id,account_id",
      );
      if (patch.reports_to) {
        const boss = await mustFind<{ account_id: string }>(
          c,
          "stakeholders",
          patch.reports_to,
          "la persona a la que reporta",
          "id,account_id",
        );
        if (boss.account_id !== s.account_id || patch.reports_to === stakeholder_id)
          throw new Error("Solo puede reportar a otro stakeholder de la misma cuenta.");
      }
      const p = defined(patch);
      if (!Object.keys(p).length) throw new Error("No has indicado qué cambiar del stakeholder.");
      return ok(
        await c.db
          .from("stakeholders")
          .update(p)
          .eq("org_id", c.orgId)
          .eq("id", stakeholder_id)
          .select("id,name")
          .single(),
      );
    },
  }),
  def({
    name: "research_stakeholder",
    kind: "write",
    description:
      "Investigación de stakeholders: busca a la persona en internet, resume lo que dicen las fuentes con sus enlaces y añade prioridades probables, encaje de la propuesta, riesgos y 3 aperturas de conversación (lo no comprobado, como hipótesis). Se guarda en el stakeholder.",
    input: z.object({ stakeholder_id: z.string().uuid() }),
    summarize: () => "Investigar al stakeholder con IA y guardar el resultado",
    run: async (c, a) => {
      await mustFind(c, "stakeholders", a.stakeholder_id, "ese stakeholder");
      const { researchStakeholderCore } = await import("@/lib/ai-core");
      // The agent answers a person (app chat or Telegram): an «Escalar» rule stops and asks (NK-0128, CA-8).
      const r = await researchStakeholderCore(
        c.db,
        a.stakeholder_id,
        { orgId: c.orgId, userId: c.userId },
        { withPerson: true },
      );
      // A failed read of the rules is never silent (SDD-20261109-rules-in-ai-readers, CA-4).
      const done = `Investigación de ${r.name} guardada en su ficha.`;
      return { ok: true, mensaje: r.rulesRead ? done : `${done} ${RULES_READ_FAILED}` };
    },
  }),
  def({
    name: "draft_proposal",
    kind: "read",
    description:
      "Redacta con IA un borrador de propuesta / business case para una cuenta (resumen, dolores, solución, impacto y ROI con supuestos marcados, plan y próximos pasos). Solo devuelve el borrador: no guarda ni envía nada.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { proposalCore } = await import("@/lib/ai-core");
      const r = await proposalCore(
        c.db,
        a.account_id,
        { orgId: c.orgId, userId: c.userId },
        { withPerson: true },
      );
      // The core already put the warning before the draft; here it is only repeated in mensaje (CA-4).
      return r.rulesRead ? { borrador: r.text } : { borrador: r.text, mensaje: RULES_READ_FAILED };
    },
  }),
  def({
    name: "list_people",
    kind: "read",
    description: `Base única de personas (sin duplicados). Filtros: texto (nombre, empresa, email), cuenta, etapa CRM (${CRM_STAGES.join(", ")}) y estado de secuencia (${SEQUENCE_STAGES.join(", ")}).`,
    input: z.object({
      query: z.string().optional(),
      account_id: z.string().uuid().optional(),
      crm_stage: z.enum(CRM_STAGES).optional(),
      sequence_stage: z.enum(SEQUENCE_STAGES).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (c, a) => {
      let q = c.db
        .from("people")
        .select(
          "id,full_name,company,title,email,linkedin_url,crm_stage,sequence_stage,source,tier,account_id",
        )
        .eq("org_id", c.orgId);
      if (a.query)
        q = q.or(
          `full_name.ilike.${like(a.query)},company.ilike.${like(a.query)},email.ilike.${like(a.query)}`,
        );
      if (a.account_id) q = q.eq("account_id", a.account_id);
      if (a.crm_stage) q = q.eq("crm_stage", a.crm_stage);
      if (a.sequence_stage) q = q.eq("sequence_stage", a.sequence_stage);
      return ok(await q.order("full_name").limit(a.limit ?? 30));
    },
  }),
  def({
    name: "create_person",
    kind: "write",
    description:
      "Añade una persona a la base. Necesita email o LinkedIn y no se crea si ya existe alguien con el mismo email o LinkedIn (misma regla que la importación).",
    input: z.object({
      full_name: z.string().min(1).max(200),
      email: z.string().max(200).optional(),
      linkedin_url: z.string().max(500).optional(),
      company: z.string().max(200).optional(),
      title: z.string().max(200).optional(),
      account_id: z.string().uuid().optional(),
      source: z.string().max(100).optional(),
    }),
    summarize: (a) => `Añadir a ${a.full_name}${a.company ? ` (${a.company})` : ""} a Personas`,
    run: async (c, a) => {
      if (!normEmail(a.email) && !normLinkedin(a.linkedin_url))
        throw new Error("Para añadir a una persona hace falta su email o su LinkedIn.");
      if (a.account_id) await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const existing = ok(
        await c.db.from("people").select("email,linkedin_url").eq("org_id", c.orgId).limit(10000),
      );
      const { fresh } = dedupePeople([a], existing ?? []);
      if (!fresh.length)
        return {
          duplicada: true,
          mensaje: "Ya existe una persona con ese email o LinkedIn: no se ha duplicado.",
        };
      return ok(
        await c.db
          .from("people")
          .insert({
            ...fresh[0],
            full_name: a.full_name,
            account_id: a.account_id ?? null,
            org_id: c.orgId,
          } as never)
          .select("id,full_name")
          .single(),
      );
    },
  }),
  def({
    name: "update_person",
    kind: "write",
    description: `Actualiza una persona: nombre, email, LinkedIn, empresa, cargo, cuenta, etapa CRM (${CRM_STAGES.join(", ")}), estado de secuencia (${SEQUENCE_STAGES.join(", ")}) y tier.`,
    input: z.object({
      person_id: z.string().uuid(),
      full_name: z.string().min(1).max(200).optional(),
      email: z.string().max(200).optional(),
      linkedin_url: z.string().max(500).optional(),
      company: z.string().max(200).optional(),
      title: z.string().max(200).optional(),
      account_id: z.string().uuid().nullable().optional(),
      crm_stage: z.enum(CRM_STAGES).optional(),
      sequence_stage: z.enum(SEQUENCE_STAGES).optional(),
      tier: z.enum(["A", "B", "C"]).optional(),
    }),
    summarize: (a) =>
      `Actualizar la persona: ${Object.keys(defined({ ...a, person_id: undefined })).join(", ") || "sin cambios"}`,
    run: async (c, a) => {
      const { person_id, ...patch } = a;
      await mustFind(c, "people", person_id, "esa persona");
      if (patch.account_id) await mustFind(c, "accounts", patch.account_id, "esa cuenta");
      if (patch.email !== undefined || patch.linkedin_url !== undefined) {
        // Changing the email or LinkedIn must not turn this person into a duplicate of someone else.
        const others = ok(
          await c.db
            .from("people")
            .select("email,linkedin_url")
            .eq("org_id", c.orgId)
            .neq("id", person_id)
            .limit(10000),
        );
        const e = normEmail(patch.email),
          l = normLinkedin(patch.linkedin_url);
        if (
          (others ?? []).some(
            (o) => (e && normEmail(o.email) === e) || (l && normLinkedin(o.linkedin_url) === l),
          )
        )
          throw new Error("Otra persona ya tiene ese email o LinkedIn.");
        if (patch.email !== undefined) (patch as { email?: string | null }).email = e;
      }
      const p = defined(patch);
      if (!Object.keys(p).length) throw new Error("No has indicado qué cambiar de la persona.");
      return ok(
        await c.db
          .from("people")
          .update(p)
          .eq("org_id", c.orgId)
          .eq("id", person_id)
          .select("id,full_name")
          .single(),
      );
    },
  }),
];
