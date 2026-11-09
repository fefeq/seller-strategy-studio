// Google Drive on the screens: the file picker (company folder only), import to the hub, documents for the
import { useBackgroundReady } from "@/components/background";
import { startBackgroundJob } from "@/lib/background.functions";
// AI setup, «Guardar en Drive» and the Drive tab of an account. All calls run on the server (drive.functions.ts).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty } from "@/components/page";
import { errorText } from "@/lib/errors";
import { ageText } from "@/lib/web-research";
import {
  accountDrive,
  createAccountFolder,
  driveBrowse,
  driveImport,
  driveRead,
  linkAccountDriveFolder,
  saveToDrive,
} from "@/lib/drive.functions";

type Item = {
  id: string;
  name: string;
  kind: string;
  isFolder: boolean;
  url: string | null;
  modified: string | null;
  readable: boolean;
};
type Picked = { id: string; name: string };

const openTab = (url: string | null) => () => {
  if (url) window.open(url, "_blank", "noopener");
};

function FileRow({ f, action }: { f: Item; action?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <span className="min-w-0 flex-1">
        {f.url ? (
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="break-words font-medium underline [overflow-wrap:anywhere]"
          >
            {f.name}
          </a>
        ) : (
          <span className="font-medium">{f.name}</span>
        )}
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {f.kind}
          {f.modified ? ` · ${ageText(f.modified)}` : ""}
        </span>
      </span>
      {action}
    </li>
  );
}

/** Pick a file from the company's Drive folder (browse, search or paste a link). */
export function DrivePicker({
  open,
  onOpenChange,
  onPick,
  title,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (f: Picked) => void;
  title: string;
  busy?: boolean;
}) {
  const browse = useServerFn(driveBrowse);
  const [folderId, setFolderId] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [link, setLink] = useState("");
  const { data, isFetching, error } = useQuery({
    queryKey: ["drive-browse", folderId ?? "", query],
    queryFn: () => browse({ data: { folderId, query: query || undefined } }),
    enabled: open,
    staleTime: 30_000,
    retry: false,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Solo ves la carpeta de esta empresa en Google Drive
            {data?.root.url ? (
              <>
                {" "}
                (
                <a className="underline" href={data.root.url} target="_blank" rel="noreferrer">
                  abrir en Drive
                </a>
                )
              </>
            ) : null}
            . Para usar otro archivo, muévelo antes a esa carpeta.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(draft.trim());
          }}
        >
          <Input
            placeholder="Buscar por nombre o contenido"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        {data && !query && (
          <p className="text-xs text-muted-foreground">
            <button className="underline" onClick={() => setFolderId(undefined)}>
              {data.root.name}
            </button>
            {data.path.map((p) => (
              <span key={p.id}>
                {" "}
                ›{" "}
                <button className="underline" onClick={() => setFolderId(p.id)}>
                  {p.name}
                </button>
              </span>
            ))}
            {data.folder.id !== data.root.id && <span> › {data.folder.name}</span>}
          </p>
        )}
        {query && (
          <p className="text-xs text-muted-foreground">
            Resultados para «{query}» ·{" "}
            <button
              className="underline"
              onClick={() => {
                setQuery("");
                setDraft("");
              }}
            >
              volver a la carpeta
            </button>
          </p>
        )}
        {error ? (
          <p className="text-sm text-destructive">{errorText(error)}</p>
        ) : isFetching && !data ? (
          <p className="text-sm text-muted-foreground">Abriendo Google Drive…</p>
        ) : data && data.files.length === 0 ? (
          <Empty>
            {query
              ? "Nada con ese texto en la carpeta de la empresa."
              : "Esta carpeta está vacía. Sube o mueve aquí los documentos en Google Drive."}
          </Empty>
        ) : (
          <ul className="divide-y border-t">
            {data?.files.map((f) => (
              <FileRow
                key={f.id}
                f={f}
                action={
                  f.isFolder ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setQuery("");
                        setDraft("");
                        setFolderId(f.id);
                      }}
                    >
                      Abrir
                    </Button>
                  ) : f.readable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => onPick({ id: f.id, name: f.name })}
                    >
                      Elegir
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No se puede leer</span>
                  )
                }
              />
            ))}
          </ul>
        )}
        <form
          className="flex gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) onPick({ id: link.trim(), name: "el archivo enlazado" });
          }}
        >
          <Input
            placeholder="O pega el enlace de un archivo de la carpeta"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={busy || !link.trim()}>
            Usar enlace
          </Button>
        </form>
        {busy && (
          <p className="text-sm text-muted-foreground">
            Leyendo el archivo… Los PDF tardan unos segundos más.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Hub: import a Drive file as a document of the current section. */
export function DriveImportButton({
  section,
  onImported,
  disabled = false,
  reason,
}: {
  section: string;
  onImported: (docId: string) => void;
  /** Disabled with its reason (the screen shows the reason as text too), e.g. Reglas for roles that may not write it. */
  disabled?: boolean;
  reason?: string;
}) {
  const run = useServerFn(driveImport);
  const startJob = useServerFn(startBackgroundJob);
  const background = useBackgroundReady();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function pick(f: Picked) {
    setBusy(true);
    try {
      // PDFs are transcribed by the AI and take a while: in the background when available.
      if (background && /\.pdf$/i.test(f.name)) {
        await startJob({
          data: {
            kind: "drive_import",
            input: { file: f.id, section: section as "company" },
            label: `Importar «${f.name}»`,
          },
        });
        toast.success("Importando en segundo plano. Te aviso aquí cuando esté en el hub.");
        setOpen(false);
        return;
      }
      const r = await run({ data: { file: f.id, section: section as "company" } });
      toast.success(
        `«${r.title}» importado.${r.truncated ? " El original es muy largo: se ha guardado el principio." : ""}`,
      );
      setOpen(false);
      onImported(r.docId);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        title={disabled ? reason : undefined}
        onClick={() => setOpen(true)}
      >
        Importar de Drive
      </Button>
      <DrivePicker
        open={open}
        onOpenChange={setOpen}
        onPick={pick}
        busy={busy}
        title="Importar de Google Drive"
      />
    </>
  );
}

/** Setup: adds a Drive file's text to what the AI reads (nothing is saved until the proposal is reviewed). */
export function DriveSetupButton({ onText }: { onText: (name: string, text: string) => void }) {
  const run = useServerFn(driveRead);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function pick(f: Picked) {
    setBusy(true);
    try {
      const r = await run({ data: { file: f.id } });
      onText(r.name, r.text);
      toast.success(
        `«${r.name}» añadido a lo que leerá la IA.${r.truncated ? " Solo el principio: es muy largo." : ""}`,
      );
      setOpen(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Añadir desde Google Drive
      </Button>
      <DrivePicker
        open={open}
        onOpenChange={setOpen}
        onPick={pick}
        busy={busy}
        title="Documentos de Google Drive"
      />
    </>
  );
}

/** Saves a text as a Google Doc in the account folder (or the company folder). */
export function SaveToDriveButton({
  title,
  markdown,
  accountId,
  size = "default",
  variant = "outline",
  label = "Guardar en Drive",
}: {
  title: string;
  markdown: string | (() => string);
  accountId?: string | null;
  size?: "default" | "sm";
  variant?: "outline" | "ghost";
  label?: string;
}) {
  const run = useServerFn(saveToDrive);
  const [busy, setBusy] = useState(false);
  async function go() {
    const md = typeof markdown === "function" ? markdown() : markdown;
    if (!md.trim()) return toast.error("No hay nada que guardar todavía.");
    setBusy(true);
    try {
      const r = await run({ data: { title, markdown: md, accountId: accountId ?? null } });
      toast.success(
        `Guardado en Drive, carpeta «${r.folder}».${r.fallback ? " La carpeta enlazada de la cuenta no admite escritura de Nokko." : ""}`,
        r.url ? { action: { label: "Abrir", onClick: openTab(r.url) } } : undefined,
      );
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size={size} variant={variant} onClick={go} disabled={busy}>
      {busy ? "Guardando en Drive…" : label}
    </Button>
  );
}

/** Account tab: its Drive folder (create or link one inside the company folder) and the files in it. */
export function AccountDriveTab({ accountId }: { accountId: string }) {
  const list = useServerFn(accountDrive);
  const create = useServerFn(createAccountFolder);
  const link = useServerFn(linkAccountDriveFolder);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["account-drive", accountId],
    queryFn: () => list({ data: { accountId } }),
    retry: false,
  });
  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setUrl("");
      await refetch();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Abriendo Google Drive…</p>;
  if (error) return <p className="text-sm text-destructive">{errorText(error)}</p>;
  const linkForm = (
    <form
      className="flex max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => link({ data: { accountId, folder: url.trim() } }), "Carpeta enlazada.");
      }}
    >
      <Input
        placeholder="Enlace de una carpeta dentro de la carpeta de la empresa"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button type="submit" variant="outline" disabled={busy || !url.trim()}>
        Enlazar
      </Button>
    </form>
  );
  if (!data?.folder)
    return (
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Esta cuenta aún no tiene carpeta en Google Drive. Crea una (dentro de la carpeta de la
          empresa) o enlaza una que ya exista allí. Las propuestas y planes que guardes en Drive
          irán a ella.
        </p>
        <Button
          onClick={() => act(() => create({ data: { accountId } }), "Carpeta creada en Drive.")}
          disabled={busy}
        >
          {busy ? "Creando…" : "Crear carpeta en Drive"}
        </Button>
        {linkForm}
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Carpeta:{" "}
          {data.folder.url ? (
            <a
              className="font-medium underline"
              href={data.folder.url}
              target="_blank"
              rel="noreferrer"
            >
              {data.folder.name}
            </a>
          ) : (
            data.folder.name
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Actualizar
        </Button>
      </div>
      {data.files.length === 0 ? (
        <Empty>
          La carpeta está vacía. Guarda aquí el plan o la propuesta, o sube archivos en Drive.
        </Empty>
      ) : (
        <ul className="divide-y border-t">
          {data.files.map((f) => (
            <FileRow key={f.id} f={f} />
          ))}
        </ul>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Cambiar la carpeta de la cuenta
        </summary>
        <div className="mt-3">{linkForm}</div>
      </details>
    </div>
  );
}
