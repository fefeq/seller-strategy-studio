// Plays GTM: list_plays and get_play (read, any member) and set_play_enabled (write, owner and sales_leader). Part of the single registry in ../tools.ts.
// They reuse the pure rules of src/lib/plays (the screen uses the same ones) and never run a play: they only read the catalogue and the company's play_states.
import { z } from "zod";
import { def, ok } from "../tool-kit";
import type { AgentTool, ToolCtx } from "../tool-kit";
import { CATALOG, MOTIONS, STATUSES, type Play } from "@/lib/plays/catalog";
import { checkToggle, describePlay } from "@/lib/plays/status";

/** The company's play_states rows. A failed read (say, the table is not migrated yet) is treated as no rows: every play shows its default. */
async function stateRows(c: ToolCtx) {
  const { data, error } = await c.db
    .from("play_states")
    .select("play_id,enabled")
    .eq("org_id", c.orgId);
  return new Map((error ? [] : (data ?? [])).map((r) => [r.play_id, r]));
}

function mustPlay(id: string): Play {
  const p = CATALOG.find((x) => x.id === id);
  if (!p) throw new Error(`No existe el play «${id}». Consulta los disponibles con list_plays.`);
  return p;
}

export const PLAY_TOOLS: AgentTool[] = [
  def({
    name: "list_plays",
    kind: "read",
    description:
      "Lista los 28 Plays GTM (jugadas con disparador, puertas y salida; no son los guiones de venta) con su estado en esta empresa: Activado, Pausado, Parcial, Planificado o Bloqueado con el motivo, qué datos necesita cada uno y qué reglas ya existentes le pertenecen. Filtra por motion o por estado. Solo lee.",
    input: z.object({
      motion: z.enum(MOTIONS).optional().describe("Solo los plays de este motion"),
      status: z.enum(STATUSES).optional().describe("Solo los plays con este estado del catálogo"),
    }),
    run: async (c, a) => {
      const rows = await stateRows(c);
      const plays = CATALOG.filter(
        (p) => (!a.motion || p.motion.includes(a.motion)) && (!a.status || p.status === a.status),
      ).map((p) => describePlay(p, rows.get(p.id)));
      return { total: CATALOG.length, plays };
    },
  }),
  def({
    name: "get_play",
    kind: "read",
    description:
      "Devuelve un play del catálogo con su estado en esta empresa: si está activado, si se puede activar, qué lo bloquea y qué datos necesita. Solo lee.",
    input: z.object({
      play_id: z.string().min(1).describe("Id del play (list_plays), por ejemplo crm-hygiene"),
    }),
    run: async (c, a) => describePlay(mustPlay(a.play_id), (await stateRows(c)).get(a.play_id)),
  }),
  def({
    name: "set_play_enabled",
    kind: "write",
    roles: ["owner", "sales_leader"],
    description:
      "Activa o pausa un play en esta empresa. Un play bloqueado o planificado no se puede activar. Pausar un play que ya ejecuta reglas cierra sus sugerencias pendientes en la siguiente sincronización.",
    input: z.object({
      play_id: z.string().min(1).describe("Id del play (list_plays)"),
      enabled: z.boolean().describe("true = activar; false = pausar"),
    }),
    summarize: (a) =>
      `${a.enabled ? "Activar" : "Pausar"} el play «${CATALOG.find((p) => p.id === a.play_id)?.title ?? a.play_id}»`,
    run: async (c, a) => {
      const play = mustPlay(a.play_id);
      // The same rule as the screen: role and block are checked here too, because privileged clients (Telegram, cron) skip RLS.
      const check = checkToggle({ play, roles: c.roles, enable: a.enabled });
      if (!check.ok) throw new Error(check.error);
      ok(
        await c.db
          .from("play_states")
          .upsert(
            { org_id: c.orgId, play_id: play.id, enabled: a.enabled, updated_by: c.userId },
            { onConflict: "org_id,play_id" },
          ),
      );
      const closes = !a.enabled && play.detectors.length > 0;
      return {
        play_id: play.id,
        enabled: a.enabled,
        mensaje: `${play.title}: ${a.enabled ? "Activado" : "Pausado"}.${closes ? " Sus sugerencias pendientes se cerrarán en la siguiente sincronización y quedan en el historial." : ""}`,
      };
    },
  }),
];
