import { describe, expect, it } from "vitest";
import { questionKey, questionSuggestions } from "./setup-questions";

describe("setup questions", () => {
  it("become one suggestion each, deduplicated regardless of accents and case", () => {
    const rows = questionSuggestions([
      "¿El ticket objetivo es 500 €/mes o 119 €/perfil?",
      "¿el ticket objetivo es 500 €/mes o 119 €/perfil",
      "  ",
      "¿Quién decide la compra?",
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].detector).toBe("setup_question");
    expect(rows[0].dedupe_key).toBe(questionKey("el ticket objetivo es 500 €/mes o 119 €/perfil"));
    expect(rows[0].body).toContain("Resolver");
  });
});
