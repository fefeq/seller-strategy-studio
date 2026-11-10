// One play as the Plays GTM screens draw it: state, phase, needs, the activate or pause button and the activity. Shared by the catalogue
// and the teams. The `open` state of the activity stays in each panel (one open at a time) and arrives as props.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Play } from "@/lib/plays/catalog";
import { canTogglePlays, checkToggle, type describePlay } from "@/lib/plays/status";
import { CHANNEL_LABEL, MOTION_LABEL, STATUS_WORD } from "@/lib/plays/view";

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

export function PlayCard({
  play,
  described: p,
  roles,
  busy,
  onToggle,
  open,
  onToggleOpen,
}: {
  play: Play;
  described: ReturnType<typeof describePlay>;
  roles: string[];
  busy: boolean;
  onToggle: (enable: boolean) => void;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const who = canTogglePlays(roles);
  const wantEnable = !p.enabled;
  // The button is disabled with its reason when the role cannot, or when the play is blocked or planned and the action would be to activate it.
  const refusal = checkToggle({ play, roles, enable: wantEnable });
  return (
    <li className="border-t py-4">
      <p className="text-lg font-medium">{p.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {STATUS_WORD[p.status]} · {p.motion.map((m) => MOTION_LABEL[m]).join(", ")} ·{" "}
        {p.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}
      </p>
      <p className="mt-2 smallcaps">{p.label}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {p.phaseLabel} · {p.approvalLabel}
      </p>
      <p className="mt-2 text-sm">Necesita: {p.needs.join("; ")}.</p>
      {p.reason && !p.canEnable && (
        <p className="mt-1 text-sm text-muted-foreground">
          {p.status === "bloqueado" ? "No se puede activar todavía" : "Todavía no se puede activar"}
          : {p.reason}.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={wantEnable ? "default" : "outline"}
          disabled={!refusal.ok || busy}
          onClick={() => onToggle(wantEnable)}
        >
          {wantEnable ? "Activar" : "Pausar"}
        </Button>
        <button
          type="button"
          className="text-sm text-signal"
          aria-expanded={open}
          onClick={onToggleOpen}
        >
          {open ? "Ocultar actividad" : "Ver actividad"}
        </button>
      </div>
      {!refusal.ok && (
        <p className="mt-2 text-sm text-muted-foreground">{!who.ok ? who.reason : refusal.error}</p>
      )}
      {open && <Activity playId={p.id} />}
    </li>
  );
}
