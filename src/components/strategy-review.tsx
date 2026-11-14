// AI strategic review panel (SDD-20261027 F4 · H-6). Owner and Sales Leader only. One request = one AI call at most; the
// last review always stays on screen, also when the data did not change, the budget ran out or the AI failed (CA-44..CA-46).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Empty, ScreenState } from "@/components/page";
import { StrategyBadge, StrategyEvidence } from "@/components/strategy-evidence";
import { canUseAdvisor } from "@/lib/advisor";
import { errorText } from "@/lib/errors";
import { requestStrategyReview } from "@/lib/strategy.functions";
import { readSuggestions } from "@/lib/strategy-review-read";
import { ELEMENT_LABEL, parseStrategy } from "@/lib/strategy-suggestions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });

export function StrategyReviewPanel() {
  const { data: me } = useMe();
  const allowed = canUseAdvisor(me?.roles ?? []);
  const qc = useQueryClient();
  const run = useServerFn(requestStrategyReview);
  const [critical, setCritical] = useState(false);
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: last } = useQuery({
    queryKey: ["strategy_review_last"],
    enabled: allowed,
    queryFn: async () =>
      (
        await supabase
          .from("strategy_reviews")
          .select("created_at,mode,depth,suggestions")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  if (me && !allowed)
    return (
      <ScreenState isPending={false} error={null} refetch={() => undefined} forbidden="Solo el Owner y el Sales Leader de la empresa pueden pedir una revisión estratégica con IA. Pídeselo a uno de ellos.">
        {null}
      </ScreenState>
    );

  async function ask() {
    setBusy(true);
    setNotice(null);
    try {
      const r = await run({
        data: { mode: critical ? "critical" : "normal", depth: deep ? "medium" : "low" },
      });
      setNotice(r.notice);
      if (r.status === "fresh") {
        await qc.invalidateQueries({ queryKey: ["strategy_review_last"] });
        await qc.invalidateQueries({ queryKey: ["suggestions"] });
        toast.success("Revisión lista. Las sugerencias están también en Sugerencias.");
      }
    } catch (e) {
      setNotice(
        "No hemos podido hacer la revisión ahora. Se conserva la anterior; inténtalo de nuevo en unos minutos.",
      );
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const items = readSuggestions(last?.suggestions);
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <p className="text-sm">
          Una sola llamada a la IA lee tu ICP, segmentos, posicionamiento, mensajes, productos,
          pipeline, leads, llamadas, señales y experimentos, y devuelve como máximo 7 sugerencias
          con su evidencia. Si falta una cifra, dice «sin dato».
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={critical}
            onChange={(e) => setCritical(e.target.checked)}
          />
          <span>
            <span className="font-medium">Revisión crítica</span>: prioriza los supuestos débiles y
            las contradicciones entre lo que declaras y lo que ven tus datos.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
          />
          <span>
            <span className="font-medium">A fondo</span>: más razonamiento y más coste. Por defecto
            usamos el modo barato.
          </span>
        </label>
        <Button
          className="h-auto min-h-10 w-full whitespace-normal py-2 md:w-auto"
          onClick={ask}
          disabled={busy}
        >
          {busy ? "Revisando tu estrategia…" : "Pedir revisión"}
        </Button>
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
      {last ? (
        <div className="space-y-3">
          <p className="eyebrow">
            Última revisión · {when(last.created_at)} ·{" "}
            {last.mode === "critical" ? "Revisión crítica" : "Normal"}
            {last.depth === "medium" ? " · A fondo" : ""}
          </p>
          {items.length === 0 ? (
            <Empty>La última revisión no encontró sugerencias con evidencia suficiente.</Empty>
          ) : (
            items.map((s) => {
              const m = parseStrategy(s.strategy)!;
              return (
                <div
                  key={s.dedupe_key}
                  className="min-w-0 break-words rounded-lg border bg-card p-4 text-sm"
                >
                  <p className="eyebrow">{ELEMENT_LABEL[m.element]}</p>
                  <p className="mt-1 font-medium">{s.title}</p>
                  <p className="mt-1 text-muted-foreground">{s.body}</p>
                  <StrategyBadge m={m} />
                  <StrategyEvidence m={m} />
                </div>
              );
            })
          )}
        </div>
      ) : (
        <Empty>Todavía no has pedido ninguna revisión.</Empty>
      )}
    </div>
  );
}
