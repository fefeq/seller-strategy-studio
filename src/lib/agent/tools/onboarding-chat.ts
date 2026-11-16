// E3: onboarding driven from the chat, the same path as /onboarding. From the company web to the strategy approved block by block:
// start_onboarding_read enqueues the same onboarding_read job the Fuentes step starts; list_onboarding_blocks shows what each block
// would save; approve_onboarding_block saves one block with the same items the Bloques step applies (protectManual keeps manual data)
// and records it in block_status, so the screen and the chat stay in sync. Both writes go through the usual confirmation card.
import { z } from "zod";
import { def, type AgentTool, type ToolCtx } from "../tool-kit";
import {
  BLOCKS,
  BLOCK_LABEL,
  blockOf,
  protectManual,
  readingCost,
  type BlockId,
} from "@/lib/onboarding";
import { proposalItems, type SetupProposal } from "@/lib/setup-extraction";
import { loadSetupData } from "@/lib/org-data";
import { jsonObject } from "@/lib/json";
import { undoRefFor, type UndoRef } from "@/lib/setup-undo";
import type { Json } from "@/integrations/supabase/types";

const BLOCK_IDS = BLOCKS.map((b) => b.id) as [BlockId, ...BlockId[]];

async function session(c: ToolCtx) {
  const { data, error } = await c.db
    .from("onboarding_sessions")
    .select("proposal,block_status,step")
    .eq("org_id", c.orgId)
    .eq("user_id", c.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function itemsByBlock(c: ToolCtx) {
  const s = await session(c);
  if (!s?.proposal)
    throw new Error(
      "Aún no hay propuesta: empieza con start_onboarding_read (la web de tu empresa) o en /onboarding.",
    );
  const [segs, setup] = await Promise.all([
    c.db.from("segments").select("id,name").eq("org_id", c.orgId),
    loadSetupData(c.db, c.orgId),
  ]);
  const all = proposalItems(s.proposal as unknown as SetupProposal, segs.data ?? [], c.currency);
  const { items, kept } = protectManual(all, setup);
  return { items, kept, status: jsonObject(s.block_status) ?? {} };
}

export const ONBOARDING_CHAT_TOOLS: AgentTool[] = [
  def({
    name: "start_onboarding_read",
    kind: "write",
    description:
      "Empieza el onboarding desde el chat: Nokko lee la web de la empresa (y el texto que el usuario dé, nunca claves) y prepara la propuesta de estrategia por bloques. Es la misma lectura del paso Fuentes de /onboarding; corre en segundo plano y avisa al terminar. Profundidad: express, standard o deep (deep añade competidores).",
    input: z.object({
      url: z.string().trim().url().max(500).describe("Web de la empresa, https://…"),
      depth: z.enum(["express", "standard", "deep"]).default("standard"),
      text: z
        .string()
        .max(8000)
        .optional()
        .describe("Contexto extra que el usuario escribió (sin claves ni contraseñas)"),
    }),
    summarize: (a) => {
      const cost = readingCost(a.depth, true);
      return `Leer ${a.url} (${a.depth}) para preparar la estrategia por bloques · coste estimado ${cost ? `≈ ${cost} USD en fuentes de pago` : "sin dato"}`;
    },
    run: async (c, a) => {
      // Same job row the Fuentes step creates. The screens' enqueue() reads the request host (server-only import that the
      // client graph of this registry cannot carry), so the chat path runs the job in this request, as enqueue does without Inngest.
      const input = { depth: a.depth, url: a.url, text: a.text ?? "", files: [], sources: [] };
      const { data: job, error: jobErr } = await c.db
        .from("background_jobs")
        .insert({
          kind: "onboarding_read",
          input: input as unknown as Json,
          label: "Nokko lee tus fuentes",
          org_id: c.orgId,
          user_id: c.userId,
        })
        .select("id")
        .single();
      if (jobErr) throw new Error(jobErr.message);
      const jobId = job.id;
      const { error } = await c.db.from("onboarding_sessions").upsert(
        {
          org_id: c.orgId,
          user_id: c.userId,
          depth: a.depth,
          step: "reading",
          read_job_id: jobId,
          sources: [`Web · ${a.url}`] as unknown as Json,
        },
        { onConflict: "org_id,user_id" },
      );
      if (error) throw new Error(error.message);
      const [{ supabaseAdmin }, { runBackgroundJob }] = await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("@/lib/inngest/tasks.server"),
      ]);
      await runBackgroundJob(supabaseAdmin, jobId).catch(() => undefined);
      return {
        jobId,
        mensaje:
          "Estoy leyendo tus fuentes. Te aviso al terminar; después repasamos los bloques uno a uno (también puedes verlo en /onboarding).",
      };
    },
  }),
  def({
    name: "list_onboarding_blocks",
    kind: "read",
    description:
      "Solo lee. Los bloques de la propuesta de onboarding de la persona (Empresa, ICP, Segmentos, Posicionamiento, Mensajes, Objetivos): qué guardaría cada uno y si ya está aprobado. Úsalo para repasar bloque a bloque antes de approve_onboarding_block.",
    input: z.object({}),
    run: async (c) => {
      const { items, kept, status } = await itemsByBlock(c);
      return {
        bloques: BLOCKS.map((b) => ({
          bloque: b.id,
          nombre: BLOCK_LABEL[b.id],
          aprobado: !!status[b.id],
          guardaria: items
            .filter((i) => blockOf(i) === b.id)
            .map((i) => ({ clave: i.key, que: i.label })),
        })).filter((b) => b.aprobado || b.guardaria.length),
        se_respeta_lo_escrito_a_mano: kept,
        enlace: "/onboarding",
      };
    },
  }),
  def({
    name: "approve_onboarding_block",
    kind: "write",
    description:
      "Aprueba y guarda un bloque de la propuesta de onboarding (igual que «Aprobar» en /onboarding). Se puede excluir elementos por su clave. Nunca gasta saldo; lo escrito a mano no se sobrescribe.",
    input: z.object({
      block: z.enum(BLOCK_IDS),
      exclude: z
        .array(z.string().max(120))
        .max(40)
        .optional()
        .describe("Claves de list_onboarding_blocks que NO se guardan"),
    }),
    summarize: (a) =>
      `Aprobar el bloque «${BLOCK_LABEL[a.block]}» del onboarding${a.exclude?.length ? ` sin ${a.exclude.length} elemento(s)` : ""}`,
    run: async (c, a) => {
      const { items, status } = await itemsByBlock(c);
      if (status[a.block]) return { mensaje: `«${BLOCK_LABEL[a.block]}» ya estaba aprobado.` };
      const skip = new Set(a.exclude ?? []);
      const chosen = items.filter((i) => blockOf(i) === a.block && !skip.has(i.key));
      const { executeTool } = await import("../tools");
      const { SPEND_TOOLS } = await import("../spend-confirm");
      let saved = 0;
      const undo: UndoRef[] = [];
      const errors: string[] = [];
      for (const it of chosen) {
        if (it.tool in SPEND_TOOLS) {
          errors.push(`${it.label}: gasta saldo`);
          continue;
        }
        try {
          const r = await executeTool(c, it.tool, it.args);
          saved++;
          const u = undoRefFor(it.tool, it.args, r);
          if (u) undo.push(u);
        } catch (e) {
          errors.push(`${it.label}: ${(e as Error).message}`);
        }
      }
      const next = {
        ...status,
        [a.block]: { status: "approved", at: new Date().toISOString(), undo },
      };
      const { error } = await c.db
        .from("onboarding_sessions")
        .update({ block_status: next as unknown as Json })
        .eq("org_id", c.orgId)
        .eq("user_id", c.userId);
      if (error) throw new Error(error.message);
      return {
        guardados: saved,
        errores: errors.slice(0, 5),
        mensaje: errors.length
          ? `${saved} guardados, ${errors.length} con error.`
          : `«${BLOCK_LABEL[a.block]}» aprobado.`,
      };
    },
  }),
];
