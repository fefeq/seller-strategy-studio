// «Plays GTM»: the catalogue of plays with the state each has in this company. Rules (state, permissions, filters, words) are pure in
// src/lib/plays (tested); this panel only draws them and writes through setPlayEnabled, which re-checks role and block on the server.
import { useState } from "react";
import { PlayCard } from "./play-card";
import { usePlayStates } from "./use-play-states";
import { usePlayToggle } from "./use-play-toggle";
import { Pick } from "@/components/fields";
import { Empty } from "@/components/page";
import { CATALOG, MOTIONS, PHASES, STATUSES } from "@/lib/plays/catalog";
import { describePlay } from "@/lib/plays/status";
import {
  MOTION_LABEL,
  PHASE_WORD,
  STATUS_WORD,
  filterPlays,
  type PlayFilter,
} from "@/lib/plays/view";

export function PlaysPanel({ roles }: { roles: string[] }) {
  const { data: rows } = usePlayStates();
  const { busy, flip } = usePlayToggle();
  const [filter, setFilter] = useState<PlayFilter>({ motion: "all", status: "all", phase: "all" });
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map((rows ?? []).map((r) => [r.play_id, r]));
  const plays = filterPlays(
    CATALOG.map((p) => describePlay(p, byId.get(p.id))),
    filter,
  );
  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Un play es una jugada con su disparador, sus puertas de descarte explicadas y su salida:
        siempre una sugerencia, una tarea o un borrador, nunca un envío automático. No son los
        guiones de venta de Conocimiento. Aquí ves cuáles tiene Nokko, cuáles están activados en tu
        empresa y qué falta para el resto.
      </p>
      <div className="mb-6 grid max-w-3xl gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="eyebrow mb-1 block">Motion</span>
          <Pick
            aria-label="Filtrar por motion"
            value={filter.motion}
            onChange={(v) => setFilter({ ...filter, motion: v as PlayFilter["motion"] })}
            options={{
              all: "Todos",
              ...Object.fromEntries(MOTIONS.map((m) => [m, MOTION_LABEL[m]])),
            }}
          />
        </label>
        <label className="text-sm">
          <span className="eyebrow mb-1 block">Estado</span>
          <Pick
            aria-label="Filtrar por estado"
            value={filter.status}
            onChange={(v) => setFilter({ ...filter, status: v as PlayFilter["status"] })}
            options={{
              all: "Todos",
              ...Object.fromEntries(STATUSES.map((s) => [s, STATUS_WORD[s]])),
            }}
          />
        </label>
        <label className="text-sm">
          <span className="eyebrow mb-1 block">Fase</span>
          <Pick
            aria-label="Filtrar por fase"
            value={filter.phase ?? "all"}
            onChange={(v) => setFilter({ ...filter, phase: v as PlayFilter["phase"] })}
            options={{
              all: "Todas",
              ...Object.fromEntries(PHASES.map((f) => [f, PHASE_WORD[f]])),
            }}
          />
        </label>
      </div>
      {!plays.length && <Empty>Ningún play coincide con esos filtros.</Empty>}
      <ul className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
        {plays.map((p) => (
          <PlayCard
            key={p.id}
            play={CATALOG.find((c) => c.id === p.id)!}
            described={p}
            roles={roles}
            busy={busy === p.id}
            onToggle={(enable) => flip(p.id, enable)}
            open={open === p.id}
            onToggleOpen={() => setOpen(open === p.id ? null : p.id)}
          />
        ))}
      </ul>
    </div>
  );
}
