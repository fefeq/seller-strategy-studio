import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { safeErrorLog } from "./lib/agent/safe-error-log";
import { renderErrorPage } from "./lib/error-page";
import { robotsTagFor } from "./lib/seo";
import { requestCtx } from "./lib/after-response.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error("h3 swallowed SSR error", safeErrorLog(consumeLastCapturedError()));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Only PUBLIC_PATHS may be indexed; the app behind the login and technical screens get noindex.
function withRobotsTag(request: Request, response: Response): Response {
  const tag = robotsTagFor(new URL(request.url).pathname, response.headers.get("content-type"));
  if (!tag || response.headers.has("x-robots-tag")) return response;
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", tag);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      // The Worker runtime adds waitUntil to the request; keep it so afterResponse() work survives the reply.
      const w =
        (request as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil ??
        (ctx as { waitUntil?: (p: Promise<unknown>) => void } | null)?.waitUntil?.bind(ctx);
      const response = await requestCtx.run({ waitUntil: w }, () =>
        handler.fetch(request, env, ctx),
      );
      return withRobotsTag(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error("request failed", safeErrorLog(error));
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
