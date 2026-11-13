export const EMAIL_RECHECK_DAYS = 90;
export type EmailStatus = "verified" | "catch_all" | "unverifiable" | "invalid" | "unverified";
export type EmailVerification = { email: string; status: EmailStatus; checked_at: string };
export const normalizeVerificationEmail = (email: string) => email.trim().toLowerCase();
export const apolloEmailStatus = (value: string | null | undefined): EmailStatus =>
  value === "verified" ? "verified" : "unverifiable";
export function effectiveEmailStatus(email: string, row: EmailVerification | null, now: Date): EmailStatus {
  if (!row || !normalizeVerificationEmail(email) || normalizeVerificationEmail(email) !== normalizeVerificationEmail(row.email)) return "unverified";
  const age = now.getTime() - new Date(row.checked_at).getTime();
  if (!Number.isFinite(age) || age < 0 || age > EMAIL_RECHECK_DAYS * 86400000) return "unverified";
  return row.status;
}
export function emailDraftGate(status: EmailStatus, onlyVerified = false) {
  const blocked = status === "invalid" || status === "catch_all";
  return { allowed: !blocked && (!onlyVerified || status === "verified"), marked: status === "unverified" || status === "unverifiable" };
}