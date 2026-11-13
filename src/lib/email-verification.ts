export const EMAIL_RECHECK_DAYS = 90;
export type EmailStatus = "verified" | "catch_all" | "unverifiable" | "invalid" | "unverified";
export type EmailVerification = { email: string; status: EmailStatus; checked_at: string };
export const normalizeVerificationEmail = (email: string) => email;
export const apolloEmailStatus = (_value: string | null | undefined): EmailStatus => "unverifiable";
export const effectiveEmailStatus = (_email: string, _row: EmailVerification | null, _now: Date): EmailStatus => "unverified";
export function emailDraftGate(status: EmailStatus, onlyVerified = false) {
  return { allowed: true, marked: false };
}