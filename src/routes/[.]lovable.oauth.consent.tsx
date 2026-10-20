import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  head: () => ({ meta: [
    { title: "Conectar asistente — Nokko" },
    { name: "description", content: "Autoriza a un asistente de IA a usar Nokko en tu nombre." },
    { property: "og:title", content: "Conectar asistente — Nokko" },
    { property: "og:description", content: "Autoriza a un asistente de IA a usar Nokko en tu nombre." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({ authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "" }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta el identificador de autorización. Vuelve a iniciar la conexión desde tu asistente.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id")!;
    const [{ data, error }, { data: u }] = await Promise.all([supabase.auth.oauth.getAuthorizationDetails(id), supabase.auth.getUser()]);
    if (error) throw new Error("Esta solicitud de conexión no es válida o ha caducado. Vuelve a conectar desde tu asistente.");
    const d = data as unknown as { redirect_url?: string; redirect_to?: string; client?: { name?: string; client_name?: string; redirect_uri?: string; uri?: string }; redirect_uri?: string; scope?: string; scopes?: string[] };
    const immediate = d?.redirect_url ?? d?.redirect_to;
    if (immediate && !d?.client) throw redirect({ href: immediate });
    return { details: d, email: u.user?.email ?? "" };
  },
  component: Consent,
  pendingComponent: () => <Shell><p className="text-sm text-muted-foreground">Cargando solicitud…</p></Shell>,
  errorComponent: ({ error }) => <Shell><h1 className="text-3xl">No se pudo abrir la solicitud</h1><p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p></Shell>,
});

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><div className="w-full max-w-md rounded-lg border bg-card p-8">{children}</div></main>;
}

const SCOPE_LABELS: Record<string, string> = { openid: "Confirmar tu identidad", email: "Ver tu email", profile: "Ver tu nombre" };

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? details?.client?.client_name ?? "Un asistente de IA";
  const redirectUri = details?.client?.redirect_uri ?? details?.redirect_uri ?? details?.client?.uri;
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(" ") : []);

  async function decide(approve: boolean) {
    setBusy(true); setError(null);
    const { data, error } = approve ? await supabase.auth.oauth.approveAuthorization(authorization_id) : await supabase.auth.oauth.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(approve ? "No se pudo aprobar la conexión. Inténtalo de nuevo." : "No se pudo cancelar. Inténtalo de nuevo."); return; }
    const r = data as unknown as { redirect_url?: string; redirect_to?: string };
    const target = r?.redirect_url ?? r?.redirect_to;
    if (!target) { setBusy(false); setError("El servidor no devolvió a dónde volver."); return; }
    window.location.href = target;
  }

  return (
    <Shell>
      <p className="eyebrow">Nokko</p>
      <h1 className="mt-1 text-3xl">Conectar {client} a Nokko</h1>
      <p className="mt-3 text-sm">{client} podrá consultar tu pipeline, cuentas, métricas y estrategia, y preparar acciones <strong>como tú</strong> ({email}), en tu empresa activa y con tu rol.</p>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        <li>· Las acciones que cambian datos quedan pendientes hasta que las confirmes en Sugerencias.</li>
        <li>· No puede borrar nada ni saltarse los permisos de tu rol.</li>
        {scopes.map((s) => <li key={s}>· {SCOPE_LABELS[s] ?? `Permiso adicional: ${s}`}</li>)}
      </ul>
      {redirectUri && <p className="mt-4 break-all text-xs text-muted-foreground">Volverá a: {redirectUri}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex gap-3">
        <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Aprobar</Button>
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Cancelar conexión</Button>
      </div>
    </Shell>
  );
}
