import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScoreRadio } from "./score-radio";

describe("MEDDPICC accesible (D3)", () => {
  it("es un grupo de radio con la opción marcada y objetivos de 44 px", () => {
    render(<ScoreRadio label="Metrics" value={2} onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: /Metrics/ })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(radios[2]!.getAttribute("aria-checked")).toBe("true");
    expect(radios[2]!.tabIndex).toBe(0);
    expect(radios[0]!.tabIndex).toBe(-1);
    for (const r of radios) expect(r.className).toContain("size-11");
  });
  it("las flechas cambian la puntuación y dan la vuelta", () => {
    const on = vi.fn();
    render(<ScoreRadio label="Metrics" value={3} onChange={on} />);
    fireEvent.keyDown(screen.getAllByRole("radio")[3]!, { key: "ArrowRight" });
    expect(on).toHaveBeenCalledWith(0);
    fireEvent.keyDown(screen.getAllByRole("radio")[3]!, { key: "ArrowLeft" });
    expect(on).toHaveBeenCalledWith(2);
  });
});
