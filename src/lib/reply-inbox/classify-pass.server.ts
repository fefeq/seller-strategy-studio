// NK-0174 SDD 3 U-2: wires runClassifyPass to the privileged client, Gmail getBody and the private Opus 5.5 ports.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { runClassifyPass, type PendingReply } from "./classify-pass";

type Admin = SupabaseClient<Database>;

export async function classifyReplies(db: Admin, now = new Date()) {
  const { gmail, gmailConfigured } = await import("./gmail.server");
  if (!gmailConfigured() || !process.env["OPENROUTER_API_KEY"]) return { classified: 0, skipped: 0, failed: 0, paused: "not_configured" };
  const { replyModelPorts } = await import("./classification-provider.server");
  const model = replyModelPorts(async () => {}, process.env);
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  return runClassifyPass({
    pending: async (limit) => {
      const { data: links } = await db.from("mailbox_links").select("org_id").eq("status", "active");
      const orgs = (links ?? []).map((l) => l.org_id);
      if (!orgs.length) return [];
      const { data } = await db.from("inbox_replies").select("id,org_id,user_id,gmail_id,lead_id,kind")
        .eq("classify_status", "pending").in("org_id", orgs).gte("received_at", since).order("received_at").limit(limit);
      return (data ?? []) as PendingReply[];
    },
    reserve: async (id) => {
      const { data } = await db.from("inbox_replies").update({ classify_status: "reserved" }).eq("id", id).eq("classify_status", "pending").select("id");
      return (data ?? []).length === 1;
    },
    body: (id) => gmail.getBody(id),
    context: async (row) => {
      const [pos, pil, lead] = await Promise.all([
        db.from("positioning").select("*").eq("org_id", row.org_id).limit(1).maybeSingle(),
        db.from("messaging_pillars").select("*").eq("org_id", row.org_id).limit(5),
        row.lead_id ? db.from("leads").select("contact_name,title,company,notes").eq("org_id", row.org_id).eq("id", row.lead_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const l = lead.data as { contact_name: string | null; title: string | null; company: string | null; notes: string | null } | null;
      return {
        positioning: (pos.data ?? {}) as Record<string, unknown>,
        pillars: (pil.data ?? []) as Record<string, unknown>[],
        lead: { contact_name: l?.contact_name, title: l?.title, company: l?.company },
        forbidden: [l?.notes ?? ""].filter(Boolean),
      };
    },
    model: { classify: model.classify, draft: model.draft },
    receipt: async (row, r) => {
      await db.from("inbox_reply_receipts").insert({ org_id: row.org_id, operation: r.operation, outcome: r.outcome, input_tokens: r.usage?.inputTokens ?? null, output_tokens: r.usage?.outputTokens ?? null, cost_usd: r.usage?.costUsd ?? null });
    },
    save: async (row, p, expires) => {
      const c = p.classification;
      const { error } = await db.from("inbox_reply_derived").upsert({
        reply_id: row.id, org_id: row.org_id, user_id: row.user_id, state: p.state, category: c?.category ?? null, confidence: c?.confidence ?? null,
        brake: p.brake, proposal: p.proposal, draft: p.draft, referred_name: c?.referredName ?? null, referred_email: c?.referredEmail ?? null,
        return_date: c?.returnDate ?? null, warnings: p.warnings, expires_at: expires,
      }, { onConflict: "reply_id" });
      if (error) throw new Error("store");
    },
    finish: async (id, status) => { await db.from("inbox_replies").update({ classify_status: status }).eq("id", id); },
    purge: async (at) => { await db.from("inbox_reply_derived").delete().lte("expires_at", at.toISOString()); },
  }, now);
}
