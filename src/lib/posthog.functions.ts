// Each company's PostHog from the screens. Only the Owner connects, configures or disconnects; Owner and
// Sales Leader sync on demand. The key never comes back to the browser (column grants + encryption).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Db } from "@/lib/org-data";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkPosthogKey, domainPropertyOk, posthogHost, projectIdOk } from "@/lib/product-usage";

async function currentOrg(supabase: Db, userId: string): Promise<{ orgId: string; role: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_org_id")
    .eq("id", userId)
    .single();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new Error("Selecciona una empresa");
  const { data: member } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("No eres miembro de esta empresa");
  return { orgId, role: member.role };
}
const mustOwner = (role: string) => {
  if (role !== "owner")
    throw new Error("Solo el Owner de la empresa puede conectar o configurar PostHog.");
};

export const connectPosthogFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { host: string; projectId: string; key: string }) => {
    const host = posthogHost(String(d?.host ?? ""));
    if (!host)
      throw new Error(
        "La dirección de PostHog no es válida. Elige EU o US, o pega la dirección https de tu PostHog.",
      );
    const projectId = String(d?.projectId ?? "").trim();
    if (!projectIdOk(projectId))
      throw new Error(
        "El ID del proyecto es un número: lo ves en la dirección de PostHog (/project/12345).",
      );
    const k = checkPosthogKey(String(d?.key ?? ""));
    if (!k.ok) throw new Error(k.error);
    return { host, projectId, key: k.key };
  })
  .handler(async ({ data, context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    mustOwner(role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { connectPosthog } = await import("@/lib/posthog-sync.server");
    return connectPosthog(supabaseAdmin, orgId, context.userId, data);
  });

export const posthogEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    mustOwner(role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listPosthogEvents } = await import("@/lib/posthog-sync.server");
    return listPosthogEvents(supabaseAdmin, orgId);
  });

const Ev = z.string().trim().max(200).nullable();
export const configurePosthogFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const v = z
      .object({
        signup: Ev,
        activation: Ev,
        paid: Ev,
        domainProperty: z.string().trim().max(80).nullable(),
      })
      .parse(d);
    if (v.domainProperty && !domainPropertyOk(v.domainProperty))
      throw new Error("La propiedad solo puede tener letras, números, _ y $.");
    return v;
  })
  .handler(async ({ data, context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    mustOwner(role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("posthog_connections")
      .update({
        signup_event: data.signup || null,
        activation_event: data.activation || null,
        paid_event: data.paid || null,
        domain_property: data.domainProperty || null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    const { syncPosthogOrg } = await import("@/lib/posthog-sync.server");
    return syncPosthogOrg(supabaseAdmin, orgId);
  });

export const syncPosthogFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    if (role !== "owner" && role !== "sales_leader")
      throw new Error("Solo el Owner o el Sales Leader pueden sincronizar PostHog.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncPosthogOrg, MANUAL_SYNC_MINUTES } = await import("@/lib/posthog-sync.server");
    const { data: c } = await supabaseAdmin
      .from("posthog_connections")
      .select("last_synced_at")
      .eq("org_id", orgId)
      .maybeSingle();
    if (
      c?.last_synced_at &&
      Date.now() - new Date(c.last_synced_at).getTime() < MANUAL_SYNC_MINUTES * 60_000
    )
      return {
        ok: false,
        error: `PostHog se ha leído hace menos de ${MANUAL_SYNC_MINUTES} minutos. Espera un poco antes de volver a leerlo.`,
      };
    return syncPosthogOrg(supabaseAdmin, orgId);
  });

export const disconnectPosthogFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    mustOwner(role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("posthog_connections").delete().eq("org_id", orgId);
    await supabaseAdmin.from("product_usage").delete().eq("org_id", orgId);
    return { ok: true };
  });
