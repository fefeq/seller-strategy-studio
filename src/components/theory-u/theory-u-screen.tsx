import { Page } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UJourney } from "@/components/theory-u/journey";
import { Sensing } from "@/components/theory-u/sensing";
import { Listening } from "@/components/theory-u/listening";
import { CaseClinics } from "@/components/theory-u/case-clinic";
import { Prototypes } from "@/components/theory-u/prototypes";

export function TheoryUScreen() {
  return (
    <Page eyebrow="Liderar desde el futuro que emerge · Otto Scharmer" title="Theory U">
      <Tabs defaultValue="journey">
        <TabsList className="mb-6">
          <TabsTrigger value="journey">Recorrido U</TabsTrigger>
          <TabsTrigger value="sensing">Sensing</TabsTrigger>
          <TabsTrigger value="listening">Escucha</TabsTrigger>
          <TabsTrigger value="clinic">Clínica de casos</TabsTrigger>
          <TabsTrigger value="prototypes">Prototipos</TabsTrigger>
        </TabsList>
        <TabsContent value="journey">
          <UJourney />
        </TabsContent>
        <TabsContent value="sensing">
          <Sensing />
        </TabsContent>
        <TabsContent value="listening">
          <Listening />
        </TabsContent>
        <TabsContent value="clinic">
          <CaseClinics />
        </TabsContent>
        <TabsContent value="prototypes">
          <Prototypes />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
