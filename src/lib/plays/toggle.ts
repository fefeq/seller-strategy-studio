import { CATALOG, type Play } from "./catalog";
import { checkToggle } from "./status";
import type { ToolCtx } from "@/lib/agent/tool-kit";

// The one write of play_states, shared by the /plays screen (plays.functions.ts) and the agent tool set_play_enabled, so both answer the same:
// role and block are checked here because privileged clients (Telegram, cron) skip RLS and the database does not know the catalogue.

export function mustPlay(id: string): Play {
  const p = CATALOG.find((x) => x.id === id);
  if (!p) throw new Error(`No existe el play «${id}». Consulta los disponibles con list_plays.`);
  return p;
}

export async function togglePlay(
  c: Pick<ToolCtx, "db" | "orgId" | "userId" | "roles">,
  playId: string,
  enabled: boolean,
) {
  const play = mustPlay(playId);
  const check = checkToggle({ play, roles: c.roles, enable: enabled });
  if (!check.ok) throw new Error(check.error);
  const { error } = await c.db
    .from("play_states")
    .upsert(
      { org_id: c.orgId, play_id: play.id, enabled, updated_by: c.userId },
      { onConflict: "org_id,play_id" },
    );
  if (error) throw new Error(error.message);
  const closes = !enabled && play.detectors.length > 0;
  return {
    play_id: play.id,
    enabled,
    mensaje: `${play.title}: ${enabled ? "Activado" : "Pausado"}.${closes ? " Sus sugerencias pendientes se cerrarán en la siguiente sincronización y quedan en el historial." : ""}`,
  };
}
