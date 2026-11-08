import { createFileRoute } from "@tanstack/react-router";
import { TheoryUScreen } from "@/components/theory-u/theory-u-screen";
import { THEORY_U_SECTIONS, validSection } from "@/lib/screen-sections";

const TITLE = "Theory U — Nokko";
const DESC =
  "Recorrido U, sensing de clientes, niveles de escucha, clínicas de casos y prototipos GTM.";

export const Route = createFileRoute("/_authenticated/theory-u")({
  validateSearch: (s: Record<string, unknown>): { seccion?: string } => {
    const seccion = validSection(THEORY_U_SECTIONS, s.seccion);
    return seccion ? { seccion } : {};
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: TheoryUScreen,
});
