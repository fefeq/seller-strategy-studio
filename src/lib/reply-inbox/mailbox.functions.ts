// NK-0174 SDD 1: link / unlink the company's mailbox. Writes are privileged after role checks.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { canLinkMailbox } from "./rules";

async function gate(supabase: SupabaseClient<Database>, userId: string, orgId: string) {
  const [{ data: admin }, { data: member }] = await Promise.all([
    supabase.rpc("is_platform_admin", { _user: userId }),
    supabase.rpc("is_org_member", { _org: orgId }),
  ]);
  const g = canLinkMailbox({ isPlatformAdmin: !!admin, isMember: !!member });
  if (!g.ok) throw new Error(g.reason);
}

export const linkMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => ({ orgId: String(d.orgId) }))
  .handler(async ({ data, context }) => {
    await gate(context.supabase, context.userId, data.orgId);
    const { gmail } = await import("./gmail.server");
    const { emailAddress } = await gmail.profile();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mailbox_links").upsert(
      { org_id: data.orgId, user_id: context.userId, address: emailAddress, status: "active" },
      { onConflict: "org_id" },
    );
    if (error) throw new Error("No he podido guardar la conexión. Prueba de nuevo.");
    return { address: emailAddress };
  });

export const unlinkMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => ({ orgId: String(d.orgId) }))
  .handler(async ({ data, context }) => {
    await gate(context.supabase, context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mailbox_links").delete().eq("org_id", data.orgId);
    if (error) throw new Error("No he podido desconectar el buzón. Prueba de nuevo.");
    return { ok: true };
  });
