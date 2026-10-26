// Connections from the screens (SDD connections-bring-your-own-account, U-1/U-2). Any member reads which providers
// NOKKO covers; only the Owner connects, changes or disconnects (the role is re-checked inside the core).
// No provider checker or credential store is wired yet: Google OAuth and per-company keys wait for a decision.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROVIDERS } from "@/lib/connections";
import type { Db } from "@/lib/org-data";

async function currentOrg(supabase: Db, userId: string): Promise<{ orgId: string; role: string }> {
  const { data: profile } = await supabase.from("profiles").select("current_org_id").eq("id", userId).single();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new Error("Selecciona una empresa");
  const { data: member } = await supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  if (!member) throw new Error("No eres miembro de esta empresa");
  return { orgId, role: member.role };
}

/** Provider ids whose NOKKO account is configured in this environment (server variables are not visible to the browser). */
export const nokkoProvidedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ provided: PROVIDERS.filter((p) => p.nokkoEnv.length > 0 && p.nokkoEnv.every((k) => !!process.env[k])).map((p) => p.id) }));

async function deps() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { dbStore } = await import("@/lib/connections-core");
  // checkers and credential store: intentionally empty until the Google client and the sealed store are decided.
  return { db: supabaseAdmin, deps: { store: dbStore(supabaseAdmin), checkers: {} } };
}

export const connectAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: string; credential: string; mode: "check" | "save"; confirmShared?: boolean }) => {
    if (typeof d?.provider !== "string" || typeof d?.credential !== "string") throw new Error("Faltan datos de la conexión.");
    return { provider: d.provider, credential: d.credential, mode: d.mode === "save" ? ("save" as const) : ("check" as const), confirmShared: !!d.confirmShared };
  })
  .handler(async ({ data, context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    const { connectAccount } = await import("@/lib/connections-core");
    return connectAccount({ orgId, userId: context.userId, role, ...data }, (await deps()).deps);
  });

export const disconnectAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: string }) => {
    if (typeof d?.provider !== "string") throw new Error("Falta la conexión.");
    return { provider: d.provider };
  })
  .handler(async ({ data, context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    const { disconnectAccount } = await import("@/lib/connections-core");
    return disconnectAccount({ orgId, userId: context.userId, role, ...data }, (await deps()).deps);
  });
