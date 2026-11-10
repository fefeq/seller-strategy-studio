import { Link, createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { PlaysPanel } from "@/components/plays/plays-panel";
import { PlayTeamsPanel } from "@/components/plays/play-teams-panel";
import { usePlayStates } from "@/components/plays/use-play-states";
import { playsHeadline } from "@/lib/headlines";
import { parsePlaysSearch } from "@/lib/plays/search";

const TITLE = "Plays GTM — Nokko";
const DESC =
  "Las jugadas de venta que Nokko conoce, cuáles están activadas en tu empresa y qué falta para el resto.";

export const Route = createFileRoute("/_authenticated/plays")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: parsePlaysSearch,
  component: PlaysPage,
});

function PlaysPage() {
  const { data: me } = useMe();
  const { data: rows } = usePlayStates();
  const { vista } = Route.useSearch();
  const roles = me?.roles ?? [];
  const VIEWS = [
    { id: "todos", label: "Todos los plays" },
    { id: "equipos", label: "Equipos de plays" },
  ] as const;
  return (
    <Page eyebrow="Plays GTM" title={playsHeadline(rows)}>
      <nav
        aria-label="Vistas de Plays GTM"
        className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur md:top-14 md:mx-0 md:px-0"
      >
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            to="/plays"
            search={v.id === "equipos" ? { vista: "equipos" } : {}}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${(vista ?? "todos") === v.id ? "bg-lime-soft text-ink font-medium" : "text-ink-mid hover:bg-paper-sunk hover:text-ink"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {vista === "equipos" ? <PlayTeamsPanel roles={roles} /> : <PlaysPanel roles={roles} />}
    </Page>
  );
}
