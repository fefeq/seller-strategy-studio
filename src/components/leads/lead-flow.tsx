import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/hooks/use-leads";
import { runLeadFlowNow } from "@/lib/background.functions";
import { FLOW_STEPS, STATUS_WORD, readFlow } from "@/lib/lead-flow";
import { errorText } from "@/lib/errors";

/** Where the new-lead flow stands: account → company data → key people → AI proposal, with a button to (re)run it. */
export function LeadFlowPanel({ lead }: { lead: Lead }) {
  const run = useServerFn(runLeadFlowNow);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const flow = readFlow((lead as { flow?: unknown }).flow);

  async function go() {
    setBusy(true);
    try {
      await run({ data: { leadId: lead.id } });
      toast.success("Flujo completado. La propuesta está en Sugerencias.");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 border-t pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Flujo de entrada</p>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={go}>
          {busy
            ? "Trabajando… (hasta 1 min)"
            : flow
              ? "Repetir el flujo"
              : "Pasar por el flujo ahora"}
        </Button>
      </div>
      {!flow && !busy && (
        <p className="text-sm text-muted-foreground">
          Nokko completará su cuenta, buscará personas clave y te propondrá la siguiente etapa. Pasa
          solo al entrar el lead; si aún no lo ha hecho, puedes lanzarlo tú.
        </p>
      )}
      {flow && (
        <ol className="space-y-1.5 text-sm">
          {FLOW_STEPS.map((s, i) => {
            const st = flow.steps[s.id];
            return (
              <li key={s.id} className="grid grid-cols-[1.25rem_8.5rem_1fr] gap-2">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className="font-medium">
                  {s.label}
                  <span
                    className={`block text-xs uppercase tracking-wide ${st?.status === "failed" ? "text-signal" : "text-muted-foreground"}`}
                  >
                    {st ? STATUS_WORD[st.status] : "Pendiente"}
                  </span>
                </span>
                <span className="break-words text-muted-foreground">{st?.note ?? "—"}</span>
              </li>
            );
          })}
        </ol>
      )}
      {flow && lead.account_id && (
        <p className="text-xs">
          <Link to="/accounts/$id" params={{ id: lead.account_id }} className="text-signal">
            Abrir la cuenta
          </Link>{" "}
          ·{" "}
          <Link to="/inbox" className="text-signal">
            Ver la propuesta en Sugerencias
          </Link>
        </p>
      )}
    </section>
  );
}
