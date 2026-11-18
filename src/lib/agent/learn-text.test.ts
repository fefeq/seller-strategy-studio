import { describe, expect, it } from "vitest";
import { chatLearnText, MIN_LEARN_CHARS } from "@/lib/agent/learn-text";

describe("chatLearnText", () => {
  it("returns only the person's words", () => {
    const said = "Vendemos sobre todo a consultoras pequeñas de la zona norte.";
    expect(chatLearnText(said)).toBe(`Usuario: ${said}`);
  });

  it("skips messages too short to hold a fact", () => {
    expect(chatLearnText("si")).toBeNull();
    expect(chatLearnText(" ".repeat(MIN_LEARN_CHARS + 5))).toBeNull();
    expect(chatLearnText("a".repeat(MIN_LEARN_CHARS - 1))).toBeNull();
    expect(chatLearnText("a".repeat(MIN_LEARN_CHARS))).not.toBeNull();
  });
});
