import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integraciones — Nokko" }, { name: "description", content: "Mapa de herramientas del stack comercial." }, { property: "og:title", content: "Integraciones — Nokko" }, { property: "og:description", content: "Mapa de herramientas del stack comercial." }] }),
  component: Integrations,
});

const STATUS: Record<string, string> = { planned: "Planificada", in_progress: "En curso", connected: "Conectada" };

function Integrations() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = me?.roles.includes("owner");
  const { data = [] } = useQuery({ queryKey: ["integrations"], queryFn: async () => (await supabase.from("integrations").select("*").order("category")).data ?? [] });
  const cats = [...new Set(data.map((i) => i.category))];
  async function set(id: string, status: string) {
    await supabase.from("integrations").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["integrations"] });
  }
  return (
    <Page eyebrow="Stack comercial" title="Integraciones">
      <p className="-mt-4 mb-8 max-w-2xl text-sm text-muted-foreground">El mapa de herramientas que alimentan el sistema. Se conectan una a una; dime cuál quieres activar primero.</p>
      <div className="space-y-8">
        {cats.map((c) => (
          <div key={c}>
            <p className="eyebrow mb-3">{c}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {data.filter((i) => i.category === c).map((i) => (
                <div key={i.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-3"><span className="min-w-0 break-words font-medium">{i.name}</span>
                    <span className={`shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${i.status === "connected" ? "bg-success/15 text-success" : i.status === "in_progress" ? "bg-warning/25" : "bg-muted text-muted-foreground"}`}>{STATUS[i.status]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{i.purpose}</p>
                  {isOwner && (
                    <select className="mt-3 h-10 w-full rounded border bg-background px-2 text-xs md:h-8" value={i.status} onChange={(e) => set(i.id, e.target.value)}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
