import { describe, expect, it } from "vitest";
import { checkPosthogKey, companyDomain, funnelQuery, funnelRows, isProductQualified, isUsageDrop, matchAccounts, posthogHost, usageQuery, usageRows, usageTrend, when } from "./product-usage";

describe("connection checks", () => {
  it("maps regions and ingestion hosts to the API host, refuses unsafe ones", () => {
    expect(posthogHost("eu")).toBe("https://eu.posthog.com");
    expect(posthogHost("https://eu.i.posthog.com/")).toBe("https://eu.posthog.com");
    expect(posthogHost("https://app.posthog.com")).toBe("https://us.posthog.com");
    expect(posthogHost("https://posthog.acme.com/x")).toBe("https://posthog.acme.com");
    expect(posthogHost("http://posthog.acme.com")).toBeNull();
    expect(posthogHost("https://192.168.1.4")).toBeNull();
  });
  it("accepts only personal keys", () => {
    expect(checkPosthogKey(" phx_abcdefghijklmnopqrstuvwxyz ")).toEqual({ ok: true, key: "phx_abcdefghijklmnopqrstuvwxyz" });
    expect(checkPosthogKey("phc_abcdefghijklmnopqrstuvwxyz")).toMatchObject({ ok: false, error: expect.stringMatching(/pública/) });
    expect(checkPosthogKey("hola")).toMatchObject({ ok: false });
  });
});

describe("companyDomain", () => {
  it("takes the company from an email or domain and ignores webmail", () => {
    expect(companyDomain("Ana@Acme.com")).toBe("acme.com");
    expect(companyDomain("https://www.acme.com/")).toBe("acme.com");
    expect(companyDomain("ana@gmail.com")).toBeNull();
    expect(companyDomain("")).toBeNull();
  });
});

describe("queries", () => {
  it("pass event names as values, never inside the SQL", () => {
    const q = funnelQuery({ signup: "user'signed up" });
    expect(q.query).not.toContain("user'signed up");
    expect(q.values.signup).toBe("user'signed up");
    expect(q.values.activation).toBe("__nokko_none__");
  });
  it("use a safe person property for the domain, else the email", () => {
    expect(usageQuery("company_domain").query).toContain("person.properties.company_domain");
    expect(usageQuery("x); DROP").query).toContain("splitByChar");
  });
});

describe("rows", () => {
  it("turn 1970 into null and keep people with a sign-up", () => {
    expect(when("1970-01-01 00:00:00")).toBeNull();
    expect(when("2026-10-01 10:00:00")).toBe("2026-10-01T10:00:00.000Z");
    const rows = funnelRows({ columns: ["pid", "email", "signed_up", "activated", "paid"], results: [
      ["p1", "Ana@Acme.com", "2026-10-01 10:00:00", "2026-10-02 10:00:00", "1970-01-01 00:00:00"],
      ["p2", "", "1970-01-01 00:00:00", null, null],
      ["p3", "no-email", "2026-09-01T00:00:00Z", null, null],
    ] });
    expect(rows).toEqual([
      { posthog_person_id: "p1", email: "ana@acme.com", company: "acme.com", signed_up_at: "2026-10-01T10:00:00.000Z", activated_at: "2026-10-02T10:00:00.000Z", converted_at: null },
      { posthog_person_id: "p3", email: "", company: "", signed_up_at: "2026-09-01T00:00:00.000Z", activated_at: null, converted_at: null },
    ]);
  });
  it("group usage by company domain without webmail and match accounts", () => {
    const u = usageRows({ columns: ["domain", "wau", "prev", "mau", "events", "last_seen"], results: [
      ["acme.com", 3, 1, 5, 100, "2026-10-20 10:00:00"], ["www.acme.com", 1, 0, 1, 5, "2026-10-22 10:00:00"], ["gmail.com", 50, 40, 90, 900, null], ["beta.io", 0, 4, 4, 20, "2026-10-10 10:00:00"],
    ] });
    expect(u).toEqual([
      { domain: "acme.com", active_users_7d: 4, active_users_prev_7d: 1, active_users_30d: 6, events_30d: 105, last_seen_at: "2026-10-22T10:00:00.000Z" },
      { domain: "beta.io", active_users_7d: 0, active_users_prev_7d: 4, active_users_30d: 4, events_30d: 20, last_seen_at: "2026-10-10T10:00:00.000Z" },
    ]);
    expect(matchAccounts(u, [{ id: "a1", domain: "https://acme.com" }]).map((x) => x.account_id)).toEqual(["a1", null]);
  });
});

describe("signals", () => {
  it("names the trend", () => {
    expect(usageTrend(5, 2)).toBe("up");
    expect(usageTrend(1, 4)).toBe("down");
    expect(usageTrend(3, 3)).toBe("flat");
    expect(usageTrend(2, 0)).toBe("new");
    expect(usageTrend(0, 0)).toBe("inactive");
  });
  it("flags product-qualified non-customers with 3+ active users not falling", () => {
    expect(isProductQualified({ domain: "a", account_id: "1", active_users_7d: 3, active_users_prev_7d: 2 }, false)).toBe(true);
    expect(isProductQualified({ domain: "a", account_id: "1", active_users_7d: 3, active_users_prev_7d: 5 }, false)).toBe(false);
    expect(isProductQualified({ domain: "a", account_id: "1", active_users_7d: 9, active_users_prev_7d: 2 }, true)).toBe(false);
    expect(isProductQualified({ domain: "a", account_id: "1", active_users_7d: 2, active_users_prev_7d: 0 }, false)).toBe(false);
  });
  it("flags customers whose weekly users halved from 3 or more", () => {
    expect(isUsageDrop({ domain: "a", account_id: "1", active_users_7d: 2, active_users_prev_7d: 4 }, true)).toBe(true);
    expect(isUsageDrop({ domain: "a", account_id: "1", active_users_7d: 3, active_users_prev_7d: 4 }, true)).toBe(false);
    expect(isUsageDrop({ domain: "a", account_id: "1", active_users_7d: 0, active_users_prev_7d: 2 }, true)).toBe(false);
    expect(isUsageDrop({ domain: "a", account_id: "1", active_users_7d: 0, active_users_prev_7d: 6 }, false)).toBe(false);
  });
});
