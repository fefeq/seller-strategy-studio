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

// STUB (red commit): compiles and answers wrongly so the new tests fail by assertion.
export function missingKey(_entity: KeyEntity, _record: KeyRecord | null | undefined, _need?: KeyNeed): MissingKey[] {
  return [];
}

export function requireKey(_entity: KeyEntity, _record: KeyRecord | null | undefined, _need?: KeyNeed): void {
  void isFreeMail;
  void cleanDomain;
}

export function proposeDomain(_contacts: { email?: string | null }[]): string | null {
  return null;
}
