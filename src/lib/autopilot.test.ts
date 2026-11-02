import { describe, expect, it } from "vitest";
import { accountsToResearch, coolingAccounts, meetingsToPrep, weekKey } from "./autopilot";

const NOW = new Date("2026-10-24T10:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("autopilot", () => {
  it("researches only new accounts with a domain, once", () => {
    const r = accountsToResearch(
      [
        { id: "new", domain: "acme.com", created_at: ago(1), auto_researched_at: null },
        { id: "nodomain", domain: null, created_at: ago(1), auto_researched_at: null },
        { id: "done", domain: "b.com", created_at: ago(1), auto_researched_at: ago(0) },
        { id: "old", domain: "c.com", created_at: ago(30), auto_researched_at: null },
      ],
      NOW,
    );
    expect(r.map((a) => a.id)).toEqual(["new"]);
  });
  it("does not research an account whose domain is personal mail, so it is not marked as researched", () => {
    const r = accountsToResearch(
      [
        { id: "gmail", domain: "gmail.com", created_at: ago(1), auto_researched_at: null },
        { id: "outlook", domain: " Outlook.ES ", created_at: ago(1), auto_researched_at: null },
        { id: "blank", domain: "  ", created_at: ago(1), auto_researched_at: null },
        { id: "corp", domain: "WWW.Acme.com", created_at: ago(2), auto_researched_at: null },
      ],
      NOW,
    );
    expect(r.map((a) => a.id)).toEqual(["corp"]);
  });
  it("prepares meetings of the next 36 hours that have no prep", () => {
    const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
    const r = meetingsToPrep(
      [
        { id: "tomorrow", scheduled_at: at(20), ai_brief: null },
        { id: "prepared", scheduled_at: at(20), ai_brief: "listo" },
        { id: "next-week", scheduled_at: at(24 * 6), ai_brief: null },
        { id: "past", scheduled_at: at(-2), ai_brief: null },
      ],
      NOW,
    );
    expect(r.map((m) => m.id)).toEqual(["tomorrow"]);
  });
  it("flags accounts that matter after 21 quiet days, coldest first", () => {
    const r = coolingAccounts(
      {
        accounts: [
          {
            id: "target",
            name: "Target",
            is_target: true,
            tier: null,
            owner_id: "u",
            created_at: ago(90),
          },
          {
            id: "deal",
            name: "Con deal",
            is_target: false,
            tier: null,
            owner_id: "u",
            created_at: ago(90),
          },
          {
            id: "warm",
            name: "Caliente",
            is_target: true,
            tier: null,
            owner_id: "u",
            created_at: ago(90),
          },
          {
            id: "minor",
            name: "Sin interés",
            is_target: false,
            tier: "C",
            owner_id: "u",
            created_at: ago(90),
          },
        ],
        activity: [
          { account_id: "target", at: ago(30) },
          { account_id: "deal", at: ago(40) },
          { account_id: "warm", at: ago(3) },
          { account_id: "minor", at: ago(60) },
        ],
        openDeals: [{ account_id: "deal", name: "Renovación", amount: 1000 }],
      },
      NOW,
    );
    expect(r.map((a) => [a.id, a.idleDays])).toEqual([
      ["deal", 40],
      ["target", 30],
    ]);
    expect(
      coolingAccounts(
        {
          accounts: [
            {
              id: "t",
              name: "T",
              is_target: true,
              tier: null,
              owner_id: null,
              created_at: ago(90),
            },
          ],
          activity: [{ account_id: "t", at: ago(10) }],
          openDeals: [],
          thresholdDays: 7,
        },
        NOW,
      ),
    ).toHaveLength(1);
  });
  it("groups reviews by week", () => {
    expect(weekKey(new Date("2026-10-24T10:00:00Z"))).toBe("2026-10-19");
  });
});
