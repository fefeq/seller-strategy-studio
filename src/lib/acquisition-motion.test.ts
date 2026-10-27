import { describe, expect, it } from "vitest";
import { ACQUISITION_MOTIONS, acquisitionMotionText, readAcquisitionMotion } from "@/lib/acquisition-motion";

describe("acquisition motion", () => {
  it("CA-1: the closed set is plg, slg, marketing and partner", () => {
    expect([...ACQUISITION_MOTIONS]).toEqual(["plg", "slg", "marketing", "partner"]);
  });

  it("CA-1: empty or unknown values read as undefined, never as another motion (the sales-model values are not valid here)", () => {
    for (const v of [null, undefined, "", "inside", "field", "strategic", 3]) expect(readAcquisitionMotion(v)).toBeNull();
    expect(readAcquisitionMotion("slg")).toBe("slg");
  });

  it("shows «sin definir» for an empty value", () => {
    expect(acquisitionMotionText(null)).toBe("sin definir");
    expect(acquisitionMotionText("partner")).toBe("Partners");
  });
});
