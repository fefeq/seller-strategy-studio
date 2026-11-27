// Pure rules for assistant expenses and company currency.
// The database functions (set_org_currency, record_assistant_expense) enforce the same rules on the server.

export const KNOWN_CURRENCIES = [
  "COP",
  "MXN",
  "USD",
  "EUR",
  "ARS",
  "CLP",
  "PEN",
  "BRL",
  "UYU",
  "PYG",
  "BOB",
  "GTQ",
  "CRC",
  "DOP",
  "HNL",
  "NIO",
  "PAB",
  "VES",
  "GBP",
  "CAD",
] as const;

export type CurrencyCode = (typeof KNOWN_CURRENCIES)[number];

export function normalizeCurrency(value: unknown): CurrencyCode | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return (KNOWN_CURRENCIES as readonly string[]).includes(code) ? (code as CurrencyCode) : null;
}

export type ExpenseCheck =
  | { ok: true; currency: CurrencyCode }
  | { ok: false; reason: "needs_company_currency" | "invalid_amount" | "unknown_currency" | "currency_mismatch"; message: string };

export function checkExpense(
  input: { amount: unknown; currency?: unknown },
  companyCurrency: unknown,
): ExpenseCheck {
  const company = normalizeCurrency(companyCurrency);
  if (!company) {
    return { ok: false, reason: "needs_company_currency", message: "Elige la moneda de tu empresa antes de anotar el primer gasto." };
  }
  const amount = typeof input.amount === "number" ? input.amount : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "invalid_amount", message: "La cifra del gasto debe ser mayor a cero." };
  }
  const raw = input.currency;
  const currency = raw === undefined || raw === null || raw === "" ? company : normalizeCurrency(raw);
  if (!currency) {
    return { ok: false, reason: "unknown_currency", message: "La moneda del gasto no está reconocida." };
  }
  if (currency !== company) {
    return {
      ok: false,
      reason: "currency_mismatch",
      message: `Este gasto llegó en ${currency} y tu empresa trabaja en ${company}. No se guardó.`,
    };
  }
  return { ok: true, currency };
}

export function canChangeCompanyCurrency(role: string | null | undefined): boolean {
  return role === "owner";
}

export type ExpenseRow = { amount: number; currency: string; needs_review?: boolean };
export type CurrencyTotal = { currency: string; total: number; expenses: number; toReview: number };

// Totals are always grouped by currency; amounts in different currencies are never added together.
export function totalsByCurrency(rows: ExpenseRow[]): CurrencyTotal[] {
  const map = new Map<string, CurrencyTotal>();
  for (const row of rows) {
    const key = row.currency.trim().toUpperCase();
    const current = map.get(key) ?? { currency: key, total: 0, expenses: 0, toReview: 0 };
    current.total += row.amount;
    current.expenses += 1;
    if (row.needs_review) current.toReview += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
