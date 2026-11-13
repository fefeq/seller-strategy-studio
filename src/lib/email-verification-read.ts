import type { Db } from "./org-data";
import { normalizeVerificationEmail, type EmailVerification, type EmailStatus } from "./email-verification";

export function verificationEmails(emails: readonly (string | null | undefined)[]): string[] {
  return [...new Set(emails.map((email) => normalizeVerificationEmail(email ?? "")).filter(Boolean))].sort();
}

/** Member client only: batch visible addresses, with explicit company scope in addition to RLS. */
export async function loadEmailVerifications(db: Db, orgId: string | null, emails: readonly (string | null | undefined)[]): Promise<EmailVerification[]> {
  const addresses = verificationEmails(emails);
  if (!orgId || !addresses.length) return [];
  const rows: EmailVerification[] = [];
  for (let offset = 0; offset < addresses.length; offset += 100) {
    const { data, error } = await db.from("email_verifications").select("email,status,checked_at").eq("org_id", orgId).in("email", addresses.slice(offset, offset + 100));
    if (error) throw error;
    for (const row of data ?? []) {
      // The database CHECK constrains status to the five shared values.
      rows.push({ ...row, status: row.status as EmailStatus });
    }
  }
  return rows;
}