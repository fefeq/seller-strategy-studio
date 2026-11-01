import { describe, expect, it } from "vitest";
import { MissingKeyError, missingKey, proposeDomain, requireKey } from "./fit-key";

const keys = (m: ReturnType<typeof missingKey>) => m.map((x) => `${x.key}:${x.reason}`);

describe("account key with a need", () => {
  it.each(["research_account", "enrich_account", "find_stakeholders"] as const)("%s needs the domain, and LinkedIn alone is not enough", (need) => {
    expect(missingKey("cuenta", { name: "Acme", domain: "acme.com" }, need)).toEqual([]);
    expect(keys(missingKey("cuenta", { name: "Acme", domain: null }, need))).toEqual(["domain:missing"]);
    expect(keys(missingKey("cuenta", { name: "Acme", domain: "", linkedin_url: "https://linkedin.com/company/acme" }, need))).toEqual(["domain:missing"]);
    expect(keys(missingKey("cuenta", null, need))).toEqual(["domain:missing"]);
  });
  it("normalizes case, www and path before checking", () => {
    expect(missingKey("cuenta", { domain: " WWW.Acme.com/es?x=1 " }, "research_account")).toEqual([]);
  });
  it("treats a personal-mail domain as missing, and says why (CA-5)", () => {
    expect(missingKey("cuenta", { domain: "gmail.com" }, "enrich_account")).toEqual([{ key: "domain", reason: "personal_mail", domain: "gmail.com" }]);
    expect(keys(missingKey("cuenta", { domain: "outlook.es" }, "research_account"))).toEqual(["domain:personal_mail"]);
  });
  it("treats a value that is not a domain as missing", () => {
    expect(keys(missingKey("cuenta", { domain: "acme" }, "research_account"))).toEqual(["domain:missing"]);
  });
});

describe("account identity key (no need)", () => {
  it("is the name plus a corporate domain or the company LinkedIn", () => {
    expect(missingKey("cuenta", { name: "Acme", domain: "acme.com" })).toEqual([]);
    expect(missingKey("cuenta", { name: "Acme", linkedin_url: "https://linkedin.com/company/acme" })).toEqual([]);
    expect(missingKey("cuenta", { name: "Acme", domain: "gmail.com", linkedin_url: "https://linkedin.com/company/acme" })).toEqual([]);
  });
  it("lists the name and the domain when each is missing", () => {
    expect(keys(missingKey("cuenta", { name: " ", domain: "acme.com" }))).toEqual(["name:missing"]);
    expect(keys(missingKey("cuenta", { name: "Acme" }))).toEqual(["domain:missing"]);
    expect(keys(missingKey("cuenta", { name: "Acme", domain: "yahoo.es" }))).toEqual(["domain:personal_mail"]);
    expect(keys(missingKey("cuenta", {}))).toEqual(["name:missing", "domain:missing"]);
  });
});

describe("person key", () => {
  it("accepts a provider id, an email or a LinkedIn URL on their own", () => {
    expect(missingKey("persona", { id: "ap_1" })).toEqual([]);
    expect(missingKey("persona", { email: "ana@acme.com" })).toEqual([]);
    expect(missingKey("persona", { linkedin_url: "https://linkedin.com/in/ana" })).toEqual([]);
  });
  it("accepts a name plus the account domain (CA-9: a single name is enough, no surname)", () => {
    expect(missingKey("persona", { name: "Ana", domain: "acme.com" })).toEqual([]);
    expect(missingKey("persona", { name: "Ana García López", domain: "acme.com" })).toEqual([]);
  });
  it("flags a name alone, with no account domain, email or LinkedIn", () => {
    expect(keys(missingKey("persona", { name: "Ana" }))).toEqual(["identity:missing"]);
    expect(keys(missingKey("persona", {}))).toEqual(["identity:missing"]);
  });
  it("name plus a personal-mail domain no longer identifies a person (P-11)", () => {
    expect(keys(missingKey("persona", { name: "Ana", domain: "gmail.com" }))).toEqual(["identity:personal_mail"]);
    expect(missingKey("persona", { name: "Ana", domain: "gmail.com", email: "ana@acme.com" })).toEqual([]);
  });
});

describe("lead key", () => {
  it("is a linked account with a corporate domain; the person is optional", () => {
    expect(missingKey("lead", { account: { name: "Acme", domain: "acme.com" } })).toEqual([]);
    expect(keys(missingKey("lead", { account: null }))).toEqual(["account:missing"]);
    expect(keys(missingKey("lead", { account: { name: "Acme", domain: null } }))).toEqual(["domain:missing"]);
    expect(keys(missingKey("lead", { account: { name: "Acme", domain: "gmx.es" } }))).toEqual(["domain:personal_mail"]);
  });
});

describe("requireKey", () => {
  it("passes when nothing is missing", () => {
    expect(() => requireKey("cuenta", { name: "Acme", domain: "acme.com" }, "research_account")).not.toThrow();
  });
  it("throws a typed error with the entity and what is missing", () => {
    let err: unknown;
    try { requireKey("cuenta", { name: "Acme" }, "research_account"); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(MissingKeyError);
    expect(err).toBeInstanceOf(Error);
    expect((err as MissingKeyError).entity).toBe("cuenta");
    expect((err as MissingKeyError).missing).toEqual([{ key: "domain", reason: "missing" }]);
  });
  it("says «dominio» when the domain is missing, with the verb of the need and the account name", () => {
    expect(() => requireKey("cuenta", { name: "Acme" }, "research_account")).toThrow(/Para investigar a Acme falta el dominio/);
    expect(() => requireKey("cuenta", { name: "Acme" }, "enrich_account")).toThrow(/Para completar a Acme falta el dominio/);
    expect(() => requireKey("cuenta", { name: "Acme" }, "find_stakeholders")).toThrow(/Para buscar personas de Acme falta el dominio/);
    for (const need of ["research_account", "enrich_account", "find_stakeholders"] as const)
      expect(() => requireKey("cuenta", {}, need)).toThrow(/dominio/);
  });
  it("uses «la cuenta» when the name is unknown", () => {
    expect(() => requireKey("cuenta", null, "research_account")).toThrow(/Para investigar la cuenta falta el dominio/);
    expect(() => requireKey("cuenta", { name: "  " }, "find_stakeholders")).toThrow(/Para buscar personas de la cuenta falta el dominio/);
  });
  it("does not promise a proposal: it points to the record or to a contact with a company email", () => {
    expect(() => requireKey("cuenta", { name: "Acme" }, "research_account")).toThrow(/Escríbelo en la ficha \(acme\.com\) o añade un contacto con email de empresa/);
    expect(() => requireKey("cuenta", { name: "Acme" }, "research_account")).not.toThrow(/propuesta/i);
  });
  it("says the domain is personal mail instead of «falta»", () => {
    expect(() => requireKey("cuenta", { name: "Acme", domain: "gmail.com" }, "research_account")).toThrow(/Para investigar a Acme no sirve el dominio gmail\.com: es de correo personal/);
    expect(() => requireKey("cuenta", { name: "Acme", domain: "gmail.com" }, "research_account")).not.toThrow(/falta/);
  });
  it("keeps «identificar» in the person message", () => {
    expect(() => requireKey("persona", { name: "Ana" })).toThrow(/identificar/);
    expect(() => requireKey("persona", { name: "Ana", domain: "gmail.com" })).toThrow(/identificar/);
  });
  it("names the missing linked account for a lead", () => {
    expect(() => requireKey("lead", { account: null })).toThrow(/cuenta/);
    expect(() => requireKey("lead", { account: { name: "Acme", domain: null } })).toThrow(/dominio/);
  });
});

describe("proposeDomain", () => {
  const c = (...emails: (string | null)[]) => emails.map((email) => ({ email }));
  it("returns the most frequent corporate domain among distinct emails", () => {
    expect(proposeDomain(c("ana@acme.com", "luis@acme.com", "eva@otra.com"))).toBe("acme.com");
  });
  it("counts one person once, however many times and however the email is written", () => {
    expect(proposeDomain(c("ana@acme.com", "Ana@Acme.com", " ana@acme.com ", "eva@otra.com", "leo@otra.com"))).toBe("otra.com");
  });
  it("ignores personal mail, empty and malformed emails", () => {
    expect(proposeDomain(c("ana@gmail.com", "luis@outlook.es", null, "", "sin-arroba", "eva@acme.com"))).toBe("acme.com");
    expect(proposeDomain(c("ana@gmail.com", "luis@yahoo.es"))).toBeNull();
    expect(proposeDomain([])).toBeNull();
  });
  it("does not choose on a tie", () => {
    expect(proposeDomain(c("ana@acme.com", "eva@acme-filial.com"))).toBeNull();
    expect(proposeDomain(c("a@x.com", "b@x.com", "c@y.com", "d@y.com", "e@z.com"))).toBeNull();
  });
});
