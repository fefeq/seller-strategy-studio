import { describe, expect, it } from "vitest";
import { buildAiRequest, formJsonSchema, type SavedDeliverableLike } from "./core";
import { framework } from "./methodology";
import { buildSuggestCall } from "./suggest-request";

const AI_DELIVERABLES = Object.keys(framework.ai);

const SAVED = new Map<string, SavedDeliverableLike>([
  ["project-profile", { status: "done", data: { name: "Producto ficticio" } }],
]);

type Node = Record<string, unknown>;
function objectsOf(node: unknown, path = "$"): [string, Node][] {
  if (!node || typeof node !== "object") return [];
  const out: [string, Node][] = [];
  const n = node as Node;
  if (n.type === "object") out.push([path, n]);
  for (const [key, child] of Object.entries(n)) out.push(...objectsOf(child, `${path}.${key}`));
  return out;
}

describe("buildSuggestCall (NK-0048 CA-11, regression)", () => {
  it("covers every deliverable with AI help", () => {
    expect(AI_DELIVERABLES.length).toBeGreaterThan(10);
  });

  it.each(AI_DELIVERABLES)(
    "%s: the same system, user and schema as gtm-lab, nothing added",
    (id) => {
      const call = buildSuggestCall(framework, id, SAVED);
      const request = buildAiRequest(framework, id, SAVED);
      expect(Object.keys(call).sort()).toEqual(["schema", "system", "user"]);
      expect(call.system).toBe(request.system);
      expect(call.user).toBe(request.user);
      expect(call.schema).toEqual(formJsonSchema(framework, id));
    },
  );

  it("rejects a deliverable without AI help, like gtm-lab", () => {
    expect(() => buildSuggestCall(framework, "no-such-step", SAVED)).toThrow(
      /no tiene ayuda de IA/,
    );
  });
});

describe("suggestion schemas (NK-0048 CA-12, regression)", () => {
  it.each(AI_DELIVERABLES)("%s: every object is closed and requires all its properties", (id) => {
    const objects = objectsOf(buildSuggestCall(framework, id, SAVED).schema);
    expect(objects.length).toBeGreaterThan(0);
    for (const [path, node] of objects) {
      const keys = Object.keys((node.properties as Node | undefined) ?? {}).sort();
      expect(node.additionalProperties, path).toBe(false);
      expect([...((node.required as string[] | undefined) ?? [])].sort(), path).toEqual(keys);
    }
  });
});
