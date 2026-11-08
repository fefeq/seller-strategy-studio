import { useNavigate, useSearch } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { useUrlSection } from "@/hooks/use-url-section";
import {
  THEORY_U_DEFAULT_SECTION,
  THEORY_U_SECTIONS,
  nextSearchOnSectionChange,
  sectionOf,
} from "@/lib/screen-sections";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UJourney } from "@/components/theory-u/journey";
import { Sensing } from "@/components/theory-u/sensing";
import { Listening } from "@/components/theory-u/listening";
import { CaseClinics } from "@/components/theory-u/case-clinic";
import { Prototypes } from "@/components/theory-u/prototypes";

export function TheoryUScreen() {
  const { seccion } = useSearch({ from: "/_authenticated/theory-u" });
  const navigate = useNavigate({ from: "/theory-u" });
  const [tab, setTab] = useUrlSection(
    sectionOf(THEORY_U_SECTIONS, THEORY_U_DEFAULT_SECTION, seccion),
  );
  // A person changing tab replaces the URL (no history entry), writing seccion unless it is the default.
  function goToTab(id: string) {
    setTab(id);
    navigate({
      search: (prev) => nextSearchOnSectionChange(prev, id, THEORY_U_DEFAULT_SECTION),
      replace: true,
    });
  }
  return (
    <Page eyebrow="Liderar desde el futuro que emerge · Otto Scharmer" title="Theory U">
      <Tabs value={tab} onValueChange={goToTab}>
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
