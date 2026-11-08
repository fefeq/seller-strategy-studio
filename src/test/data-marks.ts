// SDD-20261106-metrics-honest-data · CA-10: shared check for the data marks of /metrics. Every element with
// `data-mark` must read exactly «Real», «Real · origen», «Estimado · motivo» or «Sin dato · motivo», with the
// state in the attribute; at least one mark must be present in the rendered tree.
import { expect } from "vitest";

export const DATA_MARK_RE = /^(Real( · .+)?|Estimado · .+|Sin dato · .+)$/;

const STATE_WORD: Record<string, string> = {
  real: "Real",
  estimado: "Estimado",
  sin_dato: "Sin dato",
};

/** Checks every [data-mark] under `root` and returns their texts (at least `min`, default 1). */
export function expectDataMarks(root: ParentNode, min = 1): string[] {
  const marks = [...root.querySelectorAll<HTMLElement>("[data-mark]")];
  expect(marks.length, "at least one [data-mark] is rendered").toBeGreaterThanOrEqual(min);
  return marks.map((el) => {
    const text = el.textContent ?? "";
    expect(text, `mark text «${text}»`).toMatch(DATA_MARK_RE);
    const state = el.getAttribute("data-mark") ?? "";
    // SDD-20261106-ux-metrics-data-state · CA-5: every mark is a DataState with one text node.
    expect(el.getAttribute("data-slot"), `data-slot of «${text}»`).toBe("data-state");
    expect(el.childNodes.length, `single child of «${text}»`).toBe(1);
    expect(el.firstChild?.nodeType, `text node of «${text}»`).toBe(Node.TEXT_NODE);
    expect(Object.keys(STATE_WORD), `data-mark="${state}"`).toContain(state);
    expect(text.split(" · ")[0], `word of data-mark="${state}"`).toBe(STATE_WORD[state]);
    return text;
  });
}
