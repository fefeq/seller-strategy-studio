import { createFileRoute } from "@tanstack/react-router";
import { nonceCookieName, nonceCookieOptions, readCookie } from "@/lib/oauth-state";

// Google sends the Owner back here after the consent. The signed state says which company and person started
// it; the account is saved only when it was checked (completeConnect), and the person lands back where they were.
export const Route = createFileRoute("/api/public/drive/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { completeConnect } = await import("@/lib/drive-connection.server");
        let result: { ok: boolean; message: string; returnTo: string };
        try {
          result = await completeConnect(supabaseAdmin, {
            code: url.searchParams.get("code"), state: url.searchParams.get("state"),
            error: url.searchParams.get("error"), errorDescription: url.searchParams.get("error_description"),
            nonce: readCookie(request.headers.get("cookie"), nonceCookieName("drive")),
          }, url.origin);
        } catch (e) {
          console.error("Drive callback failed", e instanceof Error ? e.message : e);
          result = { ok: false, message: "No se pudo completar la conexión con Google. Inténtalo de nuevo.", returnTo: "/integrations" };
        }
        const back = new URL(result.returnTo, url.origin);
        back.searchParams.set("drive", result.ok ? "ok" : "error");
        back.searchParams.set("msg", result.message);
        // The nonce is single use: the cookie goes away whatever the outcome.
        const o = nonceCookieOptions("drive", url.protocol === "https:");
        const clear = `${nonceCookieName("drive")}=; Path=${o.path}; Max-Age=0; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`;
        const headers = new Headers({ Location: `${back.pathname}${back.search}`, "Cache-Control": "no-store" });
        headers.append("Set-Cookie", clear);
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
