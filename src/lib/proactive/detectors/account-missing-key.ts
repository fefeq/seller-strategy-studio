import { hash } from "@/lib/field-proposals";
import { missingKey, proposeDomain } from "@/lib/fit-key";
import { duplicateOf } from "@/lib/match";
import type { Detector, Suggestion } from "../types";

/** At most this many per pass. */
const CAP = 5;

/**
 * An account without a usable domain (empty or personal mail) whose contacts share a corporate one → «Propuesta de dominio»
 * the person confirms (update_account). If another account already has that domain the suggestion is a warning without action
 * (never a merge). Oldest accounts first and stable (created_at, id): syncSuggestions closes what the detector stops emitting and
 * an ignored duplicate keeps the closed row, so a newest-first cap would push the fifth out for good when a new account arrived.
 * Duplicate warnings count towards the cap. Addressed to the account owner, else the company Owner.
 */
export const accountMissingKey: Detector = (s) => {
  const fk = s.fitKey;
  if (!fk) return [];
  const domainOf = new Map(fk.accounts.map((a) => [a.id, a.domain]));
  const emails = new Map<string, { email: string | null }[]>();
  for (const c of fk.contacts) emails.set(c.account_id, [...(emails.get(c.account_id) ?? []), { email: c.email }]);
  const owner = (s.members ?? []).find((m) => m.role === "owner")?.user_id ?? null;
  const withDomain = s.accounts.map((a) => ({ id: a.id, name: a.name, domain: domainOf.get(a.id) ?? null })).filter((a) => !!a.domain);
  const out: Suggestion[] = [];
  const oldestFirst = [...s.accounts].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  for (const a of oldestFirst) {
    if (out.length >= CAP) break;
    if (!missingKey("cuenta", { name: a.name, domain: domainOf.get(a.id) ?? null }, "research_account").length) continue;
    const domain = proposeDomain(emails.get(a.id) ?? []);
    if (!domain) continue;
    const same = duplicateOf({ domain }, withDomain.filter((o) => o.id !== a.id));
    const user_id = a.owner_id ?? owner;
    if (same?.kind === "same") {
      out.push({
        detector: "account_missing_key",
        dedupe_key: `missing_domain_dup:${a.id}:${same.item.id}`,
        priority: 3,
        title: "Propuesta de dominio",
        body: `${a.name} no tiene dominio y sus contactos usan ${domain}, pero ${same.item.name} ya tiene ese dominio: puede ser un duplicado. Revísalo antes de escribirlo.`,
        link: `/accounts/${same.item.id}`,
        action: null,
        user_id,
      });
      continue;
    }
    out.push({
      detector: "account_missing_key",
      dedupe_key: `missing_domain:${a.id}:${hash(domain)}`,
      priority: 3,
      title: "Propuesta de dominio",
      body: `Propuesta de dominio: ${domain} para ${a.name}, deducido del email de sus contactos. ¿Lo confirmas?`,
      link: `/accounts/${a.id}`,
      action: { tool: "update_account", args: { account_id: a.id, domain } },
      user_id,
    });
  }
  return out;
};
