import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markNudgeSeen, nudgeSeen, useSetupGuide, type OfferScope } from "@/hooks/use-setup-guide";
import { STATE_LABEL, canCompleteStep, dayAfter, formatDay, stepsFor, whoCanText, type NextMessage } from "@/lib/setup-guide";
import { linkTarget, setupStepLink } from "@/lib/proactive/resolve";

/** The screen where a step is edited, as router props (strategy tab, metrics, accounts or deals). */
const stepTarget = (id: string) => linkTarget(setupStepLink(id))!;

/** «Más tarde»: the person picks the day the step comes back. */
export function SnoozeForm({ stepId, onDone }: { stepId: string; onDone: () => void }) {
  const { snooze } = useSetupGuide();
  const [value, setValue] = useState(() => dayAfter(new Date(), 3));
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const ok = await snooze(stepId, value); setBusy(false); if (ok) onDone(); }}>
      <label className="text-xs text-muted-foreground">Avísame de nuevo el
        <Input type="date" className="mt-1 h-9 w-44" min={dayAfter(new Date(), 1)} value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <Button type="submit" size="sm" disabled={busy || !value}>Posponer</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancelar</Button>
    </form>
  );
}

/** The next-step message: what to do, why it matters, «Empezar» and «Más tarde». Same text in pantalla and in the agent (setup-guide.nextMessage). */
export function NextStepMessage({ msg, onStart, onDismiss }: { msg: NextMessage; onStart?: (stepId: string) => void; onDismiss?: () => void }) {
  const [later, setLater] = useState(false);
  const start = msg.start && msg.stepId ? (
    onStart
      ? <Button size="sm" onClick={() => onStart(msg.stepId!)}>{msg.start}</Button>
      : <Button size="sm" asChild><Link to={stepTarget(msg.stepId).to} search={stepTarget(msg.stepId).search} onClick={onDismiss}>{msg.start}</Link></Button>
  ) : null;
  return (
    <div className="text-sm">
      <p className="font-medium">{msg.title}</p>
      <p className="mt-1 text-muted-foreground">{msg.why}</p>
      {(start || (msg.later && msg.stepId)) && !later && (
        <div className="mt-3 flex flex-wrap gap-2">
          {start}
          {msg.later && msg.stepId && <Button size="sm" variant="outline" onClick={() => setLater(true)}>{msg.later}</Button>}
        </div>
      )}
      {later && msg.stepId && <SnoozeForm stepId={msg.stepId} onDone={() => setLater(false)} />}
    </div>
  );
}

/**
 * The guide's offer in Inicio and in the agent (CA-6, CA-9, CA-10): the next step, or «Hecho: …» plus the next step right after finishing one.
 * `onlyWhenDue` shows it only after a day without activity (Inicio); the agent always offers it as the first suggestion.
 */
export function GuideOffer({ scope, onlyWhenDue, onStart, orgId, wrap }: { scope: OfferScope; onlyWhenDue?: boolean; onStart?: (stepId: string) => void; orgId?: string; wrap?: (children: ReactNode) => ReactNode }) {
  const g = useSetupGuide({ activity: !!onlyWhenDue }); // only the nudge in Inicio needs the activity of the data
  const [closed, setClosed] = useState(() => nudgeSeen(orgId, scope));
  if (!g.guide || !g.message || (!g.message.stepId && !g.justDone)) return null;
  if (onlyWhenDue && !g.nudge && !g.justDone) return null;
  if (closed && !g.justDone) return null;
  const close = () => { markNudgeSeen(orgId, scope); setClosed(true); g.clearJustDone(); };
  const body = (
    <div>
      <NextStepMessage msg={g.message} onStart={onStart ? (id) => { close(); onStart(id); } : undefined} onDismiss={close} />
      <button className="mt-2 text-xs text-muted-foreground hover:text-foreground" onClick={close}>Cerrar aviso</button>
    </div>
  );
  return wrap ? <>{wrap(body)}</> : body;
}

/** Progress by step with a word for each state (CA-4); steps the person can't complete say who can (CA-8). */
export function GuideProgress() {
  const g = useSetupGuide();
  if (!g.guide) return null;
  const steps = stepsFor(g.guide, g.role);
  return (
    <>
      {g.stale && <p className="mt-3 text-xs text-muted-foreground">No he podido actualizar tu progreso. Muestro el último estado conocido y lo reintento.</p>}
      <ul className="mt-4 space-y-3 text-sm">
        {steps.map((s) => (
          <li key={s.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className={s.state === "done" ? "text-muted-foreground line-through" : ""}>{s.label}</p>
              <span className={`shrink-0 text-xs ${s.state === "done" ? "text-success" : "text-muted-foreground"}`}>{STATE_LABEL[s.state]}</span>
            </div>
            {s.state !== "done" && <p className="text-xs text-muted-foreground">Desbloquea: {s.unlocks}</p>}
            {s.state === "snoozed" && (
              <p className="text-xs text-muted-foreground">Te aviso de nuevo el {s.snoozedUntil ? formatDay(s.snoozedUntil) : ""}. {canCompleteStep(s.id, g.role) && <button className="underline" onClick={() => g.unsnooze(s.id)}>Quitar posposición</button>}</p>
            )}
            {s.state !== "done" && !canCompleteStep(s.id, g.role) && <p className="text-xs text-muted-foreground">{whoCanText(s.id, g.members)}</p>}
            {s.state === "pending" && canCompleteStep(s.id, g.role) && (
              <Link to={stepTarget(s.id).to} search={stepTarget(s.id).search} className="text-xs underline">Ir a este paso</Link>
            )}
          </li>
        ))}
      </ul>
      {/* CA-2: nothing left to do — what Nokko does by itself and what is left for the person. */}
      {g.message && !g.message.stepId && g.guide.complete && <div className="mt-5 border-t border-hairline pt-4"><NextStepMessage msg={g.message} /></div>}
    </>
  );
}
