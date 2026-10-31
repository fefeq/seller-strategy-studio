import { describe, expect, it } from "vitest";
import { activeJobFor, appendRows, jobLink, companiesNotice, completeNotice, DEFAULT_PREFS, freshResult, isQuiet, localHour, peopleNotice, qualifyNotice, telegramDecision, telegramText, telegramWorthy, unreadCount } from "./jobs";

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

describe("search notices", () => {
  it("people: counts only people not yet in the map and links back to the results", () => {
    const n = peopleNotice(acc, { rows: [{ existingId: null }, { existingId: "s1" }, {}], sources: "Apollo · coste aprox. 0,00 €", blocked: null });
    expect(n.title).toContain("2 personas clave");
    expect(n.link).toBe("/accounts/a1?tab=stakeholders&people=1");
    expect(n.needs_decision).toBe(true);
  });
  it("people: nothing new needs no decision", () => {
    expect(peopleNotice(acc, { rows: [{ existingId: "s1" }], sources: "", blocked: null }).needs_decision).toBe(false);
  });
  it("companies: one new company, singular", () => {
    const n = companiesNotice({ rows: [{ existingId: null }], sources: "Clay", blocked: null });
    expect(n.title).toContain("1 empresa nueva");
    expect(n.link).toBe("/accounts?icp=1");
  });
});

describe("qualifyNotice", () => {
  it("asks for review when the AI proposes stage moves", () => {
    const n = qualifyNotice({ done: 12, failed: 0, error: null, moves: 3 });
    expect(n.title).toContain("12 leads calificados");
    expect(n.needs_decision).toBe(true);
  });
  it("reports the error when nothing could be qualified", () => {
    const n = qualifyNotice({ done: 0, failed: 2, error: "Sin créditos", moves: 0 });
    expect(n.body).toBe("Sin créditos");
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

it("appendRows adds the next page without repeating rows", () => {
  expect(appendRows([{ k: "a" }, { k: "b" }], [{ k: "b" }, { k: "c" }], (r) => r.k).map((r) => r.k)).toEqual(["a", "b", "c"]);
});

it("freshResult keeps results 24 h unless dismissed", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  const job = { id: "j", status: "done", finished_at: "2026-10-24T10:00:00Z" };
  expect(freshResult(job, null, now)).toBe(job);
  expect(freshResult(job, "j", now)).toBeNull();
  expect(freshResult({ ...job, finished_at: "2026-10-23T10:00:00Z" }, null, now)).toBeNull();
});

describe("Telegram", () => {
  it("«Solo lo importante» sends fails, decisions and important tasks, not routine ones", () => {
    expect(telegramWorthy({ kind: "failed" }, "complete_account", "important")).toBe(true);
    expect(telegramWorthy({ kind: "needs_decision" }, "complete_account", "important")).toBe(true);
    expect(telegramWorthy({ kind: "done" }, "discover", "important")).toBe(true);
    expect(telegramWorthy({ kind: "done" }, "complete_account", "important")).toBe(false);
  });
  it("«Solo decisiones» sends only what needs a decision; «Nada» sends nothing", () => {
    expect(telegramWorthy({ kind: "failed" }, "discover", "decisions")).toBe(false);
    expect(telegramWorthy({ kind: "needs_decision" }, null, "decisions")).toBe(true);
    expect(telegramWorthy({ kind: "needs_decision" }, null, "off")).toBe(false);
  });
  it("CA-9: a money notice is worth Telegram in «Todo lo que termine» and «Solo lo importante», not in «Solo decisiones» or «Nada»", () => {
    expect(telegramWorthy({ kind: "money" }, null, "important")).toBe(true);
    expect(telegramWorthy({ kind: "money" }, null, "all")).toBe(true);
    expect(telegramWorthy({ kind: "money" }, null, "decisions")).toBe(false);
    expect(telegramWorthy({ kind: "money" }, null, "off")).toBe(false);
    expect(telegramWorthy({ kind: "done" }, "complete_account", "important")).toBe(false); // control: routine tasks stay out
  });
  it("CA-10: under «Solo lo importante» a money notice in quiet hours is held, not skipped", () => {
    const night = new Date("2026-07-01T21:30:00Z"); // 23:30 in Madrid
    expect(telegramDecision({ kind: "money" }, null, DEFAULT_PREFS, night)).toBe("hold");
    expect(telegramDecision({ kind: "money" }, null, DEFAULT_PREFS, new Date("2026-07-01T10:00:00Z"))).toBe("send");
    expect(telegramDecision({ kind: "done" }, "complete_account", DEFAULT_PREFS, night)).toBe("skip");
  });
  it("night silence wraps midnight (22 → 8)", () => {
    expect(isQuiet(23, 22, 8)).toBe(true);
    expect(isQuiet(7, 22, 8)).toBe(true);
    expect(isQuiet(8, 22, 8)).toBe(false);
    expect(isQuiet(12, 12, 12)).toBe(false);
  });
  it("uses the person's time zone: 21:30 UTC is 23:30 in Madrid in summer → hold", () => {
    const now = new Date("2026-07-01T21:30:00Z");
    expect(localHour(now, "Europe/Madrid")).toBe(23);
    expect(telegramDecision({ kind: "failed" }, "discover", DEFAULT_PREFS, now)).toBe("hold");
    expect(telegramDecision({ kind: "failed" }, "discover", DEFAULT_PREFS, new Date("2026-07-01T10:00:00Z"))).toBe("send");
  });
  it("the message carries an absolute link to Nokko", () => {
    expect(telegramText({ title: "Hecho", body: null, link: "/leads" }, "https://nokko.ai")).toBe("Hecho\n\nhttps://nokko.ai/leads");
  });
});

it("a failed job's notice still leads to its record or screen", () => {
  expect(jobLink("key_people", { accountId: "a1" })).toBe("/accounts/a1?tab=stakeholders");
  expect(jobLink("qualify_leads", {})).toBe("/leads");
  expect(jobLink("deep_review", { artifactId: "d1" })).toBe("/cycle?artifact=d1");
});
