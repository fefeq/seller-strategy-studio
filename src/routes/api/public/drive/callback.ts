import { createFileRoute } from "@tanstack/react-router";
import { connectParams, type ConnectOutcome } from "@/lib/drive-connection";
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
        let result: ConnectOutcome & { returnTo: string };
        try {
          result = await completeConnect(supabaseAdmin, {
            code: url.searchParams.get("code"), state: url.searchParams.get("state"),
            error: url.searchParams.get("error"), errorDescription: url.searchParams.get("error_description"),
            nonce: readCookie(request.headers.get("cookie"), nonceCookieName("drive")),
          }, url.origin);
        } catch (e) {
          console.error("Drive callback failed", e instanceof Error ? e.message : e);
          result = { code: "google_failed", returnTo: "/integrations" };
        }
        const back = new URL(result.returnTo, url.origin);
        // Only a code goes in the address, never text: the screen writes the message from the code.
        for (const [k, v] of Object.entries(connectParams(result))) back.searchParams.set(k, v);
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
