// SDD-20261109-deals-no-source U-3 (NK-0107) CA-4a: the «Fuente» field of the deal detail. What «Guardar» sends is CA-4b (walkthrough).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DealSourceField } from "@/components/deal-source-field";

afterEach(cleanup);
const select = () => screen.getByRole("combobox") as HTMLSelectElement;
const shown = () => select().selectedOptions[0]!.textContent;

describe("DealSourceField", () => {
  it("shows «Sin origen» for null", () => {
    render(<DealSourceField value={null} onChange={vi.fn()} />);
    expect(shown()).toBe("Sin origen");
  });
  it(
    "choosing Inbound sends «inbound" + "», and going back sends null, never an empty string",
    () => {
      const onChange = vi.fn();
      render(<DealSourceField value={null} onChange={onChange} />);
      fireEvent.change(select(), { target: { value: "inbound" } });
      expect(onChange).toHaveBeenLastCalledWith("inbound");
      fireEvent.change(select(), { target: { value: "" } });
      expect(onChange).toHaveBeenLastCalledWith(null);
      expect(onChange).not.toHaveBeenCalledWith("");
    },
  );
  it("shows a free text as its own selected option", () => {
    render(<DealSourceField value="Entrada de leads" onChange={vi.fn()} />);
    expect(shown()).toBe("Entrada de leads");
    expect(select().value).toBe("Entrada de leads");
  });
  // SDD-20261109-new-deal-source U-2 (NK-0123) CA-8: the optional accessible name.
  it("CA-8: with aria-label «Fuente» it is found by that name", () => {
    render(<DealSourceField value={null} onChange={vi.fn()} aria-label="Fuente" />);
    expect(screen.getByRole("combobox", { name: "Fuente" })).toBeTruthy();
  });
});
