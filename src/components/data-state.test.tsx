// SDD-20261106-ux-metrics-data-state · U-2 · CA-4: DataState paints exactly «Real», «Real · origen»,
// «Estimado · motivo» or «Sin dato · motivo» as ONE text node, with data-mark and data-slot="data-state"; the
// text colour class is the same in the three states and the underline comes from design tokens, never a literal.
// DataMark (A) keeps its signature and delegates to DataState. Fictional text.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DataState } from "@/components/data-state";
import { DataMark } from "@/components/metrics/data-mark";

afterEach(cleanup);

const one = (ui: React.ReactElement) => {
  const { container } = render(ui);
  return container.firstElementChild as HTMLElement;
};

describe("DataState (CA-4)", () => {
  it.each([
    [<DataState key="1" state="real" />, "Real", "real"],
    [<DataState key="2" state="real" reason="de las cuentas" />, "Real · de las cuentas", "real"],
    [
      <DataState key="3" state="estimado" reason="punto medio del rango" />,
      "Estimado · punto medio del rango",
      "estimado",
    ],
    [
      <DataState key="4" state="sin_dato" reason="falta rango de ACV" />,
      "Sin dato · falta rango de ACV",
      "sin_dato",
    ],
  ])("paints «%#» as one text node with its attributes", (ui, text, state) => {
    const el = one(ui);
    expect(el.getAttribute("data-mark")).toBe(state);
    expect(el.getAttribute("data-slot")).toBe("data-state");
    expect(el.childNodes.length).toBe(1);
    expect(el.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(el.textContent).toBe(text);
    expect(screen.getByText(text)).toBe(el);
  });

  it("the type requires a reason for «Estimado» and «Sin dato»", () => {
    // @ts-expect-error estimado without reason
    const a = <DataState state="estimado" />;
    // @ts-expect-error sin_dato without reason
    const b = <DataState state="sin_dato" />;
    expect(a && b).toBeTruthy();
  });

  it("same text colour class in the three states; underline from tokens; no literal colour", () => {
    const els = [
      one(<DataState state="real" />),
      one(<DataState state="estimado" reason="x" />),
      one(<DataState state="sin_dato" reason="x" />),
    ];
    for (const el of els) expect(el.className.split(" ")).toContain("text-ink-mid");
    expect(els[0]?.className).toContain("border-state-ok");
    expect(els[1]?.className).toContain("border-state-watch");
    expect(els[2]?.className).toContain("border-hairline-firm");
    const colourClass = (el: HTMLElement) =>
      el.className.split(" ").filter((c) => c.startsWith("text-"));
    expect(colourClass(els[1] as HTMLElement)).toEqual(colourClass(els[0] as HTMLElement));
    expect(colourClass(els[2] as HTMLElement)).toEqual(colourClass(els[0] as HTMLElement));
    for (const el of els) expect(el.className).not.toMatch(/#|rgb|hsl|\[/);
  });
});

describe("DataMark of A delegates to DataState (CA-5)", () => {
  it("renders exactly what DataState renders, keeping its props", () => {
    const viaMark = one(<DataMark state="estimado" reason="punto medio del rango" />);
    const direct = one(<DataState state="estimado" reason="punto medio del rango" />);
    expect(viaMark.outerHTML).toBe(direct.outerHTML);
    expect(viaMark.getAttribute("data-slot")).toBe("data-state");
  });

  it("accepts a null reason on «Real» and a caller className", () => {
    const el = one(<DataMark state="real" reason={null} className="block" />);
    expect(el.textContent).toBe("Real");
    expect(el.getAttribute("data-slot")).toBe("data-state");
    expect(el.className.split(" ")).toContain("block");
  });
});
