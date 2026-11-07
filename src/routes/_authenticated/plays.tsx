import { createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { PlaysPanel } from "@/components/plays/plays-panel";
import { usePlayStates } from "@/components/plays/use-play-states";
import { playsHeadline } from "@/lib/headlines";

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
  component: PlaysPage,
});

function PlaysPage() {
  const { data: me } = useMe();
  const { data: rows } = usePlayStates();
  return (
    <Page eyebrow="Plays GTM" title={playsHeadline(rows)}>
      <PlaysPanel roles={me?.roles ?? []} />
    </Page>
  );
}
