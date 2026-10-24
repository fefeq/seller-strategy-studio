import { describe, expect, it } from "vitest";
import { actionTool, jsonObject } from "@/lib/json";

describe("jsonObject", () => {
  it("returns plain objects only", () => {
    expect(jsonObject({ a: 1 })).toEqual({ a: 1 });
    expect(jsonObject([1])).toBeNull();
    expect(jsonObject("x")).toBeNull();
    expect(jsonObject(null)).toBeNull();
  });
});

describe("actionTool", () => {
  it("reads the tool of a suggestion action", () => {
    expect(actionTool({ tool: "create_task", args: {} })).toBe("create_task");
    expect(actionTool({ tool: "" })).toBeNull();
    expect(actionTool({ args: {} })).toBeNull();
    expect(actionTool(null)).toBeNull();
  });
});
