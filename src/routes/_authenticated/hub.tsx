import { createFileRoute, redirect } from "@tanstack/react-router";
import { hubRedirect } from "@/lib/legacy-redirects";
import { HubScreen } from "@/components/hub/hub-screen";
import { cleanQuery } from "@/lib/hub-search";
import { HUB_SECTIONS, validSection } from "@/lib/screen-sections";

export const Route = createFileRoute("/_authenticated/hub")({
  // doc: opened from a notice (an import or a battlecard made in the background). q: the search box (blank is dropped).
  // seccion: the open section (an unknown id is dropped, so the screen opens the default).
  validateSearch: (s: Record<string, unknown>): { doc?: string; q?: string; seccion?: string } => {
    const q = cleanQuery(s.q);
    const seccion = validSection(HUB_SECTIONS, s.seccion);
    return {
      ...(typeof s.doc === "string" ? { doc: s.doc } : {}),
      ...(q ? { q } : {}),
      ...(seccion ? { seccion } : {}),
    };
  },
  // B2: Reglas y Voz moved to Estrategia › Reglas y voz; old links land there.
  beforeLoad: ({ search }) => {
    const to = hubRedirect(search);
    if (to) throw redirect({ ...to, replace: true });
  },
  head: () => ({
    meta: [
      { title: "Conocimiento — Nokko" },
      { name: "description", content: "El cerebro compartido del equipo comercial." },
      { property: "og:title", content: "Conocimiento — Nokko" },
      { property: "og:description", content: "El cerebro compartido del equipo comercial." },
    ],
  }),
  component: HubScreen,
});
