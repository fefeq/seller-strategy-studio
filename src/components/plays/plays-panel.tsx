// «Plays GTM»: the catalogue of plays with the state each has in this company. Rules (state, permissions, filters, words) are pure in
// src/lib/plays (tested); this panel only draws them and writes through setPlayEnabled, which re-checks role and block on the server.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PLAY_STATES_KEY, usePlayStates } from "./use-play-states";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/fields";
import { Empty } from "@/components/page";
import { errorText } from "@/lib/errors";
import { setPlayEnabled } from "@/lib/plays.functions";
import { CATALOG, MOTIONS, STATUSES } from "@/lib/plays/catalog";
import { canTogglePlays, checkToggle, describePlay } from "@/lib/plays/status";
import {
  CHANNEL_LABEL,
  MOTION_LABEL,
  STATUS_WORD,
  filterPlays,
  type PlayFilter,
} from "@/lib/plays/view";

const date = (s: string) =>
  new Date(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

function Activity({ playId }: { playId: string }) {
  const { data: runs } = useQuery({
    queryKey: ["play-runs", playId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("play_runs")
        .select("id,outcome,gate_key,drop_reason,subject_table,subject_id,created_at")
        .eq("play_id", playId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!runs) return <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>;
  if (!runs.length)
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Aún no hay pasos ni descartes registrados para este play
      </p>
    );
  return (
    <ul className="mt-2 divide-y border-t text-sm">
      {runs.map((r) => (
        <li key={r.id} className="py-2">
          <span className="smallcaps">{r.outcome === "pass" ? "Pasa" : "Descartado"}</span> ·{" "}
          {r.subject_table} {r.subject_id.slice(0, 8)} · {date(r.created_at)}
          {r.outcome === "drop" && (
            <span className="block text-muted-foreground">
              {r.drop_reason}
              {r.gate_key ? ` (${r.gate_key})` : ""}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PlaysPanel({ roles }: { roles: string[] }) {
  const qc = useQueryClient();
  const { data: rows } = usePlayStates();
  const toggle = useServerFn(setPlayEnabled);
  const [filter, setFilter] = useState<PlayFilter>({ motion: "all", status: "all" });
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map((rows ?? []).map((r) => [r.play_id, r]));
  const plays = filterPlays(
    CATALOG.map((p) => describePlay(p, byId.get(p.id))),
    filter,
  );
  const who = canTogglePlays(roles);

  async function flip(id: string, enabled: boolean) {
    setBusy(id);
    try {
      const r = await toggle({ data: { play_id: id, enabled } });
      toast.success(r.mensaje);
      await qc.invalidateQueries({ queryKey: PLAY_STATES_KEY });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Un play es una jugada con su disparador, sus puertas de descarte explicadas y su salida:
        siempre una sugerencia, una tarea o un borrador, nunca un envío automático. No son los
        guiones de venta de Conocimiento. Aquí ves cuáles tiene Nokko, cuáles están activados en tu
        empresa y qué falta para el resto.
      </p>
      <div className="mb-6 grid max-w-xl gap-3 sm:grid-cols-2">
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
      </div>
      {!plays.length && <Empty>Ningún play coincide con esos filtros.</Empty>}
      <ul className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
        {plays.map((p) => {
          const play = CATALOG.find((c) => c.id === p.id)!;
          const wantEnable = !p.enabled;
          // The button is disabled with its reason when the role cannot, or when the play is blocked or planned and the action would be to activate it.
          const refusal = checkToggle({ play, roles, enable: wantEnable });
          return (
            <li key={p.id} className="border-t py-4">
              <p className="text-lg font-medium">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {STATUS_WORD[p.status]} · {p.motion.map((m) => MOTION_LABEL[m]).join(", ")} ·{" "}
                {p.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}
              </p>
              <p className="mt-2 smallcaps">{p.label}</p>
              <p className="mt-2 text-sm">Necesita: {p.needs.join("; ")}.</p>
              {p.reason && !p.canEnable && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.status === "bloqueado"
                    ? "No se puede activar todavía"
                    : "Todavía no se puede activar"}
                  : {p.reason}.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant={wantEnable ? "default" : "outline"}
                  disabled={!refusal.ok || busy === p.id}
                  onClick={() => flip(p.id, wantEnable)}
                >
                  {wantEnable ? "Activar" : "Pausar"}
                </Button>
                <button
                  type="button"
                  className="text-sm text-signal"
                  aria-expanded={open === p.id}
                  onClick={() => setOpen(open === p.id ? null : p.id)}
                >
                  {open === p.id ? "Ocultar actividad" : "Ver actividad"}
                </button>
              </div>
              {!refusal.ok && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {!who.ok ? who.reason : refusal.error}
                </p>
              )}
              {open === p.id && <Activity playId={p.id} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
