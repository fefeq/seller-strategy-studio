// Parallel: deep account report and ICP account lists (long runs) and the enrichment table.
// Same cores as the screens (parallel-core.ts). Every call spends workspace credits.
import { z } from "zod";
import { REPORT_FIELDS, type ListEntity, type Report } from "@/lib/parallel";
import { def, mustFind, type AgentTool } from "../tool-kit";

const scope = (c: { orgId: string; userId: string }) => ({ orgId: c.orgId, userId: c.userId });

export const PARALLEL_TOOLS: AgentTool[] = [
  def({
    name: "start_account_report", kind: "write",
    description: "Lanza el informe profundo de una cuenta con Parallel (negocio, finanzas, dirección, prioridades, tecnología, cómo compran, competencia, riesgos y oportunidades, con fuentes y confianza). Tarda de 2 a 5 minutos; consúltalo después con get_account_report. Gasta créditos.",
    input: z.object({ account_id: z.string().uuid() }),
    summarize: () => "Investigar a fondo la cuenta con Parallel",
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { startAccountReport } = await import("@/lib/parallel-core");
      const r = await startAccountReport(c.db, scope(c), a.account_id);
      return { mensaje: r.already ? "Ya había un informe en marcha para esa cuenta." : "Informe en marcha: tarda de 2 a 5 minutos. Lo verás en la ficha de la cuenta, pestaña Informe.", research_id: r.id };
    },
  }),
  def({
    name: "get_account_report", kind: "read",
    description: "El último informe profundo (Parallel) de una cuenta, por secciones con fuentes y confianza, o su estado si sigue en marcha.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { data } = await c.db.from("research_runs").select("id,status,result,error,created_at,finished_at").eq("org_id", c.orgId).eq("account_id", a.account_id).eq("kind", "account_report").order("created_at", { ascending: false }).limit(3);
      const latest = (data ?? [])[0];
      if (!latest) return { mensaje: "Esta cuenta aún no tiene informe. Lánzalo con start_account_report." };
      if (latest.status === "running") { const { checkRun } = await import("@/lib/parallel-core"); const r = await checkRun(scope(c), latest.id); if (r.status === "running") return { estado: "en marcha", desde: latest.created_at }; }
      const done = (data ?? []).find((x) => x.status === "done") ?? (await c.db.from("research_runs").select("result,finished_at").eq("id", latest.id).single()).data;
      const report = (done?.result as { report?: Report } | null)?.report;
      if (!report) return { estado: latest.status, error: latest.error };
      return { investigado: done!.finished_at, informe: Object.fromEntries(REPORT_FIELDS.map(([k, label]) => [label, { texto: report[k].value, confianza: report[k].confidence, fuentes: report[k].sources.map((s) => s.url) }])) };
    },
  }),
  def({
    name: "start_icp_account_list", kind: "write",
    description: "Lanza con Parallel una búsqueda de empresas reales que encajan con un ICP de la empresa y/o criterios libres (hasta 100). Tarda de 5 a 50 minutos; consulta el resultado con get_icp_account_list e impórtalas con create_account. Gasta créditos.",
    input: z.object({ icp_id: z.string().uuid().optional().describe("ICP de la empresa (search o get_setup_status)"), criteria: z.string().max(1000).optional(), count: z.number().int().min(5).max(100).optional() }),
    summarize: (a) => `Buscar ${a.count ?? 25} empresas que encajen con el ICP`,
    run: async (c, a) => {
      const { startIcpList } = await import("@/lib/parallel-core");
      const r = await startIcpList(c.db, scope(c), { icpId: a.icp_id ?? null, criteria: a.criteria ?? "", count: a.count ?? 25 });
      return { mensaje: "Búsqueda en marcha. Verás la lista en Cuentas → Buscar cuentas por ICP.", research_id: r.id };
    },
  }),
  def({
    name: "get_icp_account_list", kind: "read",
    description: "La última lista de empresas encontradas por ICP (Parallel): nombre, web y si ya está en Nokko; o su estado si sigue en marcha.",
    input: z.object({}),
    run: async (c) => {
      const { data } = await c.db.from("research_runs").select("id,label,status,result,error,created_at").eq("org_id", c.orgId).eq("kind", "icp_list").order("created_at", { ascending: false }).limit(1);
      const r = (data ?? [])[0];
      if (!r) return { mensaje: "Aún no hay búsquedas por ICP. Lánzala con start_icp_account_list." };
      if (r.status === "running") { const { checkRun } = await import("@/lib/parallel-core"); const x = await checkRun(scope(c), r.id); if (x.status === "running") return { busqueda: r.label, estado: "en marcha", desde: r.created_at }; }
      const { data: fresh } = await c.db.from("research_runs").select("status,result,error").eq("id", r.id).single();
      const entities = ((fresh?.result as { entities?: ListEntity[] } | null)?.entities ?? []);
      return { busqueda: r.label, estado: fresh?.status, error: fresh?.error, empresas: entities.map((e) => ({ nombre: e.name, web: e.url, dominio: e.domain, ya_en_nokko: !!e.existingId })) };
    },
  }),
  def({
    name: "enrich_accounts_table", kind: "read",
    description: "Busca con Parallel sector, tamaño, país, financiación y herramientas de hasta 25 cuentas a la vez, con fuente. No guarda nada: para guardar usa update_account con source: parallel. Gasta créditos.",
    input: z.object({ account_ids: z.array(z.string().uuid()).min(1).max(25) }),
    run: async (c, a) => {
      const { enrichTable } = await import("@/lib/parallel-core");
      const rows = await enrichTable(c.db, scope(c), a.account_ids);
      return rows.map((r) => ({ cuenta: r.name, account_id: r.account_id, sector: r.industry, tamano: r.size, pais: r.country, financiacion: r.funding, herramientas: r.technology, fuente: r.source_url, source: "parallel" }));
    },
  }),
];
