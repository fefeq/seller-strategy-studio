import { describe, expect, it } from "vitest";
import {
  canEditMemory,
  decisionMemory,
  memoryPrompt,
  mergeFacts,
  relevantMemories,
  sameFact,
  type Memory,
} from "./memory";

const mem = (p: Partial<Memory>): Memory => ({
  id: "m",
  scope: "company",
  kind: "business",
  content: "x",
  user_id: "u1",
  account_id: null,
  pinned: false,
  learned: true,
  source: "chat",
  updated_at: "2026-10-01",
  ...p,
});

describe("memory", () => {
  it("treats the same fact said differently as a duplicate", () => {
    expect(
      sameFact(
        "Vendemos sobre todo a fintechs en España",
        "Vendemos sobre todo a fintechs de España",
      ),
    ).toBe(true);
    expect(sameFact("El ciclo medio es de 60 días", "Fede prefiere respuestas cortas")).toBe(false);
  });

  it("updates instead of duplicating, and replaces a contradicted fact", () => {
    const existing = [
      { id: "a", content: "El ACV medio es 20.000 €", scope: "company" as const, account_id: null },
    ];
    const r = mergeFacts(existing, [
      {
        content: "El ACV medio es 20.000 €",
        scope: "company",
        kind: "business",
        account_id: null,
        replaces: null,
      },
      {
        content: "El ACV medio ahora es 35.000 €",
        scope: "company",
        kind: "business",
        account_id: null,
        replaces: 1,
      },
      {
        content: "Preferimos no trabajar con agencias",
        scope: "company",
        kind: "business",
        account_id: null,
        replaces: null,
      },
    ]);
    expect(r.supersede).toEqual([
      { oldId: "a", fact: expect.objectContaining({ content: "El ACV medio ahora es 35.000 €" }) },
    ]);
    expect(r.insert.map((f) => f.content)).toEqual(["Preferimos no trabajar con agencias"]);
  });

  it("personal memories reach only their owner; account ones only when the account is in play", () => {
    const all = [
      mem({ id: "c" }),
      mem({ id: "mine", scope: "user", user_id: "u1" }),
      mem({ id: "other", scope: "user", user_id: "u2" }),
      mem({ id: "acc", scope: "account", account_id: "A" }),
    ];
    expect(
      relevantMemories(all, { userId: "u1" })
        .map((m) => m.id)
        .sort(),
    ).toEqual(["c", "mine"]);
    expect(relevantMemories(all, { userId: "u1", accountIds: ["A"] }).map((m) => m.id)).toContain(
      "acc",
    );
  });

  it("pinned memories come first and the block respects the size cap", () => {
    const all = [
      mem({ id: "old", content: "a".repeat(30) }),
      mem({ id: "pin", pinned: true, content: "b".repeat(30), updated_at: "2020-01-01" }),
    ];
    expect(relevantMemories(all, { userId: "u1" })[0].id).toBe("pin");
    expect(relevantMemories(all, { userId: "u1" }, 40)).toHaveLength(1);
    expect(memoryPrompt([])).toBe("");
  });

  it("remembers dismissed suggestions on their account so Nokko does not propose them again", () => {
    expect(
      decisionMemory({ title: "Llamar al CFO de Acme", account_id: "A" }, "dismiss"),
    ).toMatchObject({
      scope: "account",
      kind: "outcome",
      content: "Descartado por el equipo: Llamar al CFO de Acme",
    });
  });

  it("only the author edits personal memories; Owner and Sales Leader also edit shared ones", () => {
    expect(canEditMemory({ scope: "user", user_id: "u2" }, "u1", ["owner"])).toBe(false);
    expect(canEditMemory({ scope: "company", user_id: "u2" }, "u1", ["sales_leader"])).toBe(true);
    expect(canEditMemory({ scope: "company", user_id: "u2" }, "u1", ["ae"])).toBe(false);
  });
});
