import { describe, expect, it } from "vitest";
import { chipIntent, replyBlocks, toTelegram } from "@/lib/conversation";

const ID = "11111111-2222-3333-4444-555555555555";

describe("E2 agent reply blocks", () => {
  it("a pending action becomes Confirmar/Descartar chips with the Telegram callback", () => {
    const b = replyBlocks("Te propongo crear la tarea.", [{ id: ID, summary: "Crear tarea" }]);
    expect(b[0]).toEqual({
      kind: "chips",
      prompt: "¿Confirmas? Crear tarea",
      chips: [
        { label: "Confirmar", value: `a:${ID}:c` },
        { label: "Descartar", value: `a:${ID}:x` },
      ],
    });
    expect(chipIntent(`a:${ID}:c`)).toEqual({ kind: "action", id: ID, decision: "confirm" });
    expect(chipIntent(`a:${ID}:x`)).toEqual({ kind: "action", id: ID, decision: "cancel" });
  });

  it("«Siguiente paso:» lines become chips that send the step back", () => {
    const b = replyBlocks(
      "Hecho.\nSiguiente paso: Revisar el ICP\n**Próximo paso:** Llamar a Acme.",
    );
    expect(b).toEqual([
      {
        kind: "chips",
        prompt: "Siguiente paso",
        chips: [
          { label: "Revisar el ICP", value: "q:Revisar el ICP" },
          { label: "Llamar a Acme", value: "q:Llamar a Acme" },
        ],
      },
    ]);
    expect(chipIntent("q:Revisar el ICP")).toEqual({ kind: "say", text: "Revisar el ICP" });
  });

  it("app links become «Abrir» links, external links are ignored, max 4", () => {
    const b = replyBlocks(
      "Mira [Pipeline](/pipeline), [Pipeline](/pipeline) y [web](https://x.com) y [Cuentas](/accounts?f=1).",
    );
    expect(b).toEqual([
      { kind: "link", label: "Abrir Pipeline", path: "/pipeline" },
      { kind: "link", label: "Abrir Cuentas", path: "/accounts?f=1" },
    ]);
  });

  it("every chip fits Telegram's 64-byte callback, so Telegram shows the same buttons", () => {
    const b = replyBlocks(
      `Siguiente paso: ${"preparar la reunión con el comité de compras ".repeat(3)}`,
      [{ id: ID, summary: "x" }],
    );
    const t = toTelegram(b, "https://nokko.ai");
    expect(t.buttons.flat().map((x) => x.text)).toEqual([
      "Confirmar",
      "Descartar",
      expect.stringMatching(/…$/),
    ]);
    for (const x of t.buttons.flat())
      expect(new TextEncoder().encode(x.data).length).toBeLessThanOrEqual(64);
  });

  it("no steps, links or actions → no blocks", () => {
    expect(replyBlocks("Tienes 3 deals abiertos.")).toEqual([]);
  });
});
