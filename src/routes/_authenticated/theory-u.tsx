import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UJourney } from "@/components/theory-u/journey";
import { Sensing } from "@/components/theory-u/sensing";
import { Listening } from "@/components/theory-u/listening";
import { CaseClinics } from "@/components/theory-u/case-clinic";
import { Prototypes } from "@/components/theory-u/prototypes";

const TITLE = "Theory U — GTM Brain";
const DESC = "Recorrido U, sensing de clientes, niveles de escucha, Case Clinics y prototipos GTM.";

export const Route = createFileRoute("/_authenticated/theory-u")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: TheoryU,
});

function TheoryU() {
  return (
    <Page eyebrow="Liderar desde el futuro que emerge · Otto Scharmer" title="Theory U">
      <Tabs defaultValue="journey">
        <TabsList className="mb-6">
          <TabsTrigger value="journey">Recorrido U</TabsTrigger>
          <TabsTrigger value="sensing">Sensing</TabsTrigger>
          <TabsTrigger value="listening">Escucha</TabsTrigger>
          <TabsTrigger value="clinic">Case Clinic</TabsTrigger>
          <TabsTrigger value="prototypes">Prototipos</TabsTrigger>
        </TabsList>
        <TabsContent value="journey"><UJourney /></TabsContent>
        <TabsContent value="sensing"><Sensing /></TabsContent>
        <TabsContent value="listening"><Listening /></TabsContent>
        <TabsContent value="clinic"><CaseClinics /></TabsContent>
        <TabsContent value="prototypes"><Prototypes /></TabsContent>
      </Tabs>
    </Page>
  );
}
