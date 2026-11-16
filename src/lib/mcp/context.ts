// Turns a verified MCP caller into the same ToolCtx the in-app agent uses (current company + roles).
import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import type { Db } from "@/lib/org-data";
import type { ToolCtx } from "@/lib/agent/tools";
import { supabaseForUser } from "./supabase";

export async function mcpCtx(ctx: ToolContext): Promise<ToolCtx & { orgName: string }> {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) throw new ToolError("No autenticado");
  const db = supabaseForUser(ctx) as unknown as Db;
  const { data: profile } = await db
    .from("profiles")
    .select("current_org_id")
    .eq("id", userId)
    .maybeSingle();
  const orgId = profile?.current_org_id;
  if (!orgId) throw new ToolError("No tienes empresa activa. Usa list_companies y switch_company.");
  const [{ data: members }, { data: org }] = await Promise.all([
    db.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId),
    db.from("organizations").select("name,currency").eq("id", orgId).maybeSingle(),
  ]);
  if (!members?.length)
    throw new ToolError("No perteneces a la empresa activa. Usa switch_company.");
  return {
    db,
    orgId,
    userId,
    roles: members.map((m) => m.role),
    currency: org?.currency ?? "EUR",
    orgName: org?.name ?? "tu empresa",
  };
}

export const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
export const json = (v: unknown) => text(JSON.stringify(v, null, 2).slice(0, 60_000));
