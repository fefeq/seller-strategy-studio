// Minimum key to research an account, identify a person or work a lead (pure, tested in fit-key.test.ts).
// One place decides what is missing; screens, the Agent and automations get the same answer and message.
import { cleanDomain } from "@/lib/leads";
import { isFreeMail } from "./free-mail";

export type KeyEntity = "cuenta" | "persona" | "lead";
/** What the account is needed for: all three need its domain (no provider uses the LinkedIn URL yet). */
export type KeyNeed = "research_account" | "enrich_account" | "find_stakeholders";
export type MissingKey = { key: "name" | "domain" | "identity" | "account"; reason: "missing" | "personal_mail"; domain?: string };

export type AccountKeyRecord = { name?: string | null; domain?: string | null; linkedin_url?: string | null };
export type PersonKeyRecord = { id?: string | null; name?: string | null; email?: string | null; linkedin_url?: string | null; domain?: string | null };
export type LeadKeyRecord = { account?: AccountKeyRecord | null };
export type KeyRecord = AccountKeyRecord | PersonKeyRecord | LeadKeyRecord;

export class MissingKeyError extends Error {
  constructor(message: string, readonly entity: KeyEntity, readonly missing: MissingKey[]) {
    super(message);
    this.name = "MissingKeyError";
  }
}

const blank = (v: string | null | undefined) => !(v ?? "").trim();

/** The domain only when it can be searched with: valid and not a personal mailbox. */
function domainState(raw: string | null | undefined): { ok: true } | { ok: false; reason: MissingKey["reason"]; domain?: string } {
  const d = cleanDomain(raw);
  if (!d) return { ok: false, reason: "missing" };
  return isFreeMail(d) ? { ok: false, reason: "personal_mail", domain: d } : { ok: true };
}

const domainGap = (raw: string | null | undefined): MissingKey[] => {
  const st = domainState(raw);
  return st.ok ? [] : [{ key: "domain", reason: st.reason, ...(st.domain ? { domain: st.domain } : {}) }];
};

/**
 * What is missing, with the reason. Without `need`: the identity key (account = name + corporate domain or company
 * LinkedIn; person = id, email or LinkedIn, or name + corporate domain; lead = linked account with a corporate domain).
 * With `need` an account must have a corporate domain: no provider uses its LinkedIn URL.
 */
export function missingKey(entity: KeyEntity, record: KeyRecord | null | undefined, need?: KeyNeed): MissingKey[] {
  if (entity === "cuenta") {
    const a = (record ?? {}) as AccountKeyRecord;
    if (need) return domainGap(a.domain);
    const out: MissingKey[] = blank(a.name) ? [{ key: "name", reason: "missing" }] : [];
    if (!blank(a.linkedin_url) || domainState(a.domain).ok) return out;
    return [...out, ...domainGap(a.domain)];
  }
  if (entity === "persona") {
    const p = (record ?? {}) as PersonKeyRecord;
    if (!blank(p.id) || !blank(p.email) || !blank(p.linkedin_url)) return [];
    if (blank(p.name)) return [{ key: "identity", reason: "missing" }];
    const st = domainState(p.domain);
    return st.ok ? [] : [{ key: "identity", reason: st.reason, ...(st.domain ? { domain: st.domain } : {}) }];
  }
  const account = (record as LeadKeyRecord | null | undefined)?.account;
  if (!account) return [{ key: "account", reason: "missing" }];
  return domainGap(account.domain);
}

const NEED_TEXT: Record<KeyNeed, { verb: string; prep: string }> = {
  research_account: { verb: "investigar", prep: "a" },
  enrich_account: { verb: "completar", prep: "a" },
  find_stakeholders: { verb: "buscar personas de", prep: "" },
};

function message(entity: KeyEntity, record: KeyRecord | null | undefined, missing: MissingKey[], need?: KeyNeed): string {
  const personal = missing.find((m) => m.reason === "personal_mail");
  if (entity === "persona")
    return "Faltan datos para identificar a la persona: hace falta su LinkedIn, su email o su nombre y el dominio de la cuenta." + (personal ? ` El dominio ${personal.domain} es de correo personal y no identifica a nadie.` : "");
  if (entity === "lead") {
    if (missing.some((m) => m.key === "account")) return "Para trabajar el lead falta vincularlo a una cuenta con dominio. Vincúlalo a una cuenta o añade el dominio de su empresa.";
    return personal ? `Para trabajar el lead no sirve el dominio ${personal.domain}: es de correo personal. Escribe el de la empresa (acme.com).` : "Para trabajar el lead falta el dominio de su cuenta. Escríbelo en la ficha (acme.com) o añade un contacto con email de empresa.";
  }
  const a = (record ?? {}) as AccountKeyRecord;
  const name = blank(a.name) ? null : a.name!.trim();
  if (!need) {
    const parts = missing.map((m) => (m.key === "name" ? "su nombre" : m.reason === "personal_mail" ? `un dominio de empresa (${m.domain} es de correo personal) o su LinkedIn` : "su dominio o su LinkedIn"));
    return `Faltan datos para identificar la cuenta: ${parts.join(" y ")}.`;
  }
  const t = NEED_TEXT[need];
  const subject = name ? [t.prep, name].filter(Boolean).join(" ") : "la cuenta";
  const lead = `Para ${t.verb} ${subject}`;
  return personal
    ? `${lead} no sirve el dominio ${personal.domain}: es de correo personal. Escribe el de la empresa (acme.com).`
    : `${lead} falta el dominio. Escríbelo en la ficha (acme.com) o añade un contacto con email de empresa.`;
}

/** Throws MissingKeyError (entity + what is missing) when `missingKey` is not empty. */
export function requireKey(entity: KeyEntity, record: KeyRecord | null | undefined, need?: KeyNeed): void {
  const missing = missingKey(entity, record, need);
  if (missing.length) throw new MissingKeyError(message(entity, record, missing, need), entity, missing);
}

/** The corporate domain most contacts share, counting each distinct email once; null with none or on a tie. */
export function proposeDomain(contacts: { email?: string | null }[]): string | null {
  const emails = new Set<string>();
  for (const c of contacts) {
    const e = (c.email ?? "").trim().toLowerCase();
    if (e) emails.add(e);
  }
  const counts = new Map<string, number>();
  for (const e of emails) {
    const at = e.lastIndexOf("@");
    const d = at > 0 ? cleanDomain(e.slice(at + 1)) : null;
    if (d && !isFreeMail(d)) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const ranked = [...counts].sort((x, y) => y[1] - x[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0]![1])) return null;
  return ranked[0]![0];
}
