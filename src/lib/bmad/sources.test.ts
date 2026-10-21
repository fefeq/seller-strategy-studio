import { describe, expect, it } from "vitest";
import { knowledgeForAgents } from "./sources";

describe("knowledge for agents", () => {
  const docs = [
    {
      title: "Reglas de Postin",
      body: "Nunca prometemos analizar perfiles de LinkedIn.",
      section: "rules",
      scope: "team",
    },
    {
      title: "Anti-ICP",
      body: "No vendemos a agencias de spam.",
      section: "company",
      scope: "team",
      mandatory: true,
    },
    { title: "ICP", body: "Agencias de marca personal.", section: "company", scope: "team" },
    { title: "Mis notas", body: "privado", section: "company", scope: "personal" },
    { title: "Vacío", body: "  ", section: "rules", scope: "team" },
    { title: "Discovery", body: "1. Contexto", section: "playbooks", scope: "team" },
  ];
  it("always loads the rules section and docs marked mandatory, plus the company docs, never personal or empty ones", () => {
    const k = knowledgeForAgents(docs);
    expect(k.sources).toEqual({
      obligatorios: ["Reglas de Postin", "Anti-ICP"],
      conocimiento: ["ICP"],
    });
    expect(k.reglas_obligatorias[0].texto).toContain("LinkedIn");
  });
});
