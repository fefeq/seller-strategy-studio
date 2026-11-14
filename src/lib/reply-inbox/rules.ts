// NK-0174 SDD 1 (pure, tested). Phase 1: only a superadmin may link a mailbox, until the legal review (Q-4).
export const LEGAL_GATE_TEXT =
  "Hasta la revisión legal solo puede conectarse el buzón de Fede (superadmin).";

/** R-3: the closed list of Gmail operations NOKKO may perform. No history, watch, send or modify. */
export const GMAIL_OPERATIONS = ["profile", "listMessages", "getMetadata", "getBody"] as const;
export type GmailOperation = (typeof GMAIL_OPERATIONS)[number];

export function canLinkMailbox(p: { isPlatformAdmin: boolean; isMember: boolean }): {
  ok: boolean;
  reason?: string;
} {
  if (!p.isMember) return { ok: false, reason: "No perteneces a esta empresa." };
  if (!p.isPlatformAdmin) return { ok: false, reason: LEGAL_GATE_TEXT };
  return { ok: true };
}

/** Metadata batches are capped at 50 ids per request (Gmail batch limit). */
export function chunkIds(ids: string[], size = 50): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}
