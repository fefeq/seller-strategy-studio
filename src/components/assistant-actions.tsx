import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { decideAgentAction } from "@/lib/agent.functions";
import { Button } from "@/components/ui/button";

/** Actions prepared by external assistants (Claude, ChatGPT, Codex…) waiting for the user's OK. */
export function AssistantActions() {
  const qc = useQueryClient();
  const decide = useServerFn(decideAgentAction);
  const { data = [] } = useQuery({
    queryKey: ["assistant-actions"],
    queryFn: async () => (await supabase.from("agent_pending_actions").select("id,summary,created_at").eq("source", "mcp").eq("status", "pending").order("created_at", { ascending: false })).data ?? [],
    refetchInterval: 15_000,
  });
  if (!data.length) return null;
  async function run(id: string, decision: "confirm" | "cancel") {
    try {
      const r = await decide({ data: { id, decision } });
      if (r.status === "failed") toast.error(`No se pudo: ${r.result}`);
      else toast.success(decision === "confirm" ? r.result || "Hecho" : "Cancelado");
    } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries();
  }
  return (
    <section className="mb-8 rounded-lg border bg-card p-5">
      <h2 className="text-2xl">Acciones de tus asistentes de IA</h2>
      <p className="mb-3 text-sm text-muted-foreground">Preparadas desde Claude, ChatGPT, Codex u otro asistente conectado. No se aplican hasta que las confirmes.</p>
      <div className="divide-y">
        {data.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <span className="min-w-0 basis-full break-words sm:flex-1 sm:basis-auto">{a.summary}</span>
            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
            <Button size="sm" onClick={() => run(a.id, "confirm")}>Confirmar</Button>
            <Button size="sm" variant="outline" onClick={() => run(a.id, "cancel")}>Cancelar</Button>
          </div>
        ))}
      </div>
    </section>
  );
}
