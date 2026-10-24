import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { decideDiscovery, runDiscoveryNow } from "@/lib/discoveries.functions";
import { DISMISS_REASONS, KIND_LABEL, type DiscoveryKind } from "@/lib/discoveries";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/discoveries")({
  head: () => ({ meta: [
    { title: "Descubiertos — Nokko" }, { name: "description", content: "Empresas, contactos y competidores nuevos que Nokko encuentra cada semana." },
    { property: "og:title", content: "Descubiertos — Nokko" }, { property: "og:description", content: "Empresas, contactos y competidores nuevos que Nokko encuentra cada semana." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: DiscoveriesPage,
});

type D = { id: string; kind: DiscoveryKind; name: string; detail: Record<string, string | null>; reason: string; source: string; status: string; dismiss_reason: string | null; created_at: string; decided_at: string | null };
const KINDS: DiscoveryKind[] = ["company", "contact", "competitor"];
const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

function DiscoveriesPage() {
  const { data: me } = useMe();
  const leader = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const run = useServerFn(runDiscoveryNow);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["discoveries"],
    queryFn: async () => ((await supabase.from("discoveries").select("id,kind,name,detail,reason,source,status,dismiss_reason,created_at,decided_at").order("created_at", { ascending: false }).limit(300)).data ?? []) as D[],
  });
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  async function searchNow() {
    setBusy(true);
    try {
      const r = await run();
      const total = r.added.company + r.added.contact + r.added.competitor;
      if (total) toast.success(`Encontrado: ${r.added.company} empresas, ${r.added.contact} contactos y ${r.added.competitor} competidores.`);
      else toast.info(r.notes[0] ? `Nada nuevo. ${r.notes[0]}` : "Nada nuevo esta vez: todo lo encontrado ya estaba en tus cuentas o descartado.");
      qc.invalidateQueries({ queryKey: ["discoveries"] });
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  }

  const title = pending.length ? `${pending.length} ${pending.length === 1 ? "novedad" : "novedades"} por decidir` : "Descubiertos";
  return (
    <Page eyebrow="Descubiertos" title={title}>
      <p className="-mt-4 mb-6 max-w-3xl text-muted-foreground">Cada semana Nokko busca empresas que encajan con tu ICP, personas clave en tus cuentas objetivo y competidores nuevos. Acepta lo que te sirva y descarta lo demás: lo descartado no vuelve y Nokko recuerda el motivo.</p>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {leader && <Button onClick={searchNow} disabled={busy}>{busy ? "Buscando… (1–2 min)" : "Buscar ahora"}</Button>}
        <button type="button" className="text-sm text-signal" onClick={() => setHistory((h) => !h)}>{history ? "Ver pendientes" : `Ver lo decidido (${decided.length})`}</button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <Tabs defaultValue="company">
          <TabsList>
            {KINDS.map((k) => <TabsTrigger key={k} value={k}>{KIND_LABEL[k].many} ({(history ? decided : pending).filter((r) => r.kind === k).length})</TabsTrigger>)}
          </TabsList>
          {KINDS.map((k) => {
            const list = (history ? decided : pending).filter((r) => r.kind === k);
            return (
              <TabsContent key={k} value={k} className="mt-4">
                {list.length === 0 && <p className="py-6 text-sm text-muted-foreground">{history ? "Aún no has decidido nada aquí." : emptyText(k, leader)}</p>}
                <ul>{list.map((d) => <Item key={d.id} d={d} />)}</ul>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </Page>
  );
}

function emptyText(k: DiscoveryKind, leader: boolean) {
  const base = { company: "No hay empresas nuevas por revisar.", contact: "No hay contactos nuevos por revisar.", competitor: "No hay competidores nuevos por revisar." }[k];
  return `${base} La próxima búsqueda es automática, una vez por semana${leader ? "; también puedes lanzarla ahora." : "."}`;
}

function Item({ d }: { d: D }) {
  const decide = useServerFn(decideDiscovery);
  const qc = useQueryClient();
  const [dismissing, setDismissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const det = d.detail ?? {};

  async function go(decision: "accept" | "dismiss", reason?: string) {
    setBusy(true);
    try {
      const r = await decide({ data: { id: d.id, decision, reason } });
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ["discoveries"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); setDismissing(false); }
  }

  const facts = d.kind === "company" ? [det["domain"], det["industry"], det["size"], det["country"]]
    : d.kind === "contact" ? [det["title"], det["account_name"]] : [det["url"]];
  return (
    <li className="grid gap-3 border-t py-4 md:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <p className="text-lg font-medium">{d.name}</p>
        <p className="break-words text-sm text-muted-foreground">{facts.filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-sm">{d.reason}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {d.source ? `${d.source.replace(/^Fuentes:\s*/i, "Fuente: ")} · ` : ""}{fmt(d.created_at)}
          {d.status !== "pending" && <> · <span className={d.status === "accepted" ? "" : "text-signal"}>{d.status === "accepted" ? "ACEPTADO" : "DESCARTADO"}</span>{d.dismiss_reason ? ` (${d.dismiss_reason})` : ""}</>}
        </p>
        {(det["linkedin"] || (d.kind === "competitor" && det["url"])) && (
          <a href={det["linkedin"] ?? det["url"] ?? undefined} target="_blank" rel="noreferrer" className="text-xs text-signal">{det["linkedin"] ? "LinkedIn" : "Web"} ↗</a>
        )}
        {d.status === "accepted" && d.kind === "company" && <Link to="/accounts" className="ml-3 text-xs text-signal">Ir a Cuentas</Link>}
        {d.status === "accepted" && d.kind === "contact" && <Link to="/leads" className="ml-3 text-xs text-signal">Ir a Leads</Link>}
      </div>
      {d.status === "pending" && (
        <div className="flex flex-wrap items-start gap-2 md:justify-end">
          {!dismissing ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => go("accept")}>{d.kind === "company" ? "Añadir a Cuentas" : d.kind === "contact" ? "Añadir como lead" : "Añadir a competidores"}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDismissing(true)}>Descartar</Button>
            </>
          ) : (
            <div className="flex max-w-xs flex-col items-stretch gap-1">
              <p className="eyebrow">¿Por qué lo descartas?</p>
              {DISMISS_REASONS.map((r) => <Button key={r} size="sm" variant="outline" disabled={busy} onClick={() => go("dismiss", r)}>{r}</Button>)}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => go("dismiss")}>Sin motivo</Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
