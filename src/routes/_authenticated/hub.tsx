import { createFileRoute } from "@tanstack/react-router";
import { HubScreen } from "@/components/hub/hub-screen";

export const Route = createFileRoute("/_authenticated/hub")({
  // doc: opened from a notice (an import or a battlecard made in the background).
  validateSearch: (s: Record<string, unknown>): { doc?: string } =>
    typeof s.doc === "string" ? { doc: s.doc } : {},
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
