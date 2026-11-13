// «Equipos de plays»: the six teams of plays with their steps in order and what is not available. The rules (order, reasons, shared
// state, words) are pure in src/lib/plays/teams.ts (tested); a play in two teams is one row of play states, so it shows the same in both.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAgent } from "@/components/agent";
import { PlayCard } from "./play-card";
import { usePlayStates } from "./use-play-states";
import { usePlayToggle } from "./use-play-toggle";
import { CATALOG } from "@/lib/plays/catalog";
import { canTogglePlays } from "@/lib/plays/status";
import {
  PLAY_TEAMS,
  TEAMS_INTRO,
  sharedWord,
  stepWord,
  summaryWord,
  teamPlan,
  unavailableWord,
} from "@/lib/plays/teams";

export function PlayTeamsPanel({ roles }: { roles: string[] }) {
  const { data: rows } = usePlayStates();
  const { busy, flip } = usePlayToggle();
  const { open: openAgent } = useAgent();
  // Same rule as activating plays: the diagnosis ends in suggestions and rules only the Owner or Sales Leader can save.
  const canDiagnose = canTogglePlays(roles).ok;
  // One activity open at a time, as in the catalogue; keyed by team and play because a play can be in two teams.
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map((rows ?? []).map((r) => [r.play_id, r]));

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{TEAMS_INTRO}</p>
      {canDiagnose && (
        <Button
          className="mb-6 max-w-full whitespace-normal"
          onClick={() =>
            openAgent({
              fresh: true,
              mode: "chat",
              workflowId: "plays_diagnosis",
              prompt: "Quiero hacer el diagnóstico de plays.",
            })
          }
        >
          Hacer el diagnóstico de plays
        </Button>
      )}
      <div className="space-y-10">
        {PLAY_TEAMS.map((team) => {
          const plan = teamPlan(team, CATALOG, byId);
          const card = (
            p: (typeof plan.steps)[number] | (typeof plan.unavailable)[number],
            step?: number,
            reason?: string,
          ) => {
            const key = `${team.id}:${p.id}`;
            return (
              <PlayCard
                key={key}
                play={CATALOG.find((c) => c.id === p.id)!}
                described={p}
                roles={roles}
                busy={busy === p.id}
                onToggle={(enable) => flip(p.id, enable)}
                open={open === key}
                onToggleOpen={() => setOpen(open === key ? null : key)}
                lead={step ? <p className="smallcaps">{stepWord(step)}</p> : undefined}
                note={
                  <>
                    {reason && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {unavailableWord(reason)}
                      </p>
                    )}
                    {p.sharedWith.length > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {sharedWord(p.sharedWith)}
                      </p>
                    )}
                  </>
                }
              />
            );
          };
          return (
            <section key={team.id} aria-labelledby={`team-${team.id}`}>
              <h2 id={`team-${team.id}`} className="text-xl font-medium">
                {plan.title}
              </h2>
              <p className="mt-1 text-sm">{plan.task}</p>
              <p className="mt-1 text-sm text-muted-foreground">{summaryWord(plan.summary)}</p>
              <ul className="mt-3 grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
                {plan.steps.map((p) => card(p, p.n))}
                {plan.unavailable.map((p) => card(p, undefined, p.reason))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
