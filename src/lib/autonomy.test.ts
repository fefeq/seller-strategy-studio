import { describe, expect, it } from "vitest";
import {
  AUTONOMY,
  autonomyPrompt,
  DEFAULT_AUTONOMY,
  parseAutonomy,
  sendsForUser,
  skipsConfirmation,
} from "./autonomy";
import { toTelegram } from "./conversation";

describe("niveles del agente (E1)", () => {
  it("por defecto es Copiloto, también ante valores desconocidos", () => {
    expect(DEFAULT_AUTONOMY).toBe("copilot");
    expect(parseAutonomy(null)).toBe("copilot");
    expect(parseAutonomy("total")).toBe("copilot");
  });
  it("hay exactamente Guiado, Copiloto y Autopilot", () => {
    expect(Object.values(AUTONOMY).map((a) => a.label)).toEqual([
      "Guiado",
      "Copiloto",
      "Autopilot",
    ]);
  });
  it("ningún nivel se salta confirmaciones ni envía por el usuario", () => {
    for (const a of ["guided", "copilot", "autopilot"] as const) {
      expect(skipsConfirmation(a)).toBe(false);
      expect(sendsForUser(a)).toBe(false);
      expect(autonomyPrompt(a)).toContain("nunca envías");
      expect(autonomyPrompt(a)).toContain("confirma");
    }
  });
});

describe("bloques de conversación (E2)", () => {
  it("chips, lista y enlace se traducen igual a Telegram", () => {
    const r = toTelegram(
      [
        { kind: "list", title: "Hoy", items: ["Llamar a Ana"] },
        {
          kind: "chips",
          prompt: "Elige",
          chips: [
            { label: "A", value: "x:a", selected: true },
            { label: "B", value: "x:b" },
            { label: "C", value: "x:c" },
          ],
        },
        { kind: "link", label: "Abrir", path: "/home" },
      ],
      "https://nokko.ai",
    );
    expect(r.text).toBe("Hoy\n- Llamar a Ana\nElige\nAbrir: https://nokko.ai/home");
    expect(r.buttons).toEqual([
      [
        { text: "· A", data: "x:a" },
        { text: "B", data: "x:b" },
      ],
      [{ text: "C", data: "x:c" }],
    ]);
  });
  it("descarta botones cuyo valor no cabe en Telegram", () => {
    expect(
      toTelegram(
        [{ kind: "chips", chips: [{ label: "L", value: "v".repeat(65) }] }],
        "https://n.ai",
      ).buttons,
    ).toEqual([]);
  });
});
