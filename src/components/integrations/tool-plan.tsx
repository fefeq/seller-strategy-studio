// «Plan de herramientas del equipo» (Conexiones). A board the team fills by hand: the status is theirs and does not
// mean Nokko is connected. NK-0064, SDD tool-plan-real-connections, U-2.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";
import { confirmed, NOT_SAVED } from "@/lib/save";
import { CONNECTION_LABEL, CONNECTION_NOTE, connectionFor } from "@/lib/tool-plan";

// The team's plan: these are labels the team sets by hand, not connections Nokko makes.
const STATUS: Record<string, string> = {
  planned: "Pendiente",
  in_progress: "Lo estamos montando",
  connected: "Ya lo usamos",
};

// Only the Owner changes the plan (RLS enforces it). A write that matches no row also happens when the row is gone,
// so the message covers both instead of naming only one cause.
const OWNER_ONLY =
  "No se ha guardado. Solo el Owner puede cambiar el plan de herramientas; si ya lo eres, recarga la página y vuelve a intentarlo.";
const notAllowed = (e: unknown) =>
  (e instanceof Error && e.message === NOT_SAVED) ||
  (typeof e === "object" && e !== null && (e as { code?: string }).code === "42501");

export function ToolPlan() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = me?.roles.includes("owner");
  const { data = [] } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (await supabase.from("integrations").select("*").order("category")).data ?? [],
  });
  const cats = [...new Set(data.map((i) => i.category))];
  async function set(id: string, status: string) {
    try {
      await confirmed(supabase.from("integrations").update({ status }).eq("id", id).select("id"));
    } catch (e) {
      toast.error(notAllowed(e) ? OWNER_ONLY : errorText(e));
    }
    qc.invalidateQueries({ queryKey: ["integrations"] });
  }
  return (
    <section>
      <h2 className="text-3xl">Plan de herramientas del equipo</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Un tablero para que el equipo apunte qué herramientas usa o quiere usar. El estado lo marca
        el Owner y no significa que Nokko esté conectado; la etiqueta de conexión indica lo que
        Nokko conoce hoy de esa herramienta.
      </p>
      <div className="mt-4 space-y-8">
        {cats.map((c) => (
          <div key={c}>
            <p className="eyebrow mb-3">{c}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {data
                .filter((i) => i.category === c)
                .map((i) => (
                  <div key={i.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 break-words font-medium">{i.name}</span>
                      <span
                        className={`shrink-0 rounded px-1.5 font-mono text-[10px] uppercase ${i.status === "connected" ? "bg-muted text-foreground" : i.status === "in_progress" ? "bg-warning/25" : "bg-muted text-muted-foreground"}`}
                      >
                        {STATUS[i.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{i.purpose}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {CONNECTION_LABEL[connectionFor(i.name).kind]}
                    </p>
                    {i.status === "connected" && CONNECTION_NOTE[connectionFor(i.name).kind] && (
                      <p className="mt-1 rounded bg-warning/25 px-2 py-1 text-xs text-foreground">
                        {CONNECTION_NOTE[connectionFor(i.name).kind]}
                      </p>
                    )}
                    {isOwner && (
                      <select
                        aria-label={`Estado de ${i.name} en el plan`}
                        className="mt-3 h-10 w-full rounded border bg-background px-2 text-xs md:h-8"
                        value={i.status}
                        onChange={(e) => set(i.id, e.target.value)}
                      >
                        {Object.entries(STATUS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
