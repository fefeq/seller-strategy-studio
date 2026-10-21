// Builds an agent context for a user reached through an external channel (Telegram, cron).
// Uses the privileged client, so every tool must (and does) scope by org_id; roles come from org_members.
import type { Db } from "@/lib/org-data";
import type { ToolCtx } from "@/lib/agent/tools";

export async function channelCtx(admin: Db, userId: string): Promise<(ToolCtx & { orgName: string }) | null> {
  const { data: profile } = await admin.from("profiles").select("current_org_id").eq("id", userId).maybeSingle();
  const orgId = profile?.current_org_id;
  if (!orgId) return null;
  const [{ data: members }, { data: org }] = await Promise.all([
    admin.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId),
    admin.from("organizations").select("name,company_name,currency").eq("id", orgId).maybeSingle(),
  ]);
  if (!members?.length) return null;
  return { db: admin, orgId, userId, roles: members.map((m) => m.role), currency: org?.currency ?? "EUR", orgName: org?.company_name?.trim() || org?.name || "tu empresa" };
}
