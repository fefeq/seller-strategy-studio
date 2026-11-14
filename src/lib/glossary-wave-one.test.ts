import { describe, expect, it } from "vitest";
import { resolveHelp } from "./field-help";

describe("CA-7 concepto de valor anual", () => {
  it("resuelve el rótulo anual nuevo al mismo concepto ACV sin confundir costes", () => {
    const annual = resolveHelp("Valor anual (ACV)");
    expect(annual.generic).toBe(false);
    expect(annual.description).toBe(resolveHelp("Importe (ACV)").description);
    expect(annual.description).not.toBe(resolveHelp("Importe mensual").description);
    expect(annual.description).not.toBe(resolveHelp("Importe de la factura").description);
  });
});
