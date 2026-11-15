// OAuth return for the per-company Drive (C2). Plain HTML, no session: posts only the one-time code to the opener,
// which exchanges it through an authenticated server function. Never handles the connection key.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/oauth/google-drive/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const connectorId = url.searchParams.get("connector_id") ?? "";
        const code = url.searchParams.get("code") ?? "";
        const success = url.searchParams.get("success") === "true";
        const offline = url.searchParams.get("offline_access_allowed");
        const error = url.searchParams.get("error");
        const result =
          success && offline === "false"
            ? { success: true, connectorId, code: null }
            : success && code
              ? { success: true, connectorId, code }
              : { success: false, connectorId, error: error ?? (success ? "Missing code" : "OAuth failed") };
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const safeJson = JSON.stringify(result).replace(/<\//g, "<\\/");
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Terminando la conexión…</title></head><body>
<p>${result.success ? "Conexión completada, cerrando…" : "No se pudo conectar: " + esc("error" in result ? (result.error ?? "") : "")}</p>
<script>
const result = ${safeJson};
const type = result.success ? "appUserConnectorOAuthComplete" : "appUserConnectorOAuthFailed";
if (window.opener && window.opener !== window) window.opener.postMessage({ type, connectorId: result.connectorId, code: result.code ?? null }, window.location.origin);
window.close();
</script></body></html>`;
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      },
    },
  },
});
