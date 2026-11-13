import { describe, expect, it } from "vitest";
import { detect } from "@/lib/proactive";
import type { Snapshot } from "@/lib/proactive/types";
import { syncSuggestions } from "@/lib/org-data";

// NK-0173 SDD 3: the automatic follow-up surface applies the same graduated gate; blocked steps
// produce a suggestion without draft or action, and syncing it registers the block (no email).

const NOW = new Date("2026-11-13T12:00:00Z");
const ago = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();

const baseLead = {
  id: "l1",
  company: "Acme",
  stage: "contacted",
  stage_entered_at: ago(3),
  contacted_at: ago(3),
  contact_name: "Ana Ruiz",
  next_step_at: null,
  owner_id: "u1",
  account_id: null,
};

const snap = (leads: Snapshot["leads"]): Snapshot => ({
  now: NOW,
  orgId: "o1",
  setup: {
    currency: "EUR",
    segments: [{ name: "SMB", acv_min: 5000, acv_max: 50000, win_rate_target: 25, ae_quota: 600000 }],
    icps: [],
    positioning: null,
    pillars: [],
    quotas: [{ period: "2026-Q4", amount: 100000 }],
    accounts: 1,
    deals: 1,
    quarter: "2026-Q4",
  } as unknown as Snapshot["setup"],
  deals: [],
  meetings: [],
  accounts: [],
  stakeholders: [],
  registrations: [],
  trials: [],
  segments: [],
  leads,
});

describe("followup_sequence email gate", () => {
  it("CA-5 an invalid email blocks the step: suggestion without draft or action, with the reason", () => {
    const [s] = detect(snap([{ ...baseLead, email: "ana@example.invalid", email_status: "invalid" }]));
    expect(s.detector).toBe("followup_sequence");
    expect(s.dedupe_key).toBe("followup:l1:nudge");
    expect(s.body).toContain("Este email es inválido");
    expect(s.body).not.toContain("Borrador");
    expect(s.action).toBeNull();
    expect(s.email_block).toEqual({
      status: "invalid",
      reason: "Este email es inválido: no preparo el borrador. Busca otro contacto de la cuenta.",
    });
  });
  it("CA-5 a catch-all domain blocks the step too", () => {
    const [s] = detect(snap([{ ...baseLead, email: "ana@example.invalid", email_status: "catch_all" }]));
    expect(s.body).toContain("catch-all");
    expect(s.action).toBeNull();
  });
  it("CA-5 an unverified email keeps the draft and adds the mark", () => {
    const [s] = detect(snap([{ ...baseLead, email: "ana@example.invalid", email_status: "unverified" }]));
    expect(s.body).toContain("Borrador");
    expect(s.body).toContain("email sin verificar");
    expect(s.action).not.toBeNull();
    expect(s.email_block).toBeUndefined();
  });
  it("CA-5 a lead without email behaves exactly as today", () => {
    const [s] = detect(snap([baseLead]));
    expect(s.body).toContain("Borrador");
    expect(s.body).not.toContain("email sin verificar");
    expect(s.action).not.toBeNull();
  });
});

describe("syncSuggestions registers blocked drafts (CA-6)", () => {
  it("inserts one registry row per blocked suggestion, never with the email", async () => {
    const inserts: Record<string, unknown>[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recording fake
    const from = (table: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recording fake
      const proxy: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") {
              const res = { data: table === "suggestions" ? [] : null, error: null, count: null };
              return (res1: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
                Promise.resolve(res).then(res1, rej);
            }
            return (...args: unknown[]) => {
              if (prop === "insert" && table === "email_draft_blocks")
                inserts.push(...([args[0]].flat() as Record<string, unknown>[]));
              return proxy;
            };
          },
        },
      );
      return proxy;
    };
    const [s] = detect(snap([{ ...baseLead, email: "ana@example.invalid", email_status: "invalid" }]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake only records inserts
    await syncSuggestions({ from } as any, "o1", [s], []);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      org_id: "o1",
      surface: "followup_sequence",
      status: "invalid",
    });
    expect(JSON.stringify(inserts[0])).not.toContain("ana@example.invalid");
  });
});
