import { z } from "zod";
import type { Db } from "@/lib/org-data";
import { controlCustomPlay, type ControlAction, type ControlPorts } from "./controls-core";
import { checkCustomControl } from "./controls";
import { checkProposal } from "./propose";
import { checkSources } from "./model";
import { runtimeServices } from "./sources.server";
import { jsonObject } from "@/lib/json";

const source = z.enum(["news", "web", "reviews_or_cases", "reviews", "competitors", "people", "company", "drive", "posthog"]);
const proposalSchema = z.object({
  name: z.string(), trigger: z.string(), window: z.object({ backDays: z.number(), forwardDays: z.number() }),
  steps: z.array(z.object({ n: z.number().int().positive(), source, question: z.string().min(1), returns: z.array(z.string()) })).min(1).max(8),
  message: z.object({ claims: z.array(z.object({ text: z.string(), step: z.number() })), built: z.string(), ask: z.string() }),
  test: z.object({ n: z.number(), k: z.number(), base: z.number() }), verifiedOnly: z.boolean(),
});

export async function saveCustomPlayControl(db: Db, userId: string, orgId: string, playId: string, action: ControlAction) {
  const { data: profile, error: pe } = await db.from("profiles").select("current_org_id").eq("id", userId).single();
  if (pe || profile.current_org_id !== orgId) throw new Error("La empresa activa ha cambiado. Actualiza la pantalla antes de guardar.");
  const [member, org] = await Promise.all([
    db.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId),
    db.from("organizations").select("archived_at").eq("id", orgId).single(),
  ]);
  if (member.error || org.error || org.data.archived_at) throw new Error("No se puede modificar esta empresa. Revisa tu acceso.");
  const roles = (member.data ?? []).map(m => m.role);
  const permission = checkCustomControl(roles, "aprobado", null, false);
  if (!permission.ok) throw new Error(permission.reason);
  return controlCustomPlay(await customPlayPorts(db, orgId, playId), roles, action, new Date().toISOString());
}

/** Ports shared by the /plays screen and the agent/MCP tools; callers verify org membership and role before using them. */
export async function customPlayPorts(db: Db, orgId: string, playId: string): Promise<ControlPorts> {
  // Privileged writes are imported only after the caller verified organization and role.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    load: async () => {
      const r = await db.from("custom_plays").select("*").eq("id", playId).eq("org_id", orgId).maybeSingle();
      if (r.error) throw new Error("No se pudo leer el play. Vuelve a intentarlo.");
      return r.data;
    },
    activationCheck: async row => {
      const [pause, drive, posthog] = await Promise.all([
        supabaseAdmin.from("job_locks").select("paused_reason").eq("name", `custom_plays:${orgId}`).maybeSingle(),
        db.from("drive_folders").select("folder_id").eq("org_id", orgId).is("account_id", null).maybeSingle(),
        db.from("posthog_connections").select("org_id").eq("org_id", orgId).maybeSingle(),
      ]);
      if (pause.error || drive.error || posthog.error) throw new Error("No se pudieron comprobar las fuentes y bloqueos. Revisa Conexiones.");
      if (pause.data?.paused_reason) throw new Error("Los plays de esta empresa tienen una pausa de seguridad. Resuelve el bloqueo antes de activar.");
      const parsed = proposalSchema.safeParse({ ...(jsonObject(row.definition) ?? {}), name: row.name, verifiedOnly: row.verified_only });
      if (!parsed.success) throw new Error("La definición del play está incompleta. Revisa sus pasos antes de activar.");
      const valid = checkProposal(parsed.data);
      if (!valid.ok) throw new Error(valid.reason);
      if (new Set(parsed.data.steps.map(s => s.n)).size !== parsed.data.steps.length) throw new Error("El play tiene pasos repetidos. Corrige la definición.");
      const sources = checkSources(parsed.data.steps.map(s => s.source), { services: runtimeServices(), driveFolder: !!drive.data, posthog: !!posthog.data });
      if (!sources.ok) throw new Error(sources.reason);
    },
    save: async (row, patch) => {
      // Compare-and-swap: a concurrent safety pause must never be overwritten by this control.
      let query = supabaseAdmin.from("custom_plays").update(patch).eq("id", playId).eq("org_id", orgId).eq("status", row.status).eq("updated_at", row.updated_at);
      query = row.execution_pause === null ? query.is("execution_pause", null) : query.eq("execution_pause", row.execution_pause);
      const r = await query.select("id").maybeSingle();
      if (r.error || !r.data) throw new Error("El play cambió mientras guardabas. Actualiza la pantalla y revisa su estado.");
    },
  };
}