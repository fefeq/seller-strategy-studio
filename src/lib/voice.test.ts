import { describe, expect, it } from "vitest";
import { acceptDictation, canSpeak, speakableText } from "./voice";

describe("voice rules (Fase F)", () => {
  it("strips markdown and links before reading", () => {
    expect(speakableText("**Hola** [Conexiones](/integrations) y `x`")).toBe("Hola Conexiones y");
  });
  it("never reads secrets or deletions aloud", () => {
    expect(canSpeak("Tu clave es sk-proj-abcdefghijklmnopqrstuvwx123").ok).toBe(false);
    expect(canSpeak("Propongo borrar el segmento Retail").ok).toBe(false);
    expect(canSpeak("Tu pipeline tiene 3 deals").ok).toBe(true);
  });
  it("dictation drops secrets and refuses deletions", () => {
    expect(acceptDictation("password: SuperSecreta2026!").ok).toBe(false);
    expect(acceptDictation("elimina la cuenta Acme").ok).toBe(false);
    expect(acceptDictation("¿cómo va el pipeline?")).toEqual({
      ok: true,
      text: "¿cómo va el pipeline?",
    });
  });
});
