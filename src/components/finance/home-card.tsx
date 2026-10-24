import { Link } from "@tanstack/react-router";
import { useCurrency } from "@/hooks/use-me";
import { useFinance, useIsFinance } from "./data";
import { financeSteps, useFinanceView } from "./summary";

/** Inicio, Owner and Sales Leader only: cash, months of cash and what is pending, without opening Finanzas. */
export function FinanceHomeCard() {
  const allowed = useIsFinance();
  const { money } = useCurrency();
  const { data } = useFinance();
  const v = useFinanceView(data);
  if (!allowed || !data || !v) return null;
  const missing = financeSteps(data).filter((s) => !s.done).length;
  return (
    <Link to="/finance" className="block rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-ink-faint">
      <p className="eyebrow">Finanzas</p>
      {v.configured ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-display text-2xl">{money(v.cashNow)}</span>
          <span className={`text-sm ${v.runway != null && v.runway < 6 ? "text-signal" : "text-ink-mid"}`}>{v.runway == null ? "No consumes caja" : `${v.runway} meses de caja`}</span>
          {v.aging.overdue > 0 && <span className="text-sm text-signal">{money(v.aging.overdue)} vencidos sin cobrar</span>}
        </div>
      ) : <p className="mt-2 text-sm text-ink-mid">Indica tu caja y tus costes y Nokko te dirá cuántos meses te quedan.</p>}
      {missing > 0 && <p className="mt-2 text-xs text-muted-foreground">Faltan {missing} datos para que la previsión sea tuya →</p>}
    </Link>
  );
}
