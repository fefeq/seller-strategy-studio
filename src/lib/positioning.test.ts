import { describe, expect, it } from "vitest";
import { keepApprovals, positioningStatement, statementFragment } from "./positioning";

describe("positioning statement", () => {
  it("turns full sentences into fragments that fit the template", () => {
    expect(statementFragment("Convertir conocimiento experto en posts.")).toBe(
      "convertir conocimiento experto en posts",
    );
    expect(statementFragment("B2B founders;")).toBe("B2B founders");
    expect(statementFragment("LinkedIn")).toBe("LinkedIn");
  });
  it("assembles a grammatical sentence and keeps the product name as written", () => {
    const s = positioningStatement(
      {
        target_customer: "Agencias que gestionan perfiles personales de LinkedIn.",
        need: "Necesitan publicar con la voz de cada cliente.",
        product_name: "Postin",
        category: "Un social media manager con IA.",
        key_benefit: "Escribe como cada perfil.",
        competitive_alternative: "Herramientas genéricas de IA",
        differentiator: "Aprendemos la voz de cada persona.",
      },
      (k) => `[${k}]`,
    );
    expect(s).toBe(
      "Para agencias que gestionan perfiles personales de LinkedIn que necesitan publicar con la voz de cada cliente, Postin es un social media manager con IA que escribe como cada perfil. A diferencia de herramientas genéricas de IA, nosotros aprendemos la voz de cada persona.",
    );
    expect(s).not.toMatch(/\. que|\.\./);
  });
});

describe("copy approvals", () => {
  it("drop when the text changes", () => {
    const st = {
      tagline: { status: "approved" as const, by: "u", at: "t" },
      one_liner: { status: "approved" as const, by: "u", at: "t" },
    };
    expect(
      keepApprovals(st, { tagline: "A", one_liner: "B" }, { tagline: "A", one_liner: "B2" }),
    ).toEqual({ tagline: st.tagline });
  });
});
