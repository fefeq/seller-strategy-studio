import { describe, expect, it } from "vitest";
import { FLOW, flowFor } from "./flow";

describe("flow", () => {
  it("places list and detail pages in the flow", () => {
    expect(flowFor("/leads")?.index).toBe(0);
    expect(flowFor("/accounts/abc")?.current.label).toBe("Cuentas");
    expect(flowFor("/deals")?.next?.to).toBe("/metrics");
  });
  it("has no previous step at the start and no next step at the end", () => {
    expect(flowFor("/leads")?.prev).toBeNull();
    expect(flowFor("/metrics")?.next).toBeNull();
  });
  it("is null outside the flow", () => {
    expect(flowFor("/home")).toBeNull();
    expect(flowFor("/leadsx")).toBeNull();
  });
  it("every step says what happens there", () => {
    expect(FLOW.every((s) => s.what.length > 10)).toBe(true);
  });
});
