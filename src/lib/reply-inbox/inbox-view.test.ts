import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { repliesHeadline, viewReplies, type InboxRow } from "./inbox-view";

const rows: InboxRow[] = [
  { id: "a", received_at: "2026-11-01T10:00:00Z", kind: "human", lead_id: "l1" },
  { id: "b", received_at: "2026-11-10T10:00:00Z", kind: "auto", lead_id: "l2" },
  { id: "c", received_at: "2026-09-01T10:00:00Z", kind: "human", lead_id: "l3" },
];
const now = new Date("2026-11-14T00:00:00Z");

describe("NK-0174 SDD 4 inbox view", () => {
  it("R-1 newest first", () =>
    expect(viewReplies(rows, "all").map((r) => r.id)).toEqual(["b", "a", "c"]));
  it("R-2 filters human", () =>
    expect(viewReplies(rows, "human").map((r) => r.id)).toEqual(["a", "c"]));
  it("R-2 filters auto", () => expect(viewReplies(rows, "auto").map((r) => r.id)).toEqual(["b"]));
  it("R-3 counts only human replies in 30 days", () =>
    expect(repliesHeadline(rows, now)).toBe("1 respuesta de personas en 30 días"));
  it("R-3 falls back to the section name", () =>
    expect(repliesHeadline([], now)).toBe("Respuestas"));
  it("R-4 screen never reads message text columns", () => {
    const src = readFileSync("src/components/reply-inbox/replies-list.tsx", "utf8");
    expect(src).not.toMatch(/subject|snippet|body/i);
  });
});
