// NK-0172 CA-2: the add_default_rules description must not promise that edited rules are safe, because the core compares by title.
import { describe, expect, it } from "vitest";
import { getTool } from "@/lib/agent/tools";

describe("add_default_rules description (NK-0172)", () => {
  const d = getTool("add_default_rules")!.description;

  it("says that renamed or deleted base rules are added again", () => {
    expect(d).toContain(
      "comparadas por título: si la empresa renombró o borró una regla base, se vuelve a añadir la original. No duplica las que conservan su título ni cambia ninguna regla existente.",
    );
  });

  it("no longer claims that edited rules are untouched", () => {
    expect(d).not.toContain("ha editado");
  });

  it("keeps the rest of the description", () => {
    expect(d).toContain("tres Nunca, tres Siempre y tres Escalar");
    expect(d).toContain("Si no puede leer las reglas, no añade ninguna.");
  });
});
