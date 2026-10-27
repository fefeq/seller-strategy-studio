// A company's own Google Drive from Conexiones. Every member reads the state; only the Owner connects,
// changes or disconnects. The token never comes back to the browser (column grants + encryption).
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManageConnections, MANAGE_DENIED } from "@/lib/drive-connection";
import { nonceCookieName, nonceCookieOptions } from "@/lib/oauth-state";

async function currentOrg(supabase: SupabaseClient<Database>, userId: string): Promise<{ orgId: string; role: string }> {
  const { data: profile } = await supabase.from("profiles").select("current_org_id").eq("id", userId).single();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new Error("Selecciona una empresa");
  const { data: member } = await supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  if (!member) throw new Error("No eres miembro de esta empresa");
  return { orgId, role: member.role };
}
const mustOwner = (role: string) => { if (!canManageConnections(role)) throw new Error(MANAGE_DENIED); };

/** The state for the card: the company's account (never its token), recent events and whether each way to connect is set up. */
export const driveConnectionInfoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await currentOrg(context.supabase, context.userId);
    const { oauthConfigured, nokkoDriveAvailable } = await import("@/lib/drive-connection.server");
    const [{ data: connection }, { data: events }] = await Promise.all([
      context.supabase.from("drive_connections").select("google_email,status,last_error,connected_by,connected_at").eq("org_id", orgId).maybeSingle(),
      context.supabase.from("connection_events").select("action,actor,detail,created_at").eq("org_id", orgId).eq("provider", "drive").order("created_at", { ascending: false }).limit(5),
    ]);
    const ids = [...new Set([connection?.connected_by, ...(events ?? []).map((e) => e.actor)].filter((x): x is string => !!x))];
    const { data: people } = ids.length ? await context.supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] as { id: string; full_name: string }[] };
    const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name || "Alguien del equipo"]));
    return {
      connection: connection ? { ...connection, connected_by_name: connection.connected_by ? names[connection.connected_by] ?? null : null } : null,
      events: (events ?? []).map((e) => ({ action: e.action, detail: e.detail, created_at: e.created_at, actor_name: e.actor ? names[e.actor] ?? null : null })),
      nokkoAvailable: nokkoDriveAvailable(),
      oauthConfigured: oauthConfigured(),
    };
  });

export const startDriveConnectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ returnTo: z.string().max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    mustOwner(role);
    const { startConnect } = await import("@/lib/drive-connection.server");
    const origin = new URL(getRequest().url).origin;
    const { url, nonce } = await startConnect(orgId, context.userId, origin, data.returnTo);
    setCookie(nonceCookieName("drive"), nonce, nonceCookieOptions("drive", origin.startsWith("https:")));
    return { url };
  });

export const disconnectDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    mustOwner(role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { disconnectDrive } = await import("@/lib/drive-connection.server");
    return disconnectDrive(supabaseAdmin, orgId, context.userId);
  });
