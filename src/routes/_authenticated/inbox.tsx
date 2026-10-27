import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SuggestionDeck } from "@/components/suggestion-deck";
import { useJob } from "@/components/background";
import { Page, Empty } from "@/components/page";
import { SuggestionCard, useSuggestions } from "@/components/suggestions";
import { AssistantActions } from "@/components/assistant-actions";
import { StrategyChanges } from "@/components/strategy-execute";
import { SuggestionBoard } from "@/components/suggestion-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { suggestionsHeadline } from "@/lib/headlines";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Sugerencias — Nokko" }, { name: "description", content: "Riesgos y próximos pasos que el motor proactivo ha detectado, listos para aprobar." }, { property: "og:title", content: "Sugerencias — Nokko" }, { property: "og:description", content: "Riesgos y próximos pasos detectados, listos para aprobar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s: Record<string, unknown>): { vista?: "lista" } => ({ vista: s.vista === "lista" ? "lista" : undefined }),
  component: Inbox,
});

function Inbox() {
  const { data = [], isLoading } = useSuggestions();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const weekly = useJob("weekly_report", { onDone: () => qc.invalidateQueries({ queryKey: ["suggestions"] }) });
  const canReport = (me?.roles ?? []).some((r) => r === "owner" || r === "sales_leader");
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/inbox" });
  const list = search.vista === "lista";
  const groups = [1, 2, 3].map((p) => ({ p, items: data.filter((s) => s.priority === p) })).filter((g) => g.items.length);
  return (
    <Page eyebrow="Sugerencias" title={isLoading ? "Sugerencias" : suggestionsHeadline({ pending: data.length, urgent: data.filter((s) => s.priority === 1).length })} actions={canReport ? <Button variant="outline" disabled={weekly.running} onClick={() => weekly.start({})}>{weekly.running ? "Preparando en segundo plano…" : "Informe de la semana ahora"}</Button> : undefined}>
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-muted-foreground">Desliza a la derecha para hacer, a la izquierda para descartar y arriba para dejarlo para más tarde. Nada cambia sin tu decisión.</p>
      <Tabs defaultValue="me">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <TabsList><TabsTrigger value="me">Para mí</TabsTrigger><TabsTrigger value="team">Equipo</TabsTrigger></TabsList>
          <div className="flex gap-1">
            <Button size="sm" variant={list ? "outline" : "default"} onClick={() => navigate({ search: {} })}>Mazo</Button>
            <Button size="sm" variant={list ? "default" : "outline"} onClick={() => navigate({ search: { vista: "lista" } })}>Lista</Button>
          </div>
        </div>
        <TabsContent value="team"><SuggestionBoard /></TabsContent>
        <TabsContent value="me">
      <AssistantActions />
      <StrategyChanges />
      {!isLoading && data.length === 0 && <Empty>No hay sugerencias pendientes.</Empty>}
      {!list && data.length > 0 && <SuggestionDeck items={data} />}
      {list && <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.p}>
            <h2 className="mb-3 text-2xl">{g.p === 1 ? "Urgente" : g.p === 2 ? "Importante" : "Cuando puedas"}</h2>
            <div className="grid gap-3 md:grid-cols-2">{g.items.map((s) => <SuggestionCard key={s.id} s={s} />)}</div>
          </section>
        ))}
      </div>}
        </TabsContent>
      </Tabs>
    </Page>
  );
}
