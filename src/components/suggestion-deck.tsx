import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SwipeDeck } from "@/components/swipe-deck";
import { useSuggestions } from "@/components/suggestions";
import { useAgent } from "@/components/agent";
import { decideSuggestion } from "@/lib/agent.functions";
import { linkTarget, resolvePlan } from "@/lib/proactive/resolve";
import { actionTool } from "@/lib/json";
import { errorText } from "@/lib/errors";

type S = NonNullable<ReturnType<typeof useSuggestions>["data"]>[number];
const PRIO: Record<number, string> = { 1: "Urgente", 2: "Importante", 3: "Cuando puedas" };
const DECISION = { right: "approve", left: "dismiss", up: "snooze" } as const;

/** Sugerencias as a swipe deck: → hacer, ← descartar, ↑ en 3 días. */
export function SuggestionDeck({ items }: { items: S[] }) {
  const decide = useServerFn(decideSuggestion);
  const qc = useQueryClient();
  return (
    <SwipeDeck
      items={items}
      labels={{ right: "Hacer", left: "Descartar", up: "Más tarde" }}
      render={(s) => <DeckFace s={s} />}
      onCommit={async (s, dir) => {
        try {
          const r = await decide({ data: { id: s.id, decision: DECISION[dir] } });
          if (dir === "right") toast.success(r.message);
          qc.invalidateQueries({ queryKey: ["suggestions"] });
        } catch (e) { toast.error(errorText(e)); throw e; }
      }}
      done={<p className="mt-4 text-sm"><Link to="/inbox" search={{ vista: "lista" }} className="underline underline-offset-4">Ver la lista</Link></p>}
    />
  );
}

function DeckFace({ s }: { s: S }) {
  const [open, setOpen] = useState(false);
  const { open: openAgent } = useAgent();
  const navigate = useNavigate();
  const hasAction = !!actionTool(s.action);
  function resolve() {
    const plan = resolvePlan(s);
    openAgent({ prompt: plan.prompt, fresh: true, docked: true, side: plan.side, mode: "chat", personaId: null, workflowId: null });
    const to = linkTarget(plan.to);
    if (to) navigate({ to: to.to, search: to.search });
  }
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className="p-6">
      <p className={`eyebrow ${s.priority === 1 ? "text-state-alarm" : ""}`}>{PRIO[s.priority]}{hasAction ? " · Nokko lo hace por ti" : ""}</p>
      <h3 className="mt-2 break-words font-display text-2xl leading-tight">{s.title}</h3>
      {s.body && <p className={`mt-3 whitespace-pre-line break-words text-sm text-ink-mid ${open ? "max-h-64 overflow-y-auto" : "line-clamp-3"}`}>{s.body}</p>}
      <div className="mt-5 flex flex-wrap gap-3 text-sm" onPointerDown={stop}>
        {s.body && s.body.length > 140 && <button type="button" className="text-ink-mid underline underline-offset-4 hover:text-ink" onClick={() => setOpen((o) => !o)}>{open ? "Ver menos" : "Ver detalle"}</button>}
        <button type="button" className="text-ink-mid underline underline-offset-4 hover:text-ink" onClick={resolve}>Resolver con el agente</button>
      </div>
    </div>
  );
}
