import { createFileRoute } from "@tanstack/react-router";
import { Page, Empty } from "@/components/page";
import { SuggestionCard, useSuggestions } from "@/components/suggestions";
import { AssistantActions } from "@/components/assistant-actions";
import { SuggestionBoard } from "@/components/suggestion-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Sugerencias — Nokko" }, { name: "description", content: "Riesgos y próximos pasos que el motor proactivo ha detectado, listos para aprobar." }, { property: "og:title", content: "Sugerencias — Nokko" }, { property: "og:description", content: "Riesgos y próximos pasos detectados, listos para aprobar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Inbox,
});

function Inbox() {
  const { data = [], isLoading } = useSuggestions();
  const groups = [1, 2, 3].map((p) => ({ p, items: data.filter((s) => s.priority === p) })).filter((g) => g.items.length);
  return (
    <Page eyebrow="Motor proactivo" title="Sugerencias">
      <p className="-mt-4 mb-8 max-w-2xl text-muted-foreground">Reviso tu pipeline, reuniones, cuentas y configuración cada hora y te preparo la acción. Nada cambia sin tu aprobación; si descartas algo, no vuelve a aparecer.</p>
      <Tabs defaultValue="me">
        <TabsList className="mb-6"><TabsTrigger value="me">Para mí</TabsTrigger><TabsTrigger value="team">Equipo</TabsTrigger></TabsList>
        <TabsContent value="team"><SuggestionBoard /></TabsContent>
        <TabsContent value="me">
      <AssistantActions />
      {!isLoading && data.length === 0 && <Empty>No hay sugerencias pendientes. Buen trabajo.</Empty>}
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.p}>
            <h2 className="mb-3 text-2xl">{g.p === 1 ? "Urgente" : g.p === 2 ? "Importante" : "Cuando puedas"}</h2>
            <div className="grid gap-3 md:grid-cols-2">{g.items.map((s) => <SuggestionCard key={s.id} s={s} />)}</div>
          </section>
        ))}
      </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
