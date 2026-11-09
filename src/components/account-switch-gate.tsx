import { useEffect, type ReactNode } from "react";
import { accountSwitch, useSwitchingAccount } from "@/lib/account-switch";

/** Replaces the app with a blocking state while the tab changes to another account, then reloads (NK-0111). */
export function AccountSwitchGate({ children }: { children: ReactNode }) {
  const switching = useSwitchingAccount();
  useEffect(() => {
    if (switching) accountSwitch.reload();
  }, [switching]);
  if (!switching) return <>{children}</>;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center" role="status">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cambiando de cuenta…
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Has entrado con otra cuenta en otra pestaña. Cargando tu espacio.
        </p>
      </div>
    </div>
  );
}

/** Renders nothing while the tab changes account (NK-0120): for what __root mounts next to the outlet (toasts). */
export function HideWhileSwitching({ children }: { children: ReactNode }) {
  return useSwitchingAccount() ? null : <>{children}</>;
}
