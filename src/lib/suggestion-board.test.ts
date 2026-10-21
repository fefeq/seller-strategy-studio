import { describe, expect, it } from "vitest";
import { boardSummary, byOwner, canSeeTeam, closedSummary, isOverdue, STATUS_LABEL, type BoardItem } from "./suggestion-board";
import { splitClosed, staleTexts } from "./org-data";

const now = new Date("2026-10-20T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const S = (o: Partial<BoardItem>): BoardItem => ({ id: "x", user_id: "u1", status: "pending", priority: 2, created_at: ago(1), snoozed_until: null, ...o });

describe("team suggestions panel", () => {
  it("only Owner and Sales Leader see the whole team", () => {
    expect(canSeeTeam(["owner"])).toBe(true);
    expect(canSeeTeam(["sales_leader"])).toBe(true);
    expect(canSeeTeam(["ae"])).toBe(false);
  });
  it("a pending suggestion is overdue after more than 7 days", () => {
    expect(isOverdue(S({ created_at: ago(8) }), now)).toBe(true);
    expect(isOverdue(S({ created_at: ago(7) }), now)).toBe(false);
    expect(isOverdue(S({ created_at: ago(30), status: "snoozed" }), now)).toBe(false);
  });
  it("summary counts pending, urgent, unassigned, snoozed and overdue", () => {
    const items = [S({ priority: 1 }), S({ user_id: null, created_at: ago(9) }), S({ status: "snoozed", user_id: null }), S({ status: "approved" })];
    expect(boardSummary(items, now)).toEqual({ pending: 2, urgent: 1, unassigned: 2, snoozed: 1, overdue: 1 });
  });
  it("groups open suggestions by owner, urgent first", () => {
    const g = byOwner([S({ user_id: "a" }), S({ user_id: "b", priority: 1 }), S({ user_id: "a", status: "dismissed" })], now);
    expect(g.map((x) => x.owner)).toEqual(["b", "a"]);
    expect(g[1].pending).toBe(1);
  });
  it("keeps done by the user apart from solved on its own", () => {
    expect(closedSummary([S({ status: "approved" }), S({ status: "approved" }), S({ status: "resolved" }), S({ status: "dismissed" }), S({})])).toEqual({ done: 2, solved: 1, dismissed: 1 });
    expect(STATUS_LABEL.approved).toBe("Hecha");
    expect(STATUS_LABEL.resolved).toBe("Resuelta sola");
  });
  it("a suggestion worked on with «Resolver» that stops applying counts as done", () => {
    const r = splitClosed([{ id: "a", status: "pending" }, { id: "b", status: "pending" }, { id: "c", status: "snoozed" }], ["a", "c"]);
    expect(r).toEqual({ done: ["a"], resolved: ["b", "c"] });
  });
});

describe("staleTexts", () => {
  it("refreshes an open suggestion whose numbers changed and leaves the rest", () => {
    const open = [
      { id: "a", dedupe_key: "low_coverage:2026-Q4", title: "Cobertura de pipeline 0.0x en 2026-Q4 (objetivo 3–4x)", body: "Faltan unos 28.032 de pipeline" },
      { id: "b", dedupe_key: "setup_incomplete:quota", title: "Completa: Cuota", body: "igual" },
    ];
    const found = [
      { dedupe_key: "low_coverage:2026-Q4", title: "Cobertura de pipeline 0,05x en 2026-Q4 (objetivo 3–4x)", body: "Faltan unos 28.032 €" },
      { dedupe_key: "setup_incomplete:quota", title: "Completa: Cuota", body: "igual" },
    ];
    expect(staleTexts(open, found)).toEqual([{ id: "a", title: found[0].title, body: found[0].body }]);
  });
});
