// With no DialogHost mounted, the ask* helpers answer with the safe (cancel) value and never open a browser
// dialog (AGENTS.md: never window.confirm/prompt). Fictional texts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { askConfirm, askText, askUnsaved } from "@/components/confirm-dialog";

afterEach(() => vi.restoreAllMocks());

describe("no DialogHost mounted", () => {
  it("resolves the safe answer and never calls window.confirm or window.prompt", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("texto");
    expect(await askConfirm("¿Borrar?", { body: "detalle" })).toBe(false);
    expect(await askText("Nombre", { initial: "x" })).toBeNull();
    expect(await askUnsaved("¿Guardar?")).toBe("stay");
    expect(confirm).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
  });
});
