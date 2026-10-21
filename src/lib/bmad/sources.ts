// Which Conocimiento documents every Ciclo GTM draft reads, and the list of sources saved with it.
// Pure so the drafting core and its tests agree. Before this, drafts never saw Conocimiento at all:
// rules written there («qué no se promete nunca») could not reach a brief.

export type KnowledgeDoc = {
  title: string;
  body: string;
  section: string;
  scope: string;
  mandatory?: boolean | null;
};

export const MANDATORY_LIMIT = 12;
export const COMPANY_LIMIT = 5;

export const isMandatory = (d: KnowledgeDoc) => !!d.mandatory || d.section === "rules";

export function knowledgeForAgents(docs: KnowledgeDoc[]) {
  const team = docs.filter((d) => d.scope === "team" && d.body.trim());
  const mandatory = team.filter(isMandatory).slice(0, MANDATORY_LIMIT);
  const company = team
    .filter((d) => !isMandatory(d) && d.section === "company")
    .slice(0, COMPANY_LIMIT);
  return {
    reglas_obligatorias: mandatory.map((d) => ({ titulo: d.title, texto: d.body.slice(0, 4000) })),
    conocimiento_empresa: company.map((d) => ({ titulo: d.title, texto: d.body.slice(0, 3000) })),
    sources: {
      obligatorios: mandatory.map((d) => d.title),
      conocimiento: company.map((d) => d.title),
    },
  };
}

export const MANDATORY_RULE =
  "Las reglas_obligatorias son de obligado cumplimiento: no propongas nada que las contradiga y, si los datos empujan a hacerlo, dilo y explica por qué no lo propones.";
