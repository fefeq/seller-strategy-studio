import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { StripeConnect } from "@/components/stripe-panel";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Conexiones — Nokko" }, { name: "description", content: "Qué se conecta hoy a Nokko y el plan de herramientas del equipo." }, { property: "og:title", content: "Conexiones — Nokko" }, { property: "og:description", content: "Qué se conecta hoy a Nokko y el plan de herramientas del equipo." }] }),
  component: Integrations,
});

// The team's plan: these are labels the team sets by hand, not connections Nokko makes.
const STATUS: Record<string, string> = { planned: "Pendiente", in_progress: "Lo estamos montando", connected: "Ya lo usamos" };

/** What actually connects to Nokko today, with the place to set it up. */
const WORKING: { name: string; what: string; to: string; hash?: string; pending?: string }[] = [
  { name: "Formularios, Zapier, Make y CRMs por webhook", what: "Cada lead entra con su empresa, persona, etapa y deal.", to: "/leads/entrada" },
  { name: "CSV de leads y de cuentas", what: "Importación con vista previa de columnas.", to: "/leads/entrada" },
  { name: "Claude, ChatGPT y Codex (MCP)", what: "Tu asistente consulta Nokko y propone cambios que confirmas aquí.", to: "/team", hash: "mcp" },
  { name: "Telegram", what: "Avisos, resumen diario y el agente en el móvil.", to: "/team", hash: "mcp", pending: "Falta crear el bot de Nokko" },
  { name: "Email del informe semanal", what: "Los lunes, a Owner y Sales Leader.", to: "/inbox", pending: "Falta verificar el dominio de envío" },
];

/** Native connections not built yet. Listed so nobody looks for them in the plan below. */
const NOT_YET = ["HubSpot, Pipedrive, Attio o Salesforce en sincronización nativa (hoy entran por webhook)", "Google Calendar y Gmail", "Gong y Fireflies"];

function Integrations() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = me?.roles.includes("owner");
  const { data = [] } = useQuery({ queryKey: ["integrations"], queryFn: async () => (await supabase.from("integrations").select("*").order("category")).data ?? [] });
  const cats = [...new Set(data.map((i) => i.category))];
  async function set(id: string, status: string) {
    try { await confirmed(supabase.from("integrations").update({ status }).eq("id", id).select("id")); }
    catch (e) { toast.error(errorText(e)); }
    qc.invalidateQueries({ queryKey: ["integrations"] });
  }
  return (
    <Page eyebrow="Stack comercial" title="Conexiones">
      <section className="mb-10">
        <h2 className="text-3xl">Lo que se conecta hoy</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Estas conexiones están hechas en Nokko y mueven datos de verdad. Las marcadas con un paso pendiente están programadas y se activan cuando el equipo de Nokko lo complete.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {WORKING.map((w) => (
            <Link key={w.name} to={w.to} hash={w.hash} className="block rounded-lg border bg-card p-4 hover:border-signal">
              <span className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{w.name}</span><span className={`shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${w.pending ? "bg-warning/25" : "bg-success/15 text-success"}`}>{w.pending ? "Falta un paso" : "Disponible"}</span></span>
              <span className="mt-1 block text-sm text-muted-foreground">{w.what}</span>
              {w.pending && <span className="mt-1 block text-xs text-muted-foreground">{w.pending}.</span>}
            </Link>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2"><StripeConnect /></div>
        <p className="mt-4 text-xs text-muted-foreground">Aún sin conexión nativa: {NOT_YET.join(" · ")}.</p>
      </section>

      <section>
        <h2 className="text-3xl">Plan de herramientas del equipo</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Un tablero para que el equipo apunte qué herramientas usa o quiere usar. El estado lo marcáis vosotros: no significa que Nokko esté conectado a ellas.</p>
        <div className="mt-4 space-y-8">
          {cats.map((c) => (
            <div key={c}>
              <p className="eyebrow mb-3">{c}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {data.filter((i) => i.category === c).map((i) => (
                  <div key={i.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between gap-3"><span className="min-w-0 break-words font-medium">{i.name}</span>
                      <span className={`shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${i.status === "connected" ? "bg-muted text-foreground" : i.status === "in_progress" ? "bg-warning/25" : "bg-muted text-muted-foreground"}`}>{STATUS[i.status]}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{i.purpose}</p>
                    {isOwner && (
                      <select aria-label={`Estado de ${i.name} en el plan`} className="mt-3 h-10 w-full rounded border bg-background px-2 text-xs md:h-8" value={i.status} onChange={(e) => set(i.id, e.target.value)}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
