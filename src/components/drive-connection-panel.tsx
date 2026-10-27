// The company's own Google Drive account, in Conexiones: the state in words, who connected it and since when,
// connect / change / disconnect (Owner only; everyone else reads). The token never reaches the browser.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { askConfirm } from "@/components/confirm-dialog";
import { errorText } from "@/lib/errors";
import { canManageConnections, driveConnectionState, MANAGE_DENIED, PERMISSIONS_TEXT, PURPOSE_TEXT, STATE_LABEL, type ConnectionRow, type ConnectionState } from "@/lib/drive-connection";
import { disconnectDriveFn, driveConnectionInfoFn, startDriveConnectFn } from "@/lib/drive-connection.functions";

const when = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const ACTION: Record<string, string> = { connected: "conectó", changed: "cambió de cuenta", disconnected: "desconectó", failed: "perdió el acceso" };
const TONE: Record<ConnectionState, string> = {
  own: "bg-success/15 text-success",
  nokko: "bg-muted text-foreground",
  none: "bg-muted text-muted-foreground",
  error: "bg-destructive/15 text-destructive",
  no_response: "bg-warning/25",
};

export function DriveConnect() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = canManageConnections(me?.roles[0]);
  const info = useServerFn(driveConnectionInfoFn);
  const start = useServerFn(startDriveConnectFn);
  const disconnect = useServerFn(disconnectDriveFn);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ["drive-connection"], queryFn: () => info() });

  // Google sends the Owner back here with the result of the connection.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const result = p.get("drive");
    if (!result) return;
    const msg = p.get("msg") ?? (result === "ok" ? "Drive conectado." : "No se pudo conectar Drive.");
    (result === "ok" ? toast.success : toast.error)(msg);
    for (const k of ["drive", "msg"]) p.delete(k);
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}${window.location.hash}`);
    void qc.invalidateQueries({ queryKey: ["drive-connection"] });
  }, [qc]);

  const c = data?.connection ?? null;
  const state = driveConnectionState(c as ConnectionRow | null, !!data?.nokkoAvailable);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await start({ data: { returnTo: window.location.pathname } });
      window.location.assign(url);
    } catch (e) { toast.error(errorText(e)); setBusy(false); }
  }

  async function off() {
    const ok = await askConfirm("¿Desconectar tu Google Drive?", {
      body: "NOKKO dejará de usar esta cuenta ahora mismo. Después intentaremos revocar el acceso en Google y te diremos si se pudo o no. Lo que ya importaste a Conocimiento se conserva con su origen. Los archivos de tu Drive no se tocan.",
      confirmLabel: "Desconectar",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await disconnect();
      (r.revocation === "revoked" ? toast.success : toast.warning)(`Drive desconectado. ${r.message} Lo importado se conserva en Conocimiento.`, { duration: 12000 });
    }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); void qc.invalidateQueries({ queryKey: ["drive-connection"] }); }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium">Google Drive</span>
        <span className={`shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${TONE[state]}`}>{STATE_LABEL[state]}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{PURPOSE_TEXT}</p>

      {c && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>Cuenta de la empresa: <span className="text-foreground">{c.google_email}</span> · conectada {c.connected_by_name ? `por ${c.connected_by_name} ` : ""}el {when(c.connected_at)}.</p>
          {(state === "error" || state === "no_response") && c.last_error && <p className={state === "error" ? "text-destructive" : ""}>{c.last_error}</p>}
        </div>
      )}
      {!c && state === "nokko" && <p className="mt-3 text-xs text-muted-foreground">Ahora se usa la cuenta que proporciona NOKKO. Conecta la tuya para que NOKKO trabaje con tus propios documentos.</p>}
      {!c && state === "none" && <p className="mt-3 text-xs text-muted-foreground">No hay ninguna cuenta de Drive conectada.</p>}

      {isOwner && (
        <div className="mt-3 space-y-2">
          {data && !data.oauthConfigured && <p className="text-xs text-muted-foreground">Falta configurar el acceso a Google en el servidor. Avisa al equipo de Nokko.</p>}
          <details open={!c}>
            <summary className="cursor-pointer text-xs text-signal">Qué podrá hacer NOKKO</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>{PERMISSIONS_TEXT.reads}</li>
              <li>{PERMISSIONS_TEXT.saves}</li>
              <li>{PERMISSIONS_TEXT.revoke}</li>
            </ul>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !data?.oauthConfigured} onClick={connect}>{c ? "Cambiar de cuenta" : "Conectar mi cuenta"}</Button>
            {c && <Button size="sm" variant="ghost" disabled={busy} onClick={off}>Desconectar</Button>}
          </div>
        </div>
      )}
      {!isOwner && <p className="mt-3 text-xs text-muted-foreground">{MANAGE_DENIED}</p>}

      {!!data?.events.length && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">Historial</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {data.events.map((e, i) => <li key={i}>{when(e.created_at)} · {e.actor_name ?? "El sistema"} {ACTION[e.action] ?? e.action}{e.detail ? ` (${e.detail})` : ""}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
