export const CURRENCIES: Record<string, string> = {
  EUR: "Euro (EUR)",
  USD: "Dólar estadounidense (USD)",
  GBP: "Libra esterlina (GBP)",
  CHF: "Franco suizo (CHF)",
  MXN: "Peso mexicano (MXN)",
  COP: "Peso colombiano (COP)",
  CLP: "Peso chileno (CLP)",
  ARS: "Peso argentino (ARS)",
  PEN: "Sol peruano (PEN)",
  BRL: "Real brasileño (BRL)",
  UYU: "Peso uruguayo (UYU)",
  CAD: "Dólar canadiense (CAD)",
};

export function formatMoney(n: number, currency = "EUR", compact = false) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(n);
}

export function currencySymbol(currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
}
