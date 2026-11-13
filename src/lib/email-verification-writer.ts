// NK-0173: stores the email status Apollo already returns in a reveal. The row builder is pure
// (tested); the write uses the privileged client with an explicit org_id, because the table has
// no insert/update policy for members. Never logs an email address.
import { apolloEmailStatus, normalizeVerificationEmail, type EmailStatus } from "./email-verification";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import type { Db } from "./org-data";

export type VerificationRow = {
  org_id: string;
  email: string;
  status: EmailStatus;
  provider_status: string | null;
  provider: "apollo";
  source: "revelado_apollo";
  checked_at: string;
  requested_by: string | null;
};

/** Builds the row for one revealed address, or null when there is no address to store. */
export function buildVerificationRow(a: {
  orgId: string;
  email: string | null | undefined;
  providerStatus: string | null | undefined;
  requestedBy: string | null;
  now: Date;
}): VerificationRow | null {
  const email = normalizeVerificationEmail(a.email ?? "");
  if (!email) return null;
  return {
    org_id: a.orgId,
    email,
    status: apolloEmailStatus(a.providerStatus),
    provider_status: a.providerStatus?.slice(0, 120) ?? null,
    provider: "apollo",
    source: "revelado_apollo",
    checked_at: a.now.toISOString(),
    requested_by: a.requestedBy,
  };
}

/** Upserts the rows by (org_id, email). A failure is logged and never breaks the reveal itself. */
export async function recordApolloVerifications(rows: VerificationRow[]): Promise<void> {
  if (!rows.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("email_verifications")
    .upsert(rows, { onConflict: "org_id,email" });
  if (error) console.error("email_verifications upsert failed", safeErrorLog(error));
}

/** Registers a blocked draft (surface, state, reason) — never the address. Works with the member's client too. */
export async function recordEmailDraftBlock(
  db: Db,
  orgId: string,
  block: { surface: "draft_followup" | "followup_sequence"; status: EmailStatus; reason: string },
): Promise<void> {
  const { error } = await db.from("email_draft_blocks").insert({ org_id: orgId, ...block });
  if (error) console.error("email_draft_blocks insert failed", safeErrorLog(error));
}
