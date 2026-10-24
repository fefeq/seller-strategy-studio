import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IcpEditor } from "@/components/icp-editor";
import { BudgetQuarters } from "@/components/budget-quarters";
import { PaybackQuarters } from "@/components/payback-quarters";
import { Motions } from "@/components/strategy/motions";
import { Pillars, Positioning } from "@/components/strategy/positioning";

const STRATEGY_TABS = ["motions", "payback", "budget", "icp", "positioning", "pillars"] as const;

export const Route = createFileRoute("/_authenticated/strategy")({
  validateSearch: (s: Record<string, unknown>): { tab?: (typeof STRATEGY_TABS)[number] } =>
    STRATEGY_TABS.includes(s.tab as (typeof STRATEGY_TABS)[number]) ? { tab: s.tab as (typeof STRATEGY_TABS)[number] } : {},
  head: () => ({ meta: [{ title: "Estrategia GTM — Nokko" }, { name: "description", content: "Modelos de venta por segmento, ICP y posicionamiento." }, { property: "og:title", content: "Estrategia GTM — Nokko" }, { property: "og:description", content: "Modelos de venta por segmento, ICP y posicionamiento." }] }),
  component: Strategy,
});


function Strategy() {
  const { tab } = Route.useSearch();
  return (
    <Page eyebrow="Capa estratégica" title="Estrategia GTM">
      <Tabs key={tab ?? "motions"} defaultValue={tab ?? "motions"}>
        <TabsList className="mb-6">
          <TabsTrigger value="motions">Modelos de venta por segmento</TabsTrigger>
          <TabsTrigger value="payback">Payback real</TabsTrigger>
          <TabsTrigger value="budget">Presupuesto vs real</TabsTrigger>
          <TabsTrigger value="icp">ICP</TabsTrigger>
          <TabsTrigger value="positioning">Posicionamiento</TabsTrigger>
          <TabsTrigger value="pillars">Mensajes</TabsTrigger>
        </TabsList>
        <TabsContent value="motions"><Motions /></TabsContent>
        <TabsContent value="payback"><PaybackQuarters /></TabsContent>
        <TabsContent value="budget"><BudgetQuarters /></TabsContent>
        <TabsContent value="icp"><IcpEditor /></TabsContent>
        <TabsContent value="positioning"><Positioning /></TabsContent>
        <TabsContent value="pillars"><Pillars /></TabsContent>
      </Tabs>
    </Page>
  );
}

