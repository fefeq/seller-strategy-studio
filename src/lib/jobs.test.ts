import { describe, expect, it } from "vitest";
import { activeJobFor, completeNotice, unreadCount } from "./jobs";

const acc = { id: "a1", name: "Typeform" };

describe("completeNotice", () => {
  it("says which fields were written and links to the account", () => {
    const n = completeNotice(acc, { found: true, blocked: null, sources: "Apollo · 0,02 €", changes: [{ field: "industry", empty: true, proposed: "SaaS" }] }, ["industry"]);
    expect(n.title).toContain("Completé");
    expect(n.body).toBe("Apollo · 0,02 €");
    expect(n.link).toBe("/accounts/a1");
    expect(n.needs_decision).toBe(false);
  });
  it("asks for a decision when a value differs from what a person wrote", () => {
    const n = completeNotice(acc, { found: true, blocked: null, sources: "", changes: [{ field: "size", empty: false, proposed: "51-200" }] }, []);
    expect(n.needs_decision).toBe(true);
  });
  it("reports the block reason (budget) without asking anything", () => {
    const n = completeNotice(acc, { found: false, blocked: "Límite mensual alcanzado.", sources: "", changes: [] }, []);
    expect(n.body).toBe("Límite mensual alcanzado.");
    expect(n.needs_decision).toBe(false);
  });
});

describe("activeJobFor", () => {
  it("reuses a queued or running job on the same record, not a finished one", () => {
    const jobs = [{ kind: "complete_account", target_id: "a1", status: "done" }, { kind: "complete_account", target_id: "a1", status: "running" }];
    expect(activeJobFor(jobs, "complete_account", "a1")?.status).toBe("running");
    expect(activeJobFor([jobs[0]!], "complete_account", "a1")).toBeNull();
  });
});

it("unreadCount counts only unread notices", () => {
  expect(unreadCount([{ read_at: null }, { read_at: "x" }, { read_at: null }])).toBe(2);
});
