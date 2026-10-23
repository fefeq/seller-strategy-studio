import { createFileRoute } from "@tanstack/react-router";

// Inngest calls this endpoint to discover and run Nokko's background functions. Every request is verified by
// the Inngest SDK with the signing key; unsigned requests are rejected there.
async function handle(request: Request) {
  if (!process.env["INNGEST_SIGNING_KEY"]) return new Response("Inngest not configured", { status: 503 });
  const { inngestHandler } = await import("@/lib/inngest/functions.server");
  return inngestHandler()(request);
}

export const Route = createFileRoute("/api/public/inngest")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      PUT: ({ request }) => handle(request),
    },
  },
});
