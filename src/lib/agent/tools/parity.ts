// E4: the agent reaches what the screens show — Memoria, team rules, Conexiones (with a link to the service's card) and the
// latest GTM Advisor recommendations. Reads reuse the screens' modules; the connection read only reports presence, never a value.
import { z } from "zod";
import { def, isLeader, type AgentTool } from "../tool-kit";
import { KIND_LABEL, type Memory } from "@/lib/memory";
import { loadAgentRules, RULES_READ_FAILED } from "@/lib/knowledge-rules";
import { SERVICES, STATE_LABEL, connectionState, monthUsage } from "@/lib/connections";
import { canUseAdvisor, sortRecommendations, type AdvisorResult } from "@/lib/advisor";
import { jsonObject } from "@/lib/json";

/** Link to one service's card on Conexiones (the card carries id="conexion-<id>"). */
export const connectionHref = (id: string) => `/integrations#conexion-${id}`;

export const PARITY_TOOLS: AgentTool[] = [
  def({
    name: "list_memories",
    kind: "read",
    description:
      "Solo lee. Lo que Nokko recuerda (Memoria): de la empresa, tuyo y de las cuentas, con su tipo y origen. Las memorias personales de otros no aparecen.",
    input: z.object({
      scope: z.enum(["company", "user", "account"]).optional(),
      limit: z.number().int().min(1).max(50).default(25),
    }),
    run: async (c, a) => {
      let q = c.db
        .from("memories")
        .select("id,scope,kind,content,user_id,account_id,pinned,source,updated_at")
        .eq("org_id", c.orgId)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (a.scope) q = q.eq("scope", a.scope);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = ((data ?? []) as Memory[])
        .filter((m) => m.scope !== "user" || m.user_id === c.userId)
        .slice(0, a.limit);
      return {
        memorias: rows.map((m) => ({
          id: m.id,
          ambito: m.scope,
          tipo: KIND_LABEL[m.kind] ?? m.kind,
          texto: m.content,
          fijada: m.pinned,
          origen: m.source,
        })),
        enlace: "/memory",
      };
    },
  }),
  def({
    name: "remember",
    kind: "write",
    description:
      "Guarda un dato en la Memoria de Nokko (empresa o personal). Si ya existe uno igual, no lo duplica.",
    input: z.object({
      content: z.string().trim().min(3).max(500),
      scope: z.enum(["company", "user"]).default("company"),
      kind: z.enum(["business", "preference", "outcome", "task"]).default("business"),
    }),
    summarize: (a) =>
      `Recordar (${a.scope === "user" ? "personal" : "empresa"}): «${a.content.slice(0, 120)}»`,
    run: async (c, a) => {
      const { saveFacts } = await import("@/lib/memory.server");
      await saveFacts(
        c,
        [{ content: a.content, scope: a.scope, kind: a.kind, account_id: null, replaces: null }],
        "manual",
      );
      return { mensaje: "Guardado en Memoria (/memory)." };
    },
  }),
  def({
    name: "list_rules",
    kind: "read",
    description:
      "Solo lee. Las reglas obligatorias del equipo (Estrategia › Reglas y voz) que Nokko aplica en cada respuesta.",
    input: z.object({}),
    run: async (c) => {
      const r = await loadAgentRules(c);
      if (!r.ok) return { aviso: RULES_READ_FAILED, reglas: [] };
      return {
        reglas: r.rules.map((x) => ({ titulo: x.titulo, texto: x.texto })),
        enlace: "/strategy?tab=rules",
      };
    },
  }),
  def({
    name: "list_connections",
    kind: "read",
    description:
      "Solo lee. Estado de cada conexión (Incluida en NOKKO, Tu cuenta, Sin conectar) y su uso del mes, con el enlace a su tarjeta en Conexiones. Nunca devuelve claves: para conectar algo, manda al usuario al enlace, no le pidas la clave en el chat.",
    input: z.object({}),
    run: async (c) => {
      const since = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
      ).toISOString();
      const [usage, stripe, posthog, mailbox] = await Promise.all([
        c.db
          .from("integration_usage")
          .select("service,cost,currency,created_at")
          .eq("org_id", c.orgId)
          .gte("created_at", since)
          .limit(5000),
        c.db.from("stripe_connections").select("status").eq("org_id", c.orgId).maybeSingle(),
        c.db.from("posthog_connections").select("status").eq("org_id", c.orgId).maybeSingle(),
        c.db.from("mailbox_links").select("status").eq("org_id", c.orgId).maybeSingle(),
      ]);
      const company: Record<string, boolean> = {
        stripe_connections: !!stripe.data && stripe.data.status !== "disconnected",
        posthog_connections: !!posthog.data && posthog.data.status !== "disconnected",
        mailbox_links: !!mailbox.data && mailbox.data.status !== "disconnected",
      };
      const now = new Date();
      return {
        conexiones: SERVICES.map((s) => {
          const present =
            s.source.kind === "shared" ? !!process.env[s.source.env] : company[s.source.table];
          const u = monthUsage(usage.data ?? [], s, now);
          return {
            servicio: s.name,
            para_que: s.what,
            estado: STATE_LABEL[connectionState(s, present, null)],
            usos_mes: u.uses,
            gasto_mes: u.byCurrency,
            costes_sin_dato: u.unknown,
            enlace: connectionHref(s.id),
          };
        }),
      };
    },
  }),
  def({
    name: "get_advisor_recommendations",
    kind: "read",
    roles: ["owner", "sales_leader"],
    description:
      "Solo lee. Las últimas recomendaciones del Asesor GTM (resumen, prioridades, riesgos y datos que faltan). Para pedir un análisis nuevo, manda al usuario a /advisor.",
    input: z.object({}),
    run: async (c) => {
      if (!isLeader(c.roles) || !canUseAdvisor(c.roles))
        throw new Error("El Asesor GTM es solo para Owner y Sales Leader.");
      const { data, error } = await c.db
        .from("gtm_advisories")
        .select("goal,horizon,result,created_at")
        .eq("org_id", c.orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data)
        return {
          mensaje: "Aún no hay análisis del Asesor. Pídelo en /advisor.",
          enlace: "/advisor",
        };
      const r = (jsonObject(data.result) ?? {}) as unknown as Partial<AdvisorResult>;
      return {
        objetivo: data.goal,
        horizonte: data.horizon,
        fecha: data.created_at,
        resumen: r.summary ?? null,
        recomendaciones: sortRecommendations(r.recommendations ?? [])
          .slice(0, 5)
          .map((x) => ({
            prioridad: x.priority,
            titulo: x.title,
            por_que: x.rationale,
            kpi: x.kpi,
            objetivo: x.target,
            acciones: x.actions,
          })),
        riesgos: r.risks ?? [],
        faltan_datos: r.data_gaps ?? [],
        enlace: "/advisor",
      };
    },
  }),
];
