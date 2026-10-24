import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Empty } from "@/components/page";
import { useCurrency } from "@/hooks/use-me";
import { financeHeadline } from "@/lib/finance";
import { useFinance, useIsFinance } from "@/components/finance/data";
import { FinanceSummary, useFinanceView } from "@/components/finance/summary";
import { FinanceForecast } from "@/components/finance/forecast";
import { FinancePlanVsReal } from "@/components/finance/plan-vs-real";
import { FinanceInvoices } from "@/components/finance/invoices";
import { FinanceCosts } from "@/components/finance/costs";
import { FinanceCloses } from "@/components/finance/closes";

const SECTIONS = [
  { id: "resumen", label: "Resumen" },
  { id: "prevision", label: "Previsión" },
  { id: "plan", label: "Plan vs real" },
  { id: "facturas", label: "Facturas y cobros" },
  { id: "costes", label: "Costes" },
  { id: "cierres", label: "Cierres" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [
    { title: "Finanzas — Nokko" },
    { name: "description", content: "Caja, meses de caja, previsión por planes y pipeline, plan vs real, facturas y costes." },
    { property: "og:title", content: "Finanzas — Nokko" },
    { property: "og:description", content: "Caja, meses de caja, previsión por planes y pipeline, plan vs real, facturas y costes." },
  ] }),
  validateSearch: (s: Record<string, unknown>): { seccion?: Section } => ({ seccion: SECTIONS.some((x) => x.id === s.seccion) ? (s.seccion as Section) : undefined }),
  component: Finance,
});

function Finance() {
  const allowed = useIsFinance();
  const { money } = useCurrency();
  const { data } = useFinance();
  const v = useFinanceView(data);
  const sec: Section = Route.useSearch().seccion ?? "resumen";
  if (!allowed) return <Page eyebrow="Finanzas" title="Finanzas"><Empty>Finanzas solo lo ven el Owner y el Sales Leader de la empresa.</Empty></Page>;
  const title = v ? financeHeadline({ configured: v.configured, burn: v.burn, runway: v.runway, cash: v.cashNow }, money) : "Finanzas";
  return (
    <Page eyebrow="Finanzas" title={title}>
      <nav aria-label="Secciones de Finanzas" className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur md:top-14 md:mx-0 md:px-0">
        {SECTIONS.map((x) => (
          <Link key={x.id} to="/finance" search={x.id === "resumen" ? {} : { seccion: x.id }} className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${sec === x.id ? "bg-lime text-lime-foreground" : "text-ink-mid hover:bg-paper-sunk hover:text-ink"}`}>{x.label}</Link>
        ))}
      </nav>
      {!data ? <Empty>Cargando…</Empty> : (
        <>
          {sec === "resumen" && <FinanceSummary d={data} />}
          {sec === "prevision" && <FinanceForecast d={data} />}
          {sec === "plan" && <FinancePlanVsReal d={data} />}
          {sec === "facturas" && <FinanceInvoices d={data} />}
          {sec === "costes" && <FinanceCosts d={data} />}
          {sec === "cierres" && <FinanceCloses d={data} />}
        </>
      )}
    </Page>
  );
}
