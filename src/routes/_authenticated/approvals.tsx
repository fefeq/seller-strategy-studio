import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { canDecideApprovals } from "@/lib/roles";
import { Page, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Aprobaciones — GTM Brain" }, { name: "description", content: "Cambios importantes con evidencia: aplicar u omitir." }, { property: "og:title", content: "Aprobaciones — GTM Brain" }, { property: "og:description", content: "Cambios importantes con evidencia: aplicar u omitir." }] }),
  component: Approvals,
});

const KIND: Record<string, string> = { stage_change: "Cambio de etapa", discount: "Descuento", merge: "Fusión de duplicados", other: "Otro" };

function Approvals() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const can = canDecideApprovals(me?.roles ?? []);
  const { data = [] } = useQuery({ queryKey: ["approvals"], queryFn: async () => (await supabase.from("approvals").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [title, setTitle] = useState(""); const [ev, setEv] = useState("");

  async function decide(a: any, status: "applied" | "skipped") {
    if (status === "applied" && a.kind === "stage_change") {
      try {
        const p = JSON.parse(a.evidence);
        if (p.deal_id) await supabase.from("deals").update({ stage: p.stage, probability: p.stage === "won" ? 100 : undefined }).eq("id", p.deal_id);
      } catch { /* evidence not structured */ }
    }
    const { error } = await supabase.from("approvals").update({ status }).eq("id", a.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
  }
  async function propose() {
    await supabase.from("approvals").insert({ kind: "other", title, evidence: ev });
    setTitle(""); setEv(""); qc.invalidateQueries({ queryKey: ["approvals"] });
  }
  const pending = data.filter((a) => a.status === "pending");
  const done = data.filter((a) => a.status !== "pending");

  return (
    <Page eyebrow="Humano en el bucle" title="Aprobaciones">
      {!can && <p className="mb-4 text-sm text-muted-foreground">Puedes proponer cambios. Solo Owner, Sales Leader o Deal Desk pueden aplicarlos.</p>}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          {pending.length === 0 && <Empty>Nada pendiente.</Empty>}
          {pending.map((a) => (
            <div key={a.id} className="rounded-lg border bg-card p-4">
              <p className="eyebrow">{KIND[a.kind] ?? a.kind}</p>
              <p className="mt-1 font-medium">{a.title}</p>
              {a.evidence && <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">{a.evidence}</pre>}
              {can && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => decide(a, "applied")}>Aplicar</Button><Button size="sm" variant="outline" onClick={() => decide(a, "skipped")}>Omitir</Button></div>}
            </div>
          ))}
          {done.length > 0 && <p className="eyebrow pt-6">Historial</p>}
          {done.map((a) => (
            <div key={a.id} className="flex justify-between rounded-md border p-3 text-sm opacity-70"><span>{a.title}</span><span className="font-mono text-xs">{a.status === "applied" ? "Aplicado" : "Omitido"}</span></div>
          ))}
        </div>
        <div className="space-y-3 rounded-lg border bg-card p-5">
          <h3 className="text-2xl">Proponer cambio</h3>
          <Input placeholder="Qué quieres cambiar" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Evidencia" rows={5} value={ev} onChange={(e) => setEv(e.target.value)} />
          <Button disabled={!title} onClick={propose}>Enviar</Button>
        </div>
      </div>
    </Page>
  );
}
