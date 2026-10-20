import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { agentMcpTools } from "./tools/agent-tools";
import { listCompanies, switchCompany } from "./tools/companies";
import { realMetrics, segmentCoverageTool } from "./tools/metrics";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "nokko",
  title: "NOKKO",
  version: "0.1.0",
  instructions:
    "NOKKO: sistema comercial (cuentas, deals, tareas, estrategia GTM, métricas). Todo actúa como el usuario conectado en su empresa activa y con su rol. " +
    "Las consultas devuelven datos al momento. Las acciones de escritura quedan pendientes y el usuario las confirma en la app (Sugerencias). " +
    "Usa list_companies/switch_company para cambiar de empresa. Responde en español neutro.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCompanies, switchCompany, realMetrics, segmentCoverageTool, ...agentMcpTools],
});
