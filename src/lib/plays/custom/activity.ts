export function summarizePlayCosts(rows: Array<{ cost_kind: string; currency: string | null; amount: number }>) {
  const groups = new Map<string, { kind: string; currency: string; amount: number }>();
  let unknown = 0;
  for (const r of rows) {
    if (r.cost_kind === "ai_sin_dato" || !r.currency) { unknown++; continue; }
    const key = `${r.cost_kind}:${r.currency}`;
    const group = groups.get(key) ?? { kind: r.cost_kind, currency: r.currency, amount: 0 };
    group.amount += Number(r.amount); groups.set(key, group);
  }
  return { totals: [...groups.values()], unknown };
}