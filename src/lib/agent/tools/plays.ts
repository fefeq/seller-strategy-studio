// Plays GTM: list_plays, get_play and list_play_teams (read, any member) and set_play_enabled (write, owner and sales_leader). Part of the single registry in ../tools.ts.
// They reuse the pure rules of src/lib/plays (the screen uses the same ones) and never run a play: they only read the catalogue and the company's play_states.
import { z } from "zod";
import { def } from "../tool-kit";
import type { AgentTool, ToolCtx } from "../tool-kit";
import { CATALOG, MOTIONS, STATUSES } from "@/lib/plays/catalog";
import { describePlay } from "@/lib/plays/status";
import { PLAY_TEAMS, teamPlan } from "@/lib/plays/teams";
import { mustPlay, togglePlay } from "@/lib/plays/toggle";

/** The company's play_states rows. A failed read (say, the table is not migrated yet) is treated as no rows: every play shows its default. */
async function stateRows(c: ToolCtx) {
  const { data, error } = await c.db
    .from("play_states")
    .select("play_id,enabled")
    .eq("org_id", c.orgId);
  return new Map((error ? [] : (data ?? [])).map((r) => [r.play_id, r]));
}

/**
 * Same read as stateRows, but a failed read is reported (`ok: false`) instead of being treated as no rows. A write must not read a
 * failure as «every play at its default» (it would call a paused play active): diagnose_play_teams and save_play_plan use this one.
 */
export async function playStateRows(c: ToolCtx) {
  const { data, error } = await c.db
    .from("play_states")
    .select("play_id,enabled")
    .eq("org_id", c.orgId);
  return {
    ok: !error,
    rows: new Map((error ? [] : (data ?? [])).map((r) => [r.play_id, r])),
  };
}

export const PLAY_TOOLS: AgentTool[] = [
  def({
    name: "list_plays",
    kind: "read",
    description:
      "Lista los 28 Plays GTM (jugadas con disparador, puertas y salida; no son los guiones de venta) con su estado en esta empresa: Activado, Pausado, Parcial, Planificado o Bloqueado con el motivo, qué datos necesita cada uno, qué reglas ya existentes le pertenecen, su fase (Fundación, Captura, Generación, Orquestación) y quién decide (NOKKO prepara y tú decides, o NOKKO redacta y tú apruebas). Filtra por motion o por estado. Solo lee.",
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
      "Devuelve un play del catálogo con su estado en esta empresa: si está activado, si se puede activar, qué lo bloquea, qué datos necesita, su fase y quién decide. Solo lee.",
    input: z.object({
      play_id: z.string().min(1).describe("Id del play (list_plays), por ejemplo crm-hygiene"),
    }),
    run: async (c, a) => describePlay(mustPlay(a.play_id), (await stateRows(c)).get(a.play_id)),
  }),
  def({
    name: "list_play_teams",
    kind: "read",
    description:
      "Lista los seis equipos de plays. Un equipo de plays agrupa plays por tarea (por ejemplo, reuniones o reactivar perdidos) y los ordena como conviene activarlos: `steps` son los plays que se pueden recomendar, numerados, y `unavailable` los que todavía no, con el motivo. Un play puede estar en varios equipos y se activa una vez: su estado en esta empresa es el mismo en todos. Para activar o pausar un play usa set_play_enabled. Solo lee.",
    input: z.object({}),
    run: async (c) => {
      const rows = await stateRows(c);
      return { teams: PLAY_TEAMS.map((t) => teamPlan(t, CATALOG, rows)) };
    },
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
    run: (c, a) => togglePlay(c, a.play_id, a.enabled),
  }),
];
