// From gtm-lab@44f385b packages/core/src/deliverables.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allSteps, isKnownDeliverable } from "./index";
import { loadFrameworkFile } from "./node";

const framework = loadFrameworkFile(new URL("../methodology/framework.yaml", import.meta.url));

describe("isKnownDeliverable (CA-6)", () => {
  it("accepts the profile and the 23 step deliverables", () => {
    const ids = ["project-profile", ...allSteps(framework).map((s) => s.deliverable)];
    expect(ids).toHaveLength(24);
    expect(ids.every((id) => isKnownDeliverable(framework, id))).toBe(true);
  });

  it("rejects step ids that are not deliverables, the output and unknown ids", () => {
    // "segments" is a step id whose deliverable is "segment-list".
    for (const id of ["segments", "strategy-doc", "experiment-backlog", "nope", ""]) {
      expect(isKnownDeliverable(framework, id)).toBe(false);
    }
  });
});
