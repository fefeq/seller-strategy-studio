import { describe, expect, it } from "vitest";
import { FREE_MAIL_DOMAINS, isFreeMail } from "./free-mail";
import { corporateDomain } from "./lead-flow";
import { emailDomainOf } from "./lead-qualification";
import { domainFromEmail } from "./leads";
import { companyDomain } from "./product-usage";

const ALL = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.es",
  "outlook.com",
  "outlook.es",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.es",
  "yandex.com",
  "zoho.com",
  "mail.com",
  "telefonica.net",
  "terra.es",
];

describe("free mail list", () => {
  it("has the 23 consumer domains, once", () => {
    expect([...FREE_MAIL_DOMAINS].sort()).toEqual([...ALL].sort());
    expect(FREE_MAIL_DOMAINS.size).toBe(23);
  });
  it("matches case-insensitively and ignores empty values", () => {
    expect(isFreeMail("Outlook.ES")).toBe(true);
    expect(isFreeMail("acme.com")).toBe(false);
    expect(isFreeMail(null)).toBe(false);
    expect(isFreeMail("")).toBe(false);
  });
  it("is the one list every module uses: each domain is personal everywhere", () => {
    for (const d of ALL) {
      expect(corporateDomain(`ana@${d}`), `lead-flow ${d}`).toBeNull();
      expect(domainFromEmail(`ana@${d}`), `leads ${d}`).toBeNull();
      expect(emailDomainOf(`ana@${d}`).personal, `qualification ${d}`).toBe(true);
      expect(companyDomain(`ana@${d}`), `product-usage ${d}`).toBeNull();
    }
    expect(corporateDomain("ana@acme.com")).toBe("acme.com");
    expect(domainFromEmail("ana@acme.com")).toBe("acme.com");
    expect(emailDomainOf("ana@acme.com").personal).toBe(false);
  });
});
