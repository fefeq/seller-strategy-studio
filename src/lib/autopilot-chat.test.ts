import { expect, it } from "vitest";
import { localAutopilotRequest } from "@/lib/autopilot-chat";
import { chipIntent, replyBlocks } from "@/lib/conversation";
it("pending and threshold questions use a free deterministic read", () => {
  expect(localAutopilotRequest("Ver mis pendientes")).toEqual({ kind: "read" });
  expect(localAutopilotRequest("¿Cuál es el umbral actual del piloto?")).toEqual({ kind: "read" });
});
it("a threshold change is only a proposal", () => {
  expect(localAutopilotRequest("Cambiar umbral del piloto a 0,03 EUR")).toEqual({
    kind: "threshold",
    threshold: 0.03,
    currency: "EUR",
  });
});
it("confirmation chips share existing action intents", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const block = replyBlocks("", [{ id, summary: "Sintética" }])[0];
  expect(block?.kind).toBe("chips");
  if (block?.kind !== "chips") throw new Error("Missing action chips");
  expect(chipIntent(block.chips[0]?.value ?? "")).toEqual({
    kind: "action",
    id,
    decision: "confirm",
  });
  expect(chipIntent(block.chips[1]?.value ?? "")).toEqual({
    kind: "action",
    id,
    decision: "cancel",
  });
});
