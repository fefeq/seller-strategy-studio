// C2: card «Drive de tu empresa» in Conexiones. Owner connects in a popup; others read the state.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { askConfirm } from "@/components/confirm-dialog";
import { completeDriveCompanyConnect, disconnectDriveCompany, driveCompanyStatus, startDriveCompanyConnect } from "@/lib/drive-company.functions";
import { DRIVE_CONNECT_COPY, DRIVE_CONNECTOR } from "@/lib/drive-company";
import { errorText } from "@/lib/errors";

function waitForCode(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (e: MessageEvent) => {
      const type = e.data?.type;
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.connectorId !== DRIVE_CONNECTOR) return;
      if (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed") return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") return resolve(typeof e.data?.code === "string" ? e.data.code : null);
      popup.close();
      reject(new Error("Google no ha completado la conexión. No ha cambiado nada."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Has cerrado la ventana de Google antes de terminar. No ha cambiado nada."));
    }, 500);
  });
}

export function DriveCompanyCard() {
  const read = useServerFn(driveCompanyStatus);
  const start = useServerFn(startDriveCompanyConnect);
  const complete = useServerFn(completeDriveCompanyConnect);
  const disconnect = useServerFn(disconnectDriveCompany);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["drive-company"], queryFn: () => read() });
  const [busy, setBusy] = useState(false);

  async function connect() {
    const popup = window.open("", "nokko-drive", "width=600,height=720");
    if (!popup) return toast.error("Tu navegador ha bloqueado la ventana de Google. Permite ventanas emergentes y vuelve a intentarlo.");
    setBusy(true);
    try {
      const { authorizationUrl } = await start();
      const done = waitForCode(popup);
      popup.location.href = authorizationUrl;
      const code = await done;
      if (code) await complete({ data: { code } });
      await qc.invalidateQueries({ queryKey: ["drive-company"] });
      toast.success("Drive de la empresa conectado.");
    } catch (e) {
      popup.close();
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function off() {
    const ok = await askConfirm("¿Desconectar el Drive de la empresa?", {
      body: "NOKKO dejará de leer de esa cuenta ahora mismo. Lo ya importado se conserva con su origen.",
      confirmLabel: "Desconectar",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await disconnect();
      await qc.invalidateQueries({ queryKey: ["drive-company"] });
      toast.success("Drive desconectado. Lo importado sigue en Conocimiento.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const s = q.data?.state;
  const canManage = !!q.data?.canManage;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Drive de tu empresa</h3>
        <span className="text-xs text-muted-foreground">
          {q.isLoading ? "Comprobando…" : q.error ? "Error" : s?.kind === "connected" ? "Tu cuenta" : s?.kind === "reconnect" ? "Sin acceso" : s?.kind === "shared" ? "Incluida en NOKKO" : "Por preparar"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{DRIVE_CONNECT_COPY}</p>
      {q.error && <p className="mt-2 text-sm text-destructive">{errorText(q.error)}</p>}
      {s?.kind === "setup_needed" && (
        <p className="mt-2 text-sm">De momento tus documentos se guardan en la carpeta de tu empresa dentro del Drive de NOKKO. La conexión con tu propia cuenta se activará pronto.</p>
      )}
      {s?.kind === "shared" && <p className="mt-2 text-sm">Ahora usas la carpeta de tu empresa en el Drive de NOKKO. Al conectar tu cuenta, guardamos una copia de la lista de carpetas actuales y no se borra nada.</p>}
      {(s?.kind === "connected" || s?.kind === "reconnect") && (
        <p className="mt-2 text-sm">
          Cuenta: <strong>{s.email ?? "sin email"}</strong> · conectada por {s.by ?? "un miembro"} el {new Date(s.at).toLocaleDateString("es-ES")}
          {s.kind === "reconnect" && <span className="block text-destructive">El acceso a Google ha caducado: vuelve a conectar. Lo importado se conserva.</span>}
        </p>
      )}
      {s && s.kind !== "setup_needed" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canManage ? (
            <>
              <Button size="sm" onClick={connect} disabled={busy}>
                {s.kind === "shared" ? "Conectar Drive" : s.kind === "reconnect" ? "Volver a conectar" : "Cambiar de cuenta"}
              </Button>
              {s.kind !== "shared" && (
                <Button size="sm" variant="outline" onClick={off} disabled={busy}>Desconectar</Button>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Solo el Owner puede conectar, cambiar o desconectar el Drive.</p>
          )}
        </div>
      )}
    </div>
  );
}
