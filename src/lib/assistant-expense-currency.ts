// Pure rules for assistant expenses and company currency.
// The currency always comes from the company settings stored on the server;
// the value sent by the screen or the assistant is only compared, never trusted.

export type ExpenseRejectReason =
  | "invalid_amount"
  | "missing_org_currency"
  | "missing_currency"
  | "currency_mismatch";

export type ExpenseDecision =
  | { kind: "save"; amount: number; currency: string }
  | { kind: "reject"; reason: ExpenseRejectReason; message: string };

export const REJECTED_EXPENSE_MESSAGE =
  "Un gasto del asistente no se guardó porque no venía en la moneda de tu empresa o el monto no era válido. Revisa la acción antes de repetirla.";

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return CURRENCY_PATTERN.test(upper) ? upper : null;
}

export function parsePositiveAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function decideAssistantExpense(input: {
  orgCurrency: unknown;
  incomingCurrency: unknown;
  amount: unknown;
}): ExpenseDecision {
  const amount = parsePositiveAmount(input.amount);
  if (amount === null) return reject("invalid_amount");
  const orgCurrency = normalizeCurrency(input.orgCurrency);
  if (!orgCurrency) return reject("missing_org_currency");
  const incoming = normalizeCurrency(input.incomingCurrency);
  if (!incoming) return reject("missing_currency");
  if (incoming !== orgCurrency) return reject("currency_mismatch");
  return { kind: "save", amount, currency: orgCurrency };
}

export function expenseIdempotencyKey(actionId: string): string {
  const id = actionId.trim();
  if (!id) throw new Error("actionId is required");
  return `assistant-action:${id}`;
}

export function canManageOrgCurrency(role: string | null | undefined): boolean {
  return role === "owner";
}

function reject(reason: ExpenseRejectReason): ExpenseDecision {
  return { kind: "reject", reason, message: REJECTED_EXPENSE_MESSAGE };
}
