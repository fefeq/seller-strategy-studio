import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** Shown by /_authenticated when the session could not be checked (network, 5xx). The session stays open (NK-0112). */
export function SessionUnverified() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  async function retry() {
    setChecking(true);
    try {
      await router.invalidate();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center" role="alert">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          No he podido comprobar tu sesión
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede ser la conexión o un fallo momentáneo. Tu sesión sigue abierta.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={retry} disabled={checking}>
            {checking ? "Comprobando…" : "Reintentar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
