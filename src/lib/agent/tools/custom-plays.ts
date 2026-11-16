// NK-0171 SDD 3: propose_custom_play. The assistant proposes; Owner or Sales Leader confirms in Sugerencias;
// only then the play is checked again (pure rules, anti-copy) and saved with the privileged client (members only read).
import { z } from "zod";
import { def } from "../tool-kit";
import type { AgentTool } from "../tool-kit";
import { checkProposal, type Proposal } from "@/lib/plays/custom/propose";
import { newCustomPlayId } from "@/lib/plays/custom/model";
import type { Json } from "@/integrations/supabase/types";
import { controlCustomPlay } from "@/lib/plays/custom/controls-core";
import { isLeader, ok } from "../tool-kit";

/** Safe projection of a custom play for assistants: name, state and recorded test only (no definition text, no costs). */
export function customPlayView(r: {
  id: string;
  key: string;
  name: string;
  status: string;
  execution_pause: string | null;
  first_activated_at: string | null;
  test_sample: number | null;
  test_successes: number | null;
}) {
  return {
    id: r.id,
    key: r.key,
    nombre: r.name,
    estado: r.status,
    pausa_seguridad: !!r.execution_pause,
    activado_alguna_vez: !!r.first_activated_at,
    prueba:
      r.test_sample == null ? null : { muestra: r.test_sample, exitos: r.test_successes ?? 0 },
  };
}

const controlTool = (name: string, enabled: boolean, description: string) =>
  def({
    name,
    kind: "write",
    roles: ["owner", "sales_leader"],
    description,
    input: z.object({ play_id: z.string().uuid().describe("id del play (list_custom_plays)") }),
    summarize: () => (enabled ? "Activar un play a medida" : "Pausar un play a medida"),
    run: async (c, a) => {
      if (!isLeader(c.roles))
        throw new Error("Solo el Owner o un Sales Leader pueden activar o pausar plays.");
      const { customPlayPorts } = await import("@/lib/plays/custom/controls.server");
      return controlCustomPlay(
        await customPlayPorts(c.db, c.orgId, a.play_id),
        c.roles,
        { kind: "toggle", enabled },
        new Date().toISOString(),
      );
    },
  });

const SOURCES = [
  "news",
  "web",
  "reviews_or_cases",
  "reviews",
  "competitors",
  "people",
  "company",
  "drive",
  "posthog",
] as const;

const input = z.object({
  name: z.string().min(1).max(200).describe("Nombre del play, con palabras propias"),
  trigger: z.string().min(1).describe("Evento público verificable que lo dispara"),
  back_days: z.number().int().positive().describe("Días hacia atrás que vale la fecha del evento"),
  forward_days: z.number().int().min(0).describe("Días hacia delante (eventos anunciados)"),
  steps: z
    .array(
      z.object({
        n: z.number().int().positive(),
        source: z.enum(SOURCES),
        question: z.string().min(1),
        returns: z.array(z.string()),
      }),
    )
    .min(1),
  claims: z
    .array(z.object({ text: z.string().min(1), step: z.number().int().positive() }))
    .min(1)
    .describe("Cada hecho del mensaje con el paso que lo prueba"),
  built: z.string().min(1).describe("Lo que se ha preparado para la cuenta"),
  ask: z.string().min(1).describe("Petición pequeña"),
  sample: z.number().int().positive().describe("Contactos de la prueba"),
  successes: z.number().int().positive().describe("Éxitos esperados (≤ muestra)"),
  verified_only: z.boolean().default(false).describe("Solo contactos con email verificado"),
});

export const toProposal = (a: z.infer<typeof input>): Proposal => ({
  name: a.name,
  trigger: a.trigger,
  window: { backDays: a.back_days, forwardDays: a.forward_days },
  steps: a.steps,
  message: { claims: a.claims, built: a.built, ask: a.ask },
  test: { n: a.sample, k: a.successes, base: a.sample },
  verifiedOnly: a.verified_only,
});

export const CUSTOM_PLAY_TOOLS: AgentTool[] = [
  def({
    name: "list_custom_plays",
    kind: "read",
    description:
      "Lista los plays a medida de la empresa con su estado (activo, pausado, archivado), si tienen pausa de seguridad, últimas ejecuciones y el resultado de prueba registrado. No ejecuta nada.",
    input: z.object({}),
    run: async (c) => {
      const plays = ok(
        await c.db
          .from("custom_plays")
          .select(
            "id,key,name,status,execution_pause,first_activated_at,test_sample,test_successes,org_id",
          )
          .eq("org_id", c.orgId)
          .order("created_at"),
      );
      const mine = (plays ?? []).filter((p) => p.org_id === c.orgId);
      const runs = mine.length
        ? (ok(
            await c.db
              .from("custom_play_runs")
              .select("play_id,status,created_at")
              .eq("org_id", c.orgId)
              .in(
                "play_id",
                mine.map((p) => p.id),
              )
              .order("created_at", { ascending: false })
              .limit(50),
          ) ?? [])
        : [];
      return mine.map((p) => {
        const last = runs.find((r) => r.play_id === p.id);
        return {
          ...customPlayView(p),
          ultima_ejecucion: last ? { estado: last.status, fecha: last.created_at } : null,
        };
      });
    },
  }),
  controlTool(
    "activate_custom_play",
    true,
    "Activa un play a medida para las próximas búsquedas automáticas, tras comprobar fuentes y bloqueos como la pantalla Plays. Nunca quita una pausa de seguridad ni llama a proveedores.",
  ),
  controlTool(
    "pause_custom_play",
    false,
    "Pausa un play a medida. Conserva sus pruebas y resultados.",
  ),
  def({
    name: "propose_custom_play",
    kind: "write",
    roles: ["owner", "sales_leader"],
    description:
      "Propone un play «Creado para tu empresa»: disparador público con fecha, ventana de frescura, pasos de evidencia con fuente, mensaje donde cada hecho cita un paso, y prueba (muestra y éxitos). Se guarda solo si el Owner o un Sales Leader lo confirma y pasa las reglas (incluida la de no copiar plays de otras empresas). No lo ejecuta.",
    input,
    summarize: (a) => `Guardar el play a medida «${a.name}»`,
    run: async (c, a) => {
      const p = toProposal(a);
      const r = checkProposal(p);
      if (!r.ok) throw new Error(r.reason);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const key = newCustomPlayId(crypto.randomUUID());
      const { error } = await supabaseAdmin.from("custom_plays").insert({
        org_id: c.orgId,
        key,
        name: p.name,
        verified_only: p.verifiedOnly,
        definition: {
          trigger: p.trigger,
          window: p.window,
          steps: p.steps,
          message: p.message,
          test: p.test,
          origin: "a_medida",
          created_by: c.userId,
        } as unknown as Json,
      });
      if (error) throw new Error(error.message);
      // The proposal's AI cost is not measured yet: stored as 0 with provider «ai:sin_dato», never estimated.
      await supabaseAdmin.from("custom_play_costs").insert({
        org_id: c.orgId,
        play_key: key,
        provider: "ai:sin_dato",
        amount: 0,
        cost_kind: "ai_sin_dato",
      });
      return { key, mensaje: "Play guardado como «Creado para tu empresa». Aún no se ejecuta." };
    },
  }),
];
