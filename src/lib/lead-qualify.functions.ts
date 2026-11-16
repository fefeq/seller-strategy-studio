import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { errorText } from "@/lib/errors";

const MAX = 25;

/**
 * Qualifies leads with Jev as the signed-in member (RLS applies): the given ids, or else the company's open
 * leads not qualified yet (newest first, up to 25). Stops on the first credit/permission error.
 */
export const qualifyLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids?: string[] }) => {
    const ids = Array.isArray(input?.ids)
      ? input.ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, MAX)
      : undefined;
    return { ids };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_org_id")
      .eq("id", userId)
      .single();
    const orgId = profile?.current_org_id;
    if (!orgId) throw new Error("Selecciona una empresa");
    let ids = data.ids;
    if (!ids?.length) {
      const { data: rows } = await supabase
        .from("leads")
        .select("id")
        .eq("org_id", orgId)
        .is("qualified_at", null)
        .in("stage", ["new", "contacted", "mql", "sql"])
        .order("created_at", { ascending: false })
        .limit(MAX);
      ids = (rows ?? []).map((r) => r.id);
    }
    const { qualifyLeadCore } = await import("@/lib/lead-qualify.server");
    const { JevError } = await import("@/lib/jev.server");
    const out = { done: 0, failed: 0, error: null as string | null };
    for (const id of ids) {
      try {
        await qualifyLeadCore(supabase, orgId, id);
        out.done += 1;
      } catch (e) {
        out.failed += 1;
        out.error = e instanceof JevError ? e.message : errorText(e);
        if (e instanceof JevError && [401, 402, 403, 404, 429].includes(e.status)) break;
      }
    }
    return out;
  });
