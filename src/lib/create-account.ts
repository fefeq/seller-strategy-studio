import type { QueryClient } from "@tanstack/react-query";
import type { Db } from "@/lib/org-data";
import { invalidateSetup } from "@/hooks/setup-invalidation";

/** Creates one account with its plan. Refreshes the guide only after the insert succeeded; returns the new id, or the error. */
export async function createAccount(
  supabase: Db,
  qc: QueryClient,
  input: { name: string; domain: string },
) {
  const { data: a, error } = await supabase
    .from("accounts")
    .insert({ name: input.name, domain: input.domain })
    .select()
    .single();
  if (error) return { id: null, error };
  await supabase.from("account_plans").insert({ account_id: a.id });
  await invalidateSetup(qc);
  return { id: a.id as string, error: null };
}
