// C1: one list with the real state of every service (Incluida en NOKKO / Tu cuenta / Sin conectar / Error),
// who connected it and when, this month's use and «Probar conexión». Values of keys never reach the browser.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScreenState } from "@/components/page";
import { connectionsStatus, testConnection } from "@/lib/connections.functions";
import {
  SERVICES,
  STATE_LABEL,
  connectionState,
  type ConnState,
  type Test,
} from "@/lib/connections";
import { errorText } from "@/lib/errors";

const TONE: Record<ConnState, string> = {
  included: "bg-success/15 text-success",
  own: "bg-primary/15 text-foreground",
  missing: "bg-muted text-muted-foreground",
  error: "bg-destructive/15 text-destructive",
};

const money = (n: number, cur: string) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 2,
  }).format(n);

export function ConnectionsStatusPanel() {
  const read = useServerFn(connectionsStatus);
  const probe = useServerFn(testConnection);
  const q = useQuery({ queryKey: ["connections-status"], queryFn: () => read() });
  const [tests, setTests] = useState<Record<string, Test & { detail?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function run(id: string) {
    setBusy(id);
    try {
      const r = await probe({ data: { id } });
      setTests((t) => ({ ...t, [id]: r }));
      (r.ok ? toast.success : toast.error)(r.detail);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <ScreenState isPending={q.isPending} error={q.error} refetch={q.refetch}>
      <ul className="divide-y rounded-lg border bg-card">
        {SERVICES.map((s) => {
          const row = q.data?.find((r) => r.id === s.id);
          const test = tests[s.id] ?? null;
          const state = connectionState(
            s,
            !!row?.present,
            test ?? (row?.lastError ? { ok: false, at: "" } : null),
          );
          const u = row?.usage;
          const spent = u ? Object.entries(u.byCurrency).map(([c, n]) => money(n, c)) : [];
          return (
            <li
              key={s.id}
              id={`conexion-${s.id}`}
              className="scroll-mt-24 grid min-w-0 gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className={`rounded px-1.5 font-mono text-xs uppercase ${TONE[state]}`}>
                    {STATE_LABEL[state]}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">{s.what}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.source.kind === "shared"
                    ? "Cuenta de NOKKO"
                    : row?.by
                      ? `Conectada por ${row.by}${row.at ? ` el ${new Date(row.at).toLocaleDateString("es-ES")}` : ""}`
                      : "Nadie la ha conectado en esta empresa"}
                  {" · Este mes: "}
                  {u
                    ? u.uses
                      ? `${u.uses} usos${spent.length ? ` · ${spent.join(" + ")}` : ""}${u.unknown ? ` · ${u.unknown} sin dato de coste` : ""}`
                      : "sin uso"
                    : "—"}
                </p>
                {(test?.detail || row?.lastError) && (
                  <p
                    className={`mt-1 text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {test?.detail ?? row?.lastError}
                  </p>
                )}
              </div>
              {s.source.kind === "shared" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === s.id}
                  onClick={() => run(s.id)}
                >
                  {busy === s.id ? "Probando…" : "Probar conexión"}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Se comprueba en su tarjeta</span>
              )}
            </li>
          );
        })}
      </ul>
    </ScreenState>
  );
}
