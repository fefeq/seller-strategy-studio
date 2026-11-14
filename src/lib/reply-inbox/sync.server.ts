// NK-0174 SDD 2: one bounded, read-only pass over each linked mailbox (design B: sender-only queries).
// Stores metadata only (ids, thread, date, kind); never message text. Errors are logged with fixed labels.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MAX_MESSAGES_PER_PASS, headerMap, matchReplies, senderQueries, type FoundMessage } from "./sync";

type Admin = SupabaseClient<Database>;
export type SyncResult = { orgs: number; found: number; marked: number; paused?: string };

export async function syncReplies(db: Admin, now = new Date()): Promise<SyncResult> {
  const { gmail, gmailConfigured } = await import("./gmail.server");
  if (!gmailConfigured()) return { orgs: 0, found: 0, marked: 0, paused: "not_configured" };
  const { data: links } = await db.from("mailbox_links").select("org_id,user_id,replies_count").eq("status", "active");
  let found = 0, marked = 0, budget = MAX_MESSAGES_PER_PASS;
  for (const link of links ?? []) {
    if (budget <= 0) break;
    const { data: leads } = await db.from("leads").select("id,email").eq("org_id", link.org_id).eq("stage", "contacted").not("email", "is", null).limit(500);
    const list = leads ?? [];
    const messages: FoundMessage[] = [];
    try {
      for (const q of senderQueries(list.map((l) => l.email ?? ""))) {
        if (budget <= 0) break;
        const ids = (await gmail.listMessages(q, Math.min(50, budget))).messages ?? [];
        const { data: seen } = ids.length ? await db.from("inbox_replies").select("gmail_id").eq("org_id", link.org_id).in("gmail_id", ids.map((m) => m.id)) : { data: [] };
        const fresh = ids.filter((m) => !(seen ?? []).some((s) => s.gmail_id === m.id)).slice(0, budget);
        budget -= fresh.length;
        const meta = (await gmail.getMetadata(fresh.map((m) => m.id))) as { id: string; threadId: string; internalDate?: string; payload?: { headers?: { name: string; value: string }[] } }[];
        for (const m of meta) messages.push({ id: m.id, threadId: m.threadId, internalDate: m.internalDate, headers: headerMap(m.payload?.headers) });
      }
    } catch {
      console.error("reply sync: gmail read failed");
      return { orgs: (links ?? []).length, found, marked, paused: "gmail_error" };
    }
    const { rows, marks } = matchReplies(messages, list);
    if (rows.length) {
      const { error } = await db.from("inbox_replies").upsert(rows.map((r) => ({ ...r, org_id: link.org_id, user_id: link.user_id })), { onConflict: "org_id,gmail_id", ignoreDuplicates: true });
      if (error) { console.error("reply sync: store failed"); continue; }
    }
    if (marks.length) await db.from("lead_replied_marks").upsert(marks.map((m) => ({ ...m, org_id: link.org_id })), { onConflict: "org_id,lead_id" });
    found += rows.length; marked += marks.length;
    await db.from("mailbox_links").update({ last_synced_at: now.toISOString(), replies_count: (link.replies_count ?? 0) + rows.length }).eq("org_id", link.org_id);
  }
  return { orgs: (links ?? []).length, found, marked };
}
