import { createFileRoute } from "@tanstack/react-router";
import { HubScreen } from "@/components/hub/hub-screen";
import { cleanQuery } from "@/lib/hub-search";

export const Route = createFileRoute("/_authenticated/hub")({
  // doc: opened from a notice (an import or a battlecard made in the background). q: the search box (blank is dropped).
  validateSearch: (s: Record<string, unknown>): { doc?: string; q?: string } => {
    const q = cleanQuery(s.q);
    return { ...(typeof s.doc === "string" ? { doc: s.doc } : {}), ...(q ? { q } : {}) };
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
