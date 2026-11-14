import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { RepliesList, headlineFor, useReplies } from "@/components/reply-inbox/replies-list";
import { errorText } from "@/lib/errors";

const DESC = "Respuestas de tus leads detectadas en tu Gmail conectado, con fecha y tipo.";
export const Route = createFileRoute("/_authenticated/replies")({
  head: () => ({
    meta: [
      { title: "Respuestas — Nokko" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Respuestas — Nokko" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepliesPage,
});

function RepliesPage() {
  const { data, error, isLoading } = useReplies();
  return (
    <Page eyebrow="Respuestas" title={headlineFor(data)}>
      <div className="pb-28">
        {error ? (
          <p className="text-sm text-destructive">{errorText(error)}</p>
        ) : isLoading ? (
          <p className="text-sm text-ink-mid">Cargando respuestas…</p>
        ) : (
          <RepliesList rows={data ?? []} />
        )}
      </div>
    </Page>
  );
}
