// «Plan de herramientas del equipo»: what Nokko actually does with each tool the team lists. The team's own status
// (Pendiente, Lo estamos montando, Ya lo usamos) is a label they set by hand; this is the other half, derived and
// never stored. Pure and tested. NK-0064, SDD tool-plan-real-connections, U-1.

/** native: Nokko connects to it; webhook: its data reaches Nokko only through a webhook or CSV the team sets up;
 *  not_yet: a native connection is announced but not built; none: nothing known. */
export type ConnectionKind = "native" | "webhook" | "not_yet" | "none";

export const CONNECTION_LABEL: Record<ConnectionKind, string> = {
  native: "Conexión disponible",
  webhook: "Entra por webhook",
  not_yet: "Sin conexión nativa todavía",
  none: "Sin conexión conocida",
};

/** Shown under «Ya lo usamos» so the team's label is not read as «Nokko reads it». Native needs none. */
export const CONNECTION_NOTE: Record<ConnectionKind, string | null> = {
  native: null,
  webhook: "El equipo la usa; Nokko recibe sus datos solo si montas el flujo por webhook.",
  not_yet: "El equipo la usa, pero Nokko no tiene conexión con ella hoy.",
  none: "El equipo la usa, pero no consta ninguna conexión de Nokko con ella.",
};

// Names are matched after normalising. Native follows what the Conexiones page lists as «Disponible»
// (integrations.tsx WORKING); webhook and not_yet follow its NOT_YET line. Anything else is «none».
const BY_KIND: Record<Exclude<ConnectionKind, "none">, string[]> = {
  native: ["Apollo", "Apollo.io", "Clay", "Google Drive", "Firecrawl", "Parallel", "Perplexity", "Apify"],
  webhook: ["HubSpot", "Attio", "LinkedIn Sales Navigator", "Pipedrive", "Salesforce"],
  not_yet: ["Gmail", "Google Calendar", "Gong", "Fireflies"],
};

const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

const KIND_OF = new Map<string, ConnectionKind>(
  (Object.entries(BY_KIND) as [ConnectionKind, string[]][]).flatMap(([kind, names]) => names.map((n) => [normalize(n), kind] as const)),
);

/** What Nokko does with a tool named in the plan. An unknown name is «none», never an error. */
export function connectionFor(name: string): { kind: ConnectionKind } {
  return { kind: KIND_OF.get(normalize(name)) ?? "none" };
}
