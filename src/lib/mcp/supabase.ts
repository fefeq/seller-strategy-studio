// Supabase client for MCP tools: always acts as the verified OAuth caller, so RLS applies.
import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

type RuntimeGlobals = typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
const env = (n: string) => (globalThis as RuntimeGlobals).process?.env?.[n]?.trim() || undefined;

function projectUrl() {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is required");
  return url;
}
function publishableKey() {
  const key = env("SUPABASE_PUBLISHABLE_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY is required");
  return key;
}

export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient<Database>(projectUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
