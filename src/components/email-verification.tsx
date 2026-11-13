import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { loadEmailVerifications, verificationEmails } from "@/lib/email-verification-read";
import { EMAIL_STATUS_LABEL, emailStatusFor } from "@/lib/email-status";
import { normalizeVerificationEmail, type EmailVerification } from "@/lib/email-verification";
import { errorText } from "@/lib/errors";

export function useEmailVerifications(emails: readonly (string | null | undefined)[]) {
  const { data: me } = useMe();
  const orgId = me?.currentOrg?.org_id ?? null;
  const addresses = verificationEmails(emails);
  return useQuery({
    queryKey: ["email-verifications", orgId, addresses],
    enabled: !!orgId && addresses.length > 0,
    queryFn: () => loadEmailVerifications(supabase, orgId, addresses),
    staleTime: 60_000,
  });
}

export function EmailVerificationMark({ email, rows = [], error }: { email: string | null | undefined; rows?: EmailVerification[]; error?: unknown }) {
  const row = rows.find((r) => r.email === normalizeVerificationEmail(email ?? "")) ?? null;
  const status = emailStatusFor(email, error ? null : row, new Date());
  if (!status) return null;
  const at = row?.checked_at && Number.isFinite(Date.parse(row.checked_at)) ? row.checked_at : null;
  return <span className="mt-1 block text-xs text-muted-foreground">
    <span className={status === "verified" ? "text-success" : status === "invalid" || status === "catch_all" ? "text-destructive" : undefined}>{EMAIL_STATUS_LABEL[status]}</span>
    {at && <> · <time dateTime={at}>{new Date(at).toLocaleDateString("es-ES")}</time></>}
    {!!error && <span className="block">{errorText(error)}</span>}
  </span>;
}