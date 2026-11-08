// SDD-20261106-ux-metrics-data-state · U-1 · CA-1: ExplanationFold starts closed, its trigger is a native button with
// aria-expanded and an explicit aria-controls (also closed), the content opens in the flow right after the button.
// «Out of the document» means the children; Radix keeps an empty, hidden container with the id. Fictional text.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExplanationFold } from "@/components/explanation-fold";

afterEach(cleanup);

const TEXT = "Texto ficticio de método: cómo se calcula esta cifra.";
const mount = (kind: "calculo" | "metodo") =>
  render(
    <div data-testid="host">
      <ExplanationFold kind={kind}>
        <p>{TEXT}</p>
      </ExplanationFold>
    </div>,
  );

describe("ExplanationFold (CA-1)", () => {
  it("starts closed: native button, aria-expanded=false, aria-controls = id of the (empty) content", () => {
    mount("calculo");
    const btn = screen.getByRole("button", { name: "Cómo se calcula" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.hasAttribute("tabindex") && Number(btn.getAttribute("tabindex")) < 0).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const id = btn.getAttribute("aria-controls");
    expect(id, "aria-controls is set while closed").toBeTruthy();
    const content = document.getElementById(id as string);
    expect(content, "the controlled container exists while closed").not.toBeNull();
    expect(content?.childElementCount).toBe(0);
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("opens on click: aria-expanded=true, content in the flow right after the button, no portal", () => {
    mount("calculo");
    const btn = screen.getByRole("button", { name: "Cómo se calcula" });
    const id = btn.getAttribute("aria-controls") as string;
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.getAttribute("aria-controls")).toBe(id);
    expect(btn.textContent).toBe("Ocultar cálculo");
    const text = screen.getByText(TEXT);
    const content = document.getElementById(id) as HTMLElement;
    expect(content.contains(text)).toBe(true);
    expect(btn.nextElementSibling).toBe(content);
    const host = screen.getByTestId("host");
    expect(host.contains(content), "no portal").toBe(true);
    for (let el: HTMLElement | null = content; el && el !== host; el = el.parentElement)
      expect(el.className, "in the flow").not.toMatch(/\b(absolute|fixed)\b/);
  });

  it("closes again on a second click", () => {
    mount("calculo");
    const btn = screen.getByRole("button", { name: "Cómo se calcula" });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar cálculo" }));
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(TEXT)).toBeNull();
    expect(btn.getAttribute("aria-controls")).toBeTruthy();
  });

  it("kind=metodo reads «Más sobre esto» / «Ocultar»", () => {
    mount("metodo");
    const btn = screen.getByRole("button", { name: "Más sobre esto" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Ocultar");
    expect(screen.getByText(TEXT)).toBeTruthy();
  });

  it("two folds on one page control different containers", () => {
    render(
      <>
        <ExplanationFold kind="calculo"><p>Uno</p></ExplanationFold>
        <ExplanationFold kind="calculo"><p>Dos</p></ExplanationFold>
      </>,
    );
    const [a, b] = screen.getAllByRole("button", { name: "Cómo se calcula" });
    expect(a?.getAttribute("aria-controls")).not.toBe(b?.getAttribute("aria-controls"));
  });
});
