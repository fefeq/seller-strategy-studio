import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { errorText } from "@/lib/errors";
import { checkStripeKey } from "@/lib/stripe/metrics";

async function currentOrg(supabase: any, userId: string): Promise<{ orgId: string; role: string }> {
  const { data: profile } = await supabase.from("profiles").select("current_org_id").eq("id", userId).single();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new Error("Selecciona una empresa");
  const { data: member } = await supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  if (!member) throw new Error("No eres miembro de esta empresa");
  return { orgId, role: member.role };
}

/**
 * The Owner pastes the restricted key. The database stores it in Vault (as the user, so only an Owner
 * can), then the server reads Stripe once so the person sees right away whether the key works.
 */
export const connectStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => {
    const r = checkStripeKey(String(input?.key ?? ""));
    if (!r.ok) throw new Error(r.error);
    return { key: r.key };
  })
  .handler(async ({ data, context }) => {
    const { orgId } = await currentOrg(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("set_stripe_key", { _key: data.key });
    if (error) throw new Error(errorText(error));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncStripeOrg } = await import("@/lib/stripe/sync.server");
    return syncStripeOrg(supabaseAdmin, orgId);
  });

/** Owner or Sales Leader reads Stripe again now. */
export const syncStripeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId, role } = await currentOrg(context.supabase, context.userId);
    if (role !== "owner" && role !== "sales_leader") throw new Error("Solo el Owner o el Sales Leader pueden sincronizar Stripe.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncStripeOrg } = await import("@/lib/stripe/sync.server");
    return syncStripeOrg(supabaseAdmin, orgId);
  });
