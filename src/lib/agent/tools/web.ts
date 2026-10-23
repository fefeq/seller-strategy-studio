// Web research (Firecrawl): account research and news signals. Stakeholder research with sources is the
// existing research_stakeholder tool (ai-core). Same cores as the account screen (web-research-core.ts).
import { z } from "zod";
import { SIGNAL_LABEL, type SignalKind } from "@/lib/web-research";
import { accountNames, def, mustFind, type AgentTool } from "../tool-kit";

const PLAN_LABEL: Record<string, string> = { current_state: "Situación actual", pains: "Dolores", initiatives: "Iniciativas estratégicas", competitors: "Competencia", risks: "Riesgos", whitespace: "Whitespace / oportunidades" };

export const WEB_TOOLS: AgentTool[] = [
  def({
    name: "research_account", kind: "read",
    description: "Investiga una cuenta en la web (su web y noticias del último año) y propone qué escribir en su plan de cuenta (situación, dolores, iniciativas, competencia, riesgos, whitespace) con fuentes. No guarda nada: para guardarlo usa upsert_account_plan. Tarda unos segundos y gasta créditos de lectura web.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { researchAccountCore } = await import("@/lib/web-research-core");
      const r = await researchAccountCore(c.db, a.account_id, { orgId: c.orgId, userId: c.userId });
      return { resumen: r.summary, propuesta_plan: Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [`${PLAN_LABEL[k] ?? k} (${k})`, v])), fuentes: r.sources };
    },
  }),
  def({
    name: "list_account_signals", kind: "read",
    description: "Señales y noticias recientes guardadas de las cuentas (rondas, contrataciones, lanzamientos, cambios de dirección, alianzas, expansión, riesgos), con por qué importan. Filtra por cuenta o lista las últimas de toda la empresa.",
    input: z.object({ account_id: z.string().uuid().optional(), days: z.number().int().min(1).max(365).optional().describe("Antigüedad máxima en días (30 por defecto)"), limit: z.number().int().min(1).max(50).optional() }),
    run: async (c, a) => {
      if (a.account_id) await mustFind(c, "accounts", a.account_id, "esa cuenta");
      let q = c.db.from("account_signals").select("account_id,title,url,kind,summary,relevance,source,published_at,found_at").eq("org_id", c.orgId)
        .gte("found_at", new Date(Date.now() - (a.days ?? 30) * 86_400_000).toISOString()).order("found_at", { ascending: false }).limit(a.limit ?? 20);
      if (a.account_id) q = q.eq("account_id", a.account_id);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const names = await accountNames(c, (data ?? []).map((s) => s.account_id));
      return (data ?? []).map((s) => ({ cuenta: names.get(s.account_id) ?? null, account_id: s.account_id, tipo: SIGNAL_LABEL[s.kind as SignalKind] ?? s.kind, titular: s.title, que_paso: s.summary, por_que_importa: s.relevance, fuente: s.source, url: s.url, publicada: s.published_at, encontrada: s.found_at }));
    },
  }),
  def({
    name: "refresh_account_signals", kind: "write",
    description: "Busca noticias del último mes de una cuenta en la web, guarda las que tratan de ella y tienen ángulo comercial, y devuelve las nuevas. Gasta créditos de lectura web.",
    input: z.object({ account_id: z.string().uuid() }),
    summarize: () => "Buscar noticias recientes de la cuenta y guardar las señales nuevas",
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { refreshSignalsCore } = await import("@/lib/web-research-core");
      const r = await refreshSignalsCore(c.db, a.account_id, { orgId: c.orgId, userId: c.userId });
      return { mensaje: r.added.length ? `${r.added.length} señales nuevas guardadas en la cuenta.` : "Sin novedades relevantes en el último mes.", nuevas: r.added.map((s) => ({ tipo: SIGNAL_LABEL[s.kind], titular: s.title, por_que_importa: s.relevance, url: s.url })) };
    },
  }),
];
