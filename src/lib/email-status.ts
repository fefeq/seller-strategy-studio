// NK-0173 SDD 3: Spanish labels and the graduated-gate sentences shared by every surface that
// drafts for a known address (draft_followup, followup_sequence). Pure; tested in email-status.test.ts.
import { effectiveEmailStatus, type EmailStatus, type EmailVerification } from "./email-verification";

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  verified: "verificado",
  catch_all: "catch-all",
  unverifiable: "no verificable",
  invalid: "inválido",
  unverified: "sin verificar",
};

/** Visible mark for drafts that pass with an address whose state is unknown. */
export const emailGateMark = (status: EmailStatus): string | null =>
  status === "unverified"
    ? "email sin verificar"
    : status === "unverifiable"
      ? "email no verificable"
      : null;

/** Reason and what to do when the gate blocks a draft; null when it does not block. */
export const emailBlockReason = (status: EmailStatus): string | null =>
  status === "invalid"
    ? "Este email es inválido: no preparo el borrador. Busca otro contacto de la cuenta."
    : status === "catch_all"
      ? "Este dominio acepta cualquier dirección (catch-all): no preparo el borrador. Busca otro contacto de la cuenta."
      : null;

/** Effective status of an address right now; null when there is no address (not a case of the rule). */
export function emailStatusFor(
  email: string | null | undefined,
  row: EmailVerification | null,
  now: Date,
): EmailStatus | null {
  if (!email?.trim()) return null;
  return effectiveEmailStatus(email, row, now);
}
