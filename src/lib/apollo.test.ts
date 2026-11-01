import { describe, expect, it } from "vitest";
import { companyToAccount, enrichChanges } from "./clay";
import {
  apolloErrorText,
  apolloWebhookBase,
  companyParams,
  matchDetails,
  matchToContact,
  orgToAccount,
  accountInsertFromDraft,
  canonicalCurrent,
  normalizeDraft,
  peopleParams,
  phonesFromWebhook,
  sameSecret,
  searchPersonPreview,
  APOLLO_DEV_URL,
  APOLLO_PUBLISHED_URL,
} from "./apollo";

describe("apollo params", () => {
  it("searches people by the account's clean domain, titles and known seniorities", () => {
    expect(
      peopleParams("https://www.acme.com", { titles: ["CFO"], seniorities: ["vp", "bogus"] }, 2),
    ).toEqual([
      ["q_organization_domains_list[]", "acme.com"],
      ["person_titles[]", "CFO"],
      ["person_seniorities[]", "vp"],
      ["page", "2"],
      ["per_page", "25"],
    ]);
    expect(() => peopleParams(null, {}, 1)).toThrow(/dominio/);
  });
  it("builds company filters with English countries and an employee range, and refuses an empty search", () => {
    expect(
      companyParams({ keywords: ["payments"], countries: ["ES"], minEmployees: 50 }, 1),
    ).toEqual([
      ["q_organization_keyword_tags[]", "payments"],
      ["organization_locations[]", "Spain"],
      ["organization_num_employees_ranges[]", "50,1000000"],
      ["page", "1"],
      ["per_page", "10"],
    ]);
    expect(() => companyParams({}, 1)).toThrow(/al menos un criterio/);
    expect(() => companyParams({ minEmployees: 500, maxEmployees: 10 }, 1)).toThrow(/mínimo/);
  });
});

describe("apollo mapping", () => {
  it("maps an organization to account fields", () => {
    expect(
      orgToAccount({
        name: "Typeform",
        primary_domain: "typeform.com",
        industry: "information technology & services",
        estimated_num_employees: 510,
        country: "Spain",
        city: "Barcelona",
      }),
    ).toMatchObject({
      name: "Typeform",
      domain: "typeform.com",
      industry: "Information technology & services",
      size: "510 empleados",
      country: "ES",
      location: "Barcelona, Spain",
    });
  });
  it("keeps the masked search row without contact data", () => {
    expect(
      searchPersonPreview({
        id: "abc123",
        first_name: "Ana",
        last_name_obfuscated: "Ga***a",
        title: "CFO",
        has_email: true,
        has_direct_phone: "Yes",
      }),
    ).toEqual({
      apolloId: "abc123",
      name: "Ana Ga***a",
      title: "CFO",
      company: null,
      hasEmail: true,
      hasPhone: true,
    });
    expect(searchPersonPreview({ first_name: "x" })).toBeNull();
  });
  it("drops Apollo's locked-email placeholder", () => {
    expect(
      matchToContact({ id: "p1", name: "Ana", email: "email_not_unlocked@domain.com" })?.email,
    ).toBeNull();
    expect(matchToContact({ id: "p1", name: "Ana", email: "Ana@Acme.com" })?.email).toBe(
      "ana@acme.com",
    );
  });
  it("needs enough identifiers to match a person", () => {
    expect(matchDetails({ name: "Ana García López", domain: "acme.com" })).toEqual({
      first_name: "Ana",
      last_name: "García López",
      name: "Ana García López",
      domain: "acme.com",
    });
    expect(() => matchDetails({ name: "Ana" })).toThrow(/identificar/);
  });
});

describe("apollo phones", () => {
  it("reads phones from the webhook, mobile first, skipping invalid numbers", () => {
    const out = phonesFromWebhook({
      people: [
        {
          id: "p1",
          phone_numbers: [
            { sanitized_number: "+34911111111", type_cd: "work_direct" },
            { sanitized_number: "+34600000000", type_cd: "mobile" },
            { raw_number: "123", type_cd: "mobile", status_cd: "invalid_number" },
          ],
        },
        { id: "p2", phone_numbers: [] },
      ],
    });
    expect(out).toEqual([
      {
        id: "p1",
        phones: [
          { number: "+34600000000", type: "mobile" },
          { number: "+34911111111", type: "work_direct" },
        ],
      },
      { id: "p2", phones: [] },
    ]);
    expect(phonesFromWebhook({ nope: 1 })).toEqual([]);
  });
  it("sends Apollo to the preview host from the editor and to the published host otherwise", () => {
    const pid = "284b5305-78bc-41f2-a9bb-09c2b2fd1faf";
    expect(apolloWebhookBase("localhost:8080", pid)).toBe(
      `${APOLLO_DEV_URL}/api/public/apollo/phone-webhook`,
    );
    expect(apolloWebhookBase(`id-preview--${pid}.lovable.app`, pid)).toBe(
      `${APOLLO_DEV_URL}/api/public/apollo/phone-webhook`,
    );
    expect(apolloWebhookBase("nokko.ai", pid)).toBe(
      `${APOLLO_PUBLISHED_URL}/api/public/apollo/phone-webhook`,
    );
    expect(apolloWebhookBase(new URL(APOLLO_PUBLISHED_URL).host, pid)).toBe(
      `${APOLLO_PUBLISHED_URL}/api/public/apollo/phone-webhook`,
    );
  });
  it("accepts only the exact webhook secret", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abd", "abc")).toBe(false);
    expect(sameSecret(null, "abc")).toBe(false);
  });
});

describe("apollo errors", () => {
  it("explains a plan that does not include the endpoint", () => {
    expect(apolloErrorText(403, '{"error_code":"API_INACCESSIBLE"}')).toMatch(/plan de pago/);
    expect(apolloErrorText(401, "")).toMatch(/Conexiones/);
  });
});

describe("accountInsertFromDraft (SDD universal-field-definitions, CA-1, CA-3)", () => {
  const draft = {
    name: "Acme Test",
    domain: "acme.test",
    industry: "Software",
    size: "51 a 200",
    country: "España",
    linkedin: null,
    description: "Texto",
    location: null,
    revenue: null,
  };
  it("saves size and country through the single rule", () => {
    expect(accountInsertFromDraft(draft, true)).toEqual({
      name: "Acme Test",
      domain: "acme.test",
      industry: "Software",
      size: "51–200 empleados",
      country: "ES",
      notes: "Texto",
      is_target: true,
    });
  });
  it("leaves a country that does not fit empty and keeps the rest", () => {
    expect(
      accountInsertFromDraft({ ...draft, size: null, country: "Narnia" }, false),
    ).toMatchObject({ size: null, country: null, is_target: false });
  });
});

describe("normalizeDraft (SDD field-write-paths-normalization, CA-1)", () => {
  const fromClay = (size: string | null, country: string | null = "Spain") =>
    normalizeDraft(companyToAccount({ name: "Acme Test", domain: "acme.test", size, country }));
  it("turns Clay's size texts into the canonical text", () => {
    expect(fromClay("51-200 employees").size).toBe("51–200 empleados");
    expect(fromClay("10,001+ employees").size).toBe("más de 10001 empleados");
    expect(fromClay("1001-5000 employees").size).toBe("1001–5000 empleados");
  });
  it("drops a size that is not a headcount", () => {
    expect(fromClay("Self-employed").size).toBeNull();
    expect(fromClay("0-1 employees").size).toBeNull();
    expect(fromClay(null).size).toBeNull();
  });
  it("keeps a recognised country as ISO and leaves the rest of the draft alone", () => {
    const d = fromClay("51-200 employees");
    expect(d).toMatchObject({ name: "Acme Test", domain: "acme.test", country: "ES" });
  });
  it("drops a country that does not fit", () => {
    expect(normalizeDraft({ ...fromClay(null), country: "Madrid, España" }).country).toBeNull();
  });
});

describe("accountInsertFromDraft drops a size that is not a headcount (SDD field-write-paths-normalization, CA-2)", () => {
  const row = {
    name: "Acme Test",
    domain: "acme.test",
    industry: null,
    size: "51-200 empleados",
    country: "ES",
    linkedin: null,
    description: null,
    location: null,
    revenue: null,
  };
  it("normalizes a row prepared with the old Clay format", () => {
    expect(accountInsertFromDraft(row, false).size).toBe("51–200 empleados");
  });
  it("does not save «Self-employed empleados»", () => {
    expect(
      accountInsertFromDraft({ ...row, size: "Self-employed empleados" }, false).size,
    ).toBeNull();
  });
});

describe("canonicalCurrent (SDD field-write-paths-normalization, CA-6)", () => {
  const acc = { industry: "Software", size: "51-200 empleados", country: "ES", notes: null };
  it("a current size that only differs in format produces no change", () => {
    const cur = canonicalCurrent(acc);
    expect(cur.size).toBe("51–200 empleados");
    expect(
      enrichChanges(cur, {
        ...normalizeDraft(companyToAccount({ name: "A", size: "51-200 employees" })),
      }),
    ).toEqual([]);
  });
  it("keeps a current country that does not fit, so the field is never seen as empty", () => {
    const cur = canonicalCurrent({ ...acc, country: "Madrid, España" });
    expect(cur.country).toBe("Madrid, España");
    const ch = enrichChanges(
      cur,
      normalizeDraft(companyToAccount({ name: "A", country: "France" })),
    );
    expect(ch).toEqual([
      { field: "country", current: "Madrid, España", proposed: "FR", empty: false },
    ]);
  });
  it("keeps a current size that is not a headcount and leaves empty fields empty", () => {
    expect(canonicalCurrent({ ...acc, size: "unos 50" }).size).toBe("unos 50");
    const empty = canonicalCurrent({ ...acc, size: null, country: "  " });
    expect(empty.size).toBeNull();
    expect(empty.country).toBe("  ");
  });
  it("canonizes a country written as a name", () => {
    expect(canonicalCurrent({ ...acc, country: "España" }).country).toBe("ES");
  });
});
