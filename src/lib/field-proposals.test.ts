import { describe, expect, it } from "vitest";
import { fieldProposalDecision, splitAutoChanges, proposalKey, proposalSuggestion, PROPOSABLE_FIELDS, PROPOSAL_DETECTOR } from "./field-proposals";

const acc = { id: "a1", name: "Acme Demo", owner_id: "u1" };

describe("field proposals", () => {
  it("CA-9: a different value over a filled field is a proposal, never a write", () => {
    expect(fieldProposalDecision("industry", "Logística", "Fintech")).toBe("propose");
    expect(fieldProposalDecision("industry", null, "Fintech")).toBe("write");
  });

  it("CA-9: the same value in another format is not proposed", () => {
    expect(fieldProposalDecision("country", "ES", "España")).toBe("same");
    expect(fieldProposalDecision("size", "51–200 empleados", "51-200 employees")).toBe("same");
    expect(fieldProposalDecision("size", "50 empleados", "51-200 employees")).toBe("propose");
  });

  it("CA-9: the proposal is a suggestion whose action updates only that field", () => {
    const s = proposalSuggestion(acc, { field: "country", current: "ES", proposed: "FR", source: "clay" }, { country: { source: "persona", at: "2026-10-24T10:00:00Z" } });
    expect(s.detector).toBe(PROPOSAL_DETECTOR);
    expect(s.action).toEqual({ tool: "update_account", args: { account_id: "a1", country: "FR" } });
    expect(s.user_id).toBe("u1");
    expect(s.link).toBe("/accounts/a1");
    expect(s.title).toContain("Francia");
    expect(s.body).toContain("lo escribiste tú");
    expect(s.body).toContain("Clay propone");
  });

  it("CA-9: a value with no mark is never described as written by a person", () => {
    const s = proposalSuggestion(acc, { field: "industry", current: "Logística", proposed: "Fintech", source: "apollo" }, {});
    expect(s.body).toContain("no consta quién lo escribió");
    expect(s.body).not.toContain("lo escribiste tú");
  });

  it("CA-9: the same proposed value has one key, so a dismissed proposal does not return; a new value has another", () => {
    const k = proposalKey("a1", "industry", "Fintech");
    expect(proposalKey("a1", "industry", " fintech ")).toBe(k);
    expect(proposalKey("a1", "industry", "Seguros")).not.toBe(k);
    expect(proposalKey("a2", "industry", "Fintech")).not.toBe(k);
    expect(proposalKey("a1", "country", "FR")).toBe(proposalKey("a1", "country", "Francia"));
  });

  it("notes are never proposed", () => {
    expect(PROPOSABLE_FIELDS).toEqual(["industry", "size", "country"]);
  });
});

describe("splitAutoChanges (SDD field-write-paths-normalization, CA-6)", () => {
  const ch = (field: "industry" | "size" | "country", current: string | null, proposed: string) => ({ field, current, proposed, empty: !current?.trim(), source: "clay" });
  it("writes only an empty field", () => {
    const { fill, offers } = splitAutoChanges([ch("industry", null, "Fintech")]);
    expect(fill.map((c) => c.field)).toEqual(["industry"]);
    expect(offers).toEqual([]);
  });
  it("never replaces a filled field: a different value is only offered", () => {
    const { fill, offers } = splitAutoChanges([ch("industry", "Logística", "Fintech"), ch("country", "ES", "FR")]);
    expect(fill).toEqual([]);
    expect(offers.map((c) => c.field)).toEqual(["industry", "country"]);
  });
  it("a value that only differs in format is neither written nor offered", () => {
    const { fill, offers } = splitAutoChanges([ch("size", "51-200 empleados", "51–200 empleados"), ch("country", "España", "ES")]);
    expect(fill).toEqual([]);
    expect(offers).toEqual([]);
  });
  it("does not offer notes", () => {
    const n = { field: "notes" as const, current: "algo", proposed: "otra cosa", empty: false, source: "web" };
    expect(splitAutoChanges([n])).toEqual({ fill: [], offers: [] });
  });
});
