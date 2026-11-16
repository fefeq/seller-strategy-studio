// Conocimiento → «Drive por cuenta»: every document saved in the account folders of Google Drive, with an AI
// summary (cached until the file changes) and its date. Server work in drive.functions.ts / drive-core.ts.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/page";
import { CompanyLogo } from "@/components/company-logo";
import { errorText } from "@/lib/errors";
import { formatSpanishDate } from "@/lib/dates";
import { driveAccountsOverview, summarizeDriveDoc } from "@/lib/drive.functions";
import { JobProgress, useJob } from "@/components/background";

const KEY = ["drive-accounts-overview"];

export function DriveAccountsPanel() {
  const qc = useQueryClient();
  const load = useServerFn(driveAccountsOverview);
  const summarize = useServerFn(summarizeDriveDoc);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: KEY,
    queryFn: () => load(),
    retry: false,
    staleTime: 60_000,
  });
  const bulk = useJob("drive_summaries", {
    onDone: (j) => {
      void qc.invalidateQueries({ queryKey: KEY });
      const failed = Number((j.result as { failed?: number } | null)?.failed ?? 0);
      if (failed)
        toast.error(
          `${failed} ${failed === 1 ? "documento no se pudo resumir" : "documentos no se pudieron resumir"}. Prueba uno a uno para ver el motivo.`,
        );
    },
  });

  const mark = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  async function one(fileId: string, accountId: string) {
    mark(fileId, true);
    try {
      await summarize({ data: { fileId, accountId } });
      await qc.invalidateQueries({ queryKey: KEY });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      mark(fileId, false);
    }
  }
  /** All the missing ones (up to 30 per run) in the background: Nokko reads each document and asks the AI. */
  function all() {
    const todo = (data?.pending ?? []).slice(0, 30);
    if (todo.length)
      void bulk.start(
        { docs: todo.map((t) => ({ fileId: t.fileId, accountId: t.accountId ?? null })) },
        `Resumir ${todo.length} ${todo.length === 1 ? "documento" : "documentos"} de Drive`,
      );
  }

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        Abriendo las carpetas de las cuentas en Google Drive…
      </p>
    );
  if (error) return <p className="text-sm text-destructive">{errorText(error)}</p>;
  if (!data || data.totals.accounts === 0)
    return (
      <Empty>
        Ninguna cuenta tiene carpeta en Google Drive todavía. Créala desde la pestaña Drive de la
        ficha de la cuenta, o guarda allí un plan o una propuesta.
      </Empty>
    );

  const q = filter.trim().toLowerCase();
  const accounts = data.accounts
    .map((a) => ({
      ...a,
      docs:
        q && !a.accountName.toLowerCase().includes(q)
          ? a.docs.filter(
              (d) =>
                d.name.toLowerCase().includes(q) || (d.summary ?? "").toLowerCase().includes(q),
            )
          : a.docs,
    }))
    .filter((a) => !q || a.docs.length > 0 || a.accountName.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="eyebrow">Drive por cuenta</p>
        <p className="text-sm text-muted-foreground">
          {data.totals.docs} {data.totals.docs === 1 ? "documento" : "documentos"} en{" "}
          {data.totals.accounts} {data.totals.accounts === 1 ? "cuenta" : "cuentas"}
          {data.root?.url ? (
            <>
              {" "}
              ·{" "}
              <a className="underline" href={data.root.url} target="_blank" rel="noreferrer">
                carpeta de la empresa
              </a>
            </>
          ) : null}
          . El resumen lo escribe la IA y se rehace cuando el documento cambia en Drive.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            placeholder="Filtrar por cuenta, documento o resumen"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {data.totals.pending > 0 &&
            (bulk.running ? (
              <JobProgress job={bulk.job} onCancel={bulk.cancel} />
            ) : (
              <Button
                variant="outline"
                onClick={all}
              >{`Resumir los que faltan (${data.totals.pending > 30 ? "30 de " : ""}${data.totals.pending})`}</Button>
            ))}
          <Button variant="ghost" size="sm" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
      </div>

      {accounts.length === 0 && <Empty>Nada coincide con «{filter}».</Empty>}
      {accounts.map((a) => (
        <section key={a.accountId} className="space-y-2 border-t pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-lg font-medium">
              <CompanyLogo domain={a.domain} size={20} />
              <Link
                to="/accounts/$id"
                params={{ id: a.accountId }}
                className="underline-offset-4 hover:underline"
              >
                {a.accountName}
              </Link>
            </h3>
            <span className="text-xs text-muted-foreground">
              {a.folder?.url ? (
                <a className="underline" href={a.folder.url} target="_blank" rel="noreferrer">
                  Abrir carpeta
                </a>
              ) : null}
              {a.latest ? ` · último cambio ${formatSpanishDate(a.latest)}` : ""}
            </span>
          </div>
          {a.error ? (
            <p className="text-sm text-destructive">{a.error}</p>
          ) : a.docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">La carpeta está vacía.</p>
          ) : (
            <ul className="divide-y">
              {a.docs.map((d) => (
                <li key={d.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto] sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <p>
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-words font-medium underline [overflow-wrap:anywhere]"
                        >
                          {d.name}
                        </a>
                      ) : (
                        <span className="font-medium">{d.name}</span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">{d.kind}</span>
                    </p>
                    {d.summary && <p className="max-w-3xl text-muted-foreground">{d.summary}</p>}
                    {!d.readable ? (
                      <p className="text-xs text-muted-foreground">
                        Sin resumen: este tipo de archivo no se puede leer.
                      </p>
                    ) : d.state === "stale" ? (
                      <p className="text-xs text-muted-foreground">
                        El documento ha cambiado desde este resumen.
                      </p>
                    ) : d.state === "missing" ? (
                      <p className="text-xs text-muted-foreground">Sin resumen todavía.</p>
                    ) : null}
                  </div>
                  <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {d.modified ? formatSpanishDate(d.modified) : "—"}
                    </span>
                    {d.readable && d.state !== "fresh" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy.has(d.id) || !!bulk}
                        onClick={() => one(d.id, a.accountId)}
                      >
                        {busy.has(d.id)
                          ? "Resumiendo…"
                          : d.state === "stale"
                            ? "Actualizar resumen"
                            : "Resumir"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
