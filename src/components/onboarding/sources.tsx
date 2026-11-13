import { useState } from "react";
import { useMe } from "@/hooks/use-me";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DriveRefButton } from "@/components/drive";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { startBackgroundJob } from "@/lib/background.functions";
import { readingCost, type Depth } from "@/lib/onboarding";
import { errorText } from "@/lib/errors";
import { FieldActions } from "@/components/field-actions";
import { MAX_SOURCES, sourcesLimitText } from "@/lib/onboarding-files-limit";
import {
  mergeRefs,
  perSourceFloor,
  storagePath,
  uploadProblem,
  type SourceRef,
} from "@/lib/onboarding-source-refs";

const TEXT_LIMIT = 40_000;
type Item = SourceRef & { state: "uploading" | "ready" | "error" };

/** «Dale tus fuentes»: web, documents, pasted text, Drive and a way into the CRM import. Reading runs in the background. */
export function SourcesStep({
  depth,
  onStarted,
  onSkip,
}: {
  depth: Depth;
  onStarted: (jobId: string, sources: string[]) => void;
  onSkip?: () => void;
}) {
  const start = useServerFn(startBackgroundJob);
  const { data: me } = useMe();
  const [url, setUrl] = useState(me?.currentOrg?.website ?? "");
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  function add(list: Item[]) {
    const r = mergeRefs(items, list);
    setItems(r.sources as Item[]);
    return { dropped: r.dropped, duplicated: r.duplicated };
  }
  const notify = (r: { dropped: string[]; duplicated: string[] }) => {
    if (r.dropped.length)
      toast.error(`${sourcesLimitText()} Se quedan fuera: ${r.dropped.join(", ")}.`);
    if (r.duplicated.length) toast.info(`Ya estaba en la lista: ${r.duplicated.join(", ")}.`);
  };

  async function onFiles(list: FileList | null) {
    const orgId = me?.currentOrg?.org_id;
    const userId = me?.user.id;
    if (!orgId || !userId) return;
    const ok: { f: File; item: Item }[] = [];
    for (const f of Array.from(list ?? [])) {
      const bad = uploadProblem(f);
      if (bad) toast.error(bad);
      else
        ok.push({
          f,
          item: {
            kind: "storage",
            ref: storagePath(orgId, userId, crypto.randomUUID(), f.name),
            name: f.name,
            state: "uploading",
          },
        });
    }
    const r = add(ok.map((x) => x.item));
    notify(r);
    const skip = new Set(r.dropped);
    await Promise.all(
      ok
        .filter((x) => !skip.has(x.item.name))
        .map(async ({ f, item }) => {
          const { error } = await supabase.storage
            .from("onboarding-sources")
            .upload(item.ref, f, { contentType: f.type || undefined });
          if (error) toast.error(`${f.name}: ${errorText(error)}`);
          setItems((xs) =>
            xs.map((x) => (x.ref === item.ref ? { ...x, state: error ? "error" : "ready" } : x)),
          );
        }),
    );
  }

  function remove(it: Item) {
    setItems((xs) => xs.filter((x) => x.ref !== it.ref));
    if (it.kind === "storage" && it.state !== "error")
      void supabase.storage.from("onboarding-sources").remove([it.ref]);
  }

  const uploading = items.some((x) => x.state === "uploading");
  const ready = items.filter((x) => x.state === "ready");

  async function go() {
    setBusy(true);
    try {
      const sources = [
        url && `Web · ${url}`,
        ...ready.map((x) => x.name),
        text.trim() ? "Texto pegado" : "",
      ].filter(Boolean) as string[];
      const refs = ready.map(({ kind, ref, name }) => ({ kind, ref, name }));
      const r = await start({
        data: { kind: "onboarding_read", input: { depth, url, text, sources: refs } },
      });
      onStarted(r.jobId, sources);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // A source that has not been read yet is simply taken off the list.
  const quit = (fn: () => void) => (
    <FieldActions
      kind="onboarding_source"
      roles={me?.roles ?? []}
      labels={{ delete: "Quitar" }}
      handlers={{ delete: fn }}
    />
  );
  const cost = readingCost(depth, !!url.trim());
  const empty = !url.trim() && !text.trim() && !ready.length;
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        <div>
          <label htmlFor="ob-url" className="smallcaps text-ink-mid">
            Web, blog o LinkedIn de la empresa
          </label>
          <Input
            id="ob-url"
            className="mt-2"
            placeholder="https://tuempresa.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ob-files" className="smallcaps text-ink-mid">
            Documentos: business plan, P&L, decks, battlecards, ICP
          </label>
          <p className="mt-1 text-xs text-ink-mid">
            Hasta {MAX_SOURCES} entre archivos (PDF, TXT, MD o CSV, máx. 20 MB) y Drive.
          </p>
          <Input
            id="ob-files"
            className="mt-2"
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv"
            onChange={(e) => {
              const el = e.target;
              void onFiles(el.files).finally(() => {
                el.value = "";
              });
            }}
          />
          <div className="mt-2">
            <DriveRefButton
              onPick={(f) =>
                notify(add([{ kind: "drive", ref: f.id, name: `${f.name} (Drive)`, state: "ready" }]))
              }
            />
          </div>
        </div>
        <div>
          <label htmlFor="ob-text" className="smallcaps text-ink-mid">
            O pega lo que tengas
          </label>
          <Textarea
            id="ob-text"
            className="mt-2"
            rows={8}
            maxLength={TEXT_LIMIT}
            placeholder="Producto, clientes, competidores, precios, objetivos…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <p className="text-sm text-ink-mid">
          ¿Tienes un CRM? Importa tus cuentas y leads desde{" "}
          <Link to="/leads/entrada" className="underline underline-offset-2">
            Leads → Entrada
          </Link>{" "}
          (CSV, HubSpot o webhook) cuando termines.
        </p>
      </div>
      <div className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps">Tus fuentes</p>
        <ul className="mt-2 space-y-1 text-sm">
          {url.trim() && (
            <li className="flex flex-wrap items-center gap-2">
              Web · {url} <span className="text-ink-faint">pendiente</span>
              {quit(() => setUrl(""))}
            </li>
          )}
          {items.map((it) => (
            <li key={it.ref} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 [overflow-wrap:anywhere]">{it.name}</span>
              <span className={it.state === "error" ? "text-destructive" : "text-ink-faint"}>
                {it.state === "uploading" ? "subiendo…" : it.state === "error" ? "error al subir" : "lista"}
              </span>
              {quit(() => remove(it))}
            </li>
          ))}
          {text.trim() && (
            <li className="flex flex-wrap items-center gap-2">
              Texto pegado <span className="text-ink-faint">pendiente</span>
              {quit(() => setText(""))}
            </li>
          )}
          {empty && <li className="text-ink-faint">Aún nada. Con la web basta para empezar.</li>}
        </ul>
        {items.length > 0 && (
          <p className="mt-2 text-xs text-ink-mid">
            {items.length}/{MAX_SOURCES} documentos. Si son largos, de cada uno se leerán al menos{" "}
            {perSourceFloor(ready.length || 1).toLocaleString("es-ES")} caracteres; al terminar te digo
            cuáles se leyeron enteros.
          </p>
        )}
        <p className="mt-4 text-sm">
          <span className="smallcaps text-ink-mid">Coste aproximado</span>{" "}
          {cost > 0 ? `${cost.toFixed(2)} en fuentes de pago` : "sin coste en fuentes de pago"}
          {depth === "deep" ? ", más el debate de los C-Levels" : ""}.
        </p>
        <Button className="mt-4 w-full" disabled={empty || busy || uploading} onClick={go}>
          {busy ? "Lanzando…" : uploading ? "Subiendo documentos…" : "Que Nokko lo lea"}
        </Button>
        <p className="mt-2 text-xs text-ink-mid">
          Corre en segundo plano: puedes salir y te aviso al terminar.
        </p>
        {onSkip && (
          <div className="mt-6 border-t border-hairline pt-4">
            <Button variant="outline" className="w-full" disabled={busy} onClick={onSkip}>
              Hacer solo el diagnóstico
            </Button>
            <p className="mt-2 text-xs text-ink-mid">
              Sin fuentes, Nokko no te propone ICP ni posicionamiento: los completas después en
              Estrategia.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
