import { useState } from "react";
import { useMe } from "@/hooks/use-me";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DriveSetupButton } from "@/components/drive";
import { Link } from "@tanstack/react-router";
import { startBackgroundJob } from "@/lib/background.functions";
import { readingCost, type Depth } from "@/lib/onboarding";
import { errorText } from "@/lib/errors";

const TEXT_LIMIT = 40_000;
const FILE_LIMIT = 4 * 1024 * 1024;

/** «Dale tus fuentes»: web, documents, pasted text, Drive and a way into the CRM import. Reading runs in the background. */
export function SourcesStep({ depth, onStarted }: { depth: Depth; onStarted: (jobId: string, sources: string[]) => void }) {
  const start = useServerFn(startBackgroundJob);
  const { data: me } = useMe();
  const [url, setUrl] = useState(me?.currentOrg?.website ?? "");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ filename: string; dataUrl: string }[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(list: FileList | null) {
    const arr = Array.from(list ?? []).slice(0, 3);
    const read = await Promise.all(arr.map(async (f) => {
      if (/^text\/|\.md$|\.csv$/i.test(f.type || f.name)) { const body = await f.text(); setText((t) => `${t}\n\n--- ${f.name} ---\n${body.slice(0, 20000)}`.slice(0, TEXT_LIMIT)); setNames((n) => [...n, f.name]); return null; }
      if (f.size > FILE_LIMIT) { toast.error(`${f.name} supera 4 MB: súbelo a Drive y elígelo desde ahí.`); return null; }
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      return { filename: f.name, dataUrl };
    }));
    setFiles(read.filter((x): x is { filename: string; dataUrl: string } => !!x));
  }

  async function go() {
    setBusy(true);
    try {
      const sources = [url && `Web · ${url}`, ...files.map((f) => f.filename), ...names, text.trim() && !names.length ? "Texto pegado" : ""].filter(Boolean) as string[];
      const r = await start({ data: { kind: "onboarding_read", input: { depth, url, text, files } } });
      onStarted(r.jobId, sources);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const cost = readingCost(depth, !!url.trim());
  const empty = !url.trim() && !text.trim() && !files.length;
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        <div>
          <label htmlFor="ob-url" className="smallcaps text-ink-mid">Web, blog o LinkedIn de la empresa</label>
          <Input id="ob-url" className="mt-2" placeholder="https://tuempresa.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ob-files" className="smallcaps text-ink-mid">Documentos: business plan, P&L, decks, battlecards, ICP</label>
          <Input id="ob-files" className="mt-2" type="file" multiple accept=".pdf,.txt,.md,.csv" onChange={(e) => onFiles(e.target.files)} />
          <div className="mt-2"><DriveSetupButton onText={(name, body) => { setText((t) => `${t}\n\n--- ${name} ---\n${body}`.slice(0, TEXT_LIMIT)); setNames((n) => [...n, `${name} (Drive)`]); }} /></div>
        </div>
        <div>
          <label htmlFor="ob-text" className="smallcaps text-ink-mid">O pega lo que tengas</label>
          <Textarea id="ob-text" className="mt-2" rows={8} maxLength={TEXT_LIMIT} placeholder="Producto, clientes, competidores, precios, objetivos…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <p className="text-sm text-ink-mid">¿Tienes un CRM? Importa tus cuentas y leads desde <Link to="/leads/entrada" className="underline underline-offset-2">Leads → Entrada</Link> (CSV, HubSpot o webhook) cuando termines.</p>
      </div>
      <div className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps">Tus fuentes</p>
        <ul className="mt-2 space-y-1 text-sm">
          {url.trim() && <li>Web · {url} <span className="text-ink-faint">pendiente</span></li>}
          {files.map((f) => <li key={f.filename}>{f.filename} <span className="text-ink-faint">pendiente</span></li>)}
          {names.map((n) => <li key={n}>{n} <span className="text-ink-faint">pendiente</span></li>)}
          {text.trim() && !names.length && <li>Texto pegado <span className="text-ink-faint">pendiente</span></li>}
          {empty && <li className="text-ink-faint">Aún nada. Con la web basta para empezar.</li>}
        </ul>
        <p className="mt-4 text-sm"><span className="smallcaps text-ink-mid">Coste aproximado</span> {cost > 0 ? `${cost.toFixed(2)} en fuentes de pago` : "sin coste en fuentes de pago"}{depth === "deep" ? ", más el debate de los C-Levels" : ""}.</p>
        <Button className="mt-4 w-full" disabled={empty || busy} onClick={go}>{busy ? "Lanzando…" : "Que Nokko lo lea"}</Button>
        <p className="mt-2 text-xs text-ink-mid">Corre en segundo plano: puedes salir y te aviso al terminar.</p>
      </div>
    </div>
  );
}
