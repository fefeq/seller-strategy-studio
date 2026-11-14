// NK-0174 SDD 3 U-2 (port-based, tested): one bounded classification pass. Reserve before any read or spend;
// a reservation is never replayed. Reply text lives only in memory; receipts carry counters and cost only.
import { DERIVED_TTL_DAYS } from "./classification";
import { prepareReply, type PreparedReply, type ReplyPorts } from "./classification-core";

export const MAX_CLASSIFY_PER_PASS = 10;
export type PendingReply = { id: string; org_id: string; user_id: string; gmail_id: string; lead_id: string | null; kind: "human" | "auto" };
type Receipt = Parameters<ReplyPorts["record"]>[0];
type Ctx = { positioning: Record<string, unknown>; pillars: Record<string, unknown>[]; lead: Record<string, unknown>; forbidden: string[] };
export type PassPorts = {
  pending: (limit: number) => Promise<PendingReply[]>;
  reserve: (id: string) => Promise<boolean>;
  body: (gmailId: string) => Promise<unknown>;
  context: (row: PendingReply) => Promise<Ctx>;
  model: Pick<ReplyPorts, "classify" | "draft">;
  receipt: (row: PendingReply, receipt: Receipt) => Promise<void>;
  save: (row: PendingReply, prepared: PreparedReply, expiresAt: string) => Promise<void>;
  finish: (id: string, status: "done" | "failed" | "skipped") => Promise<void>;
  purge: (now: Date) => Promise<void>;
};

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
function decode(data: string): string {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function find(part: Part | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) { const hit = find(p, mime); if (hit) return hit; }
  return null;
}
/** Plain text of a Gmail format=full message; html fallback is tag-stripped. Never stored. */
export function plainBody(message: unknown): string {
  const payload = (message as { payload?: Part } | null)?.payload;
  const text = find(payload, "text/plain");
  if (text) return text.trim();
  const html = find(payload, "text/html");
  return html ? html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() : "";
}

export async function runClassifyPass(ports: PassPorts, now = new Date()) {
  await ports.purge(now).catch(() => console.error("reply classify: purge failed"));
  const rows = await ports.pending(MAX_CLASSIFY_PER_PASS);
  let classified = 0, skipped = 0, failed = 0;
  for (const row of rows.slice(0, MAX_CLASSIFY_PER_PASS)) {
    if (!(await ports.reserve(row.id).catch(() => false))) continue;
    if (row.kind === "auto") { await ports.finish(row.id, "skipped"); skipped++; continue; }
    let text = "";
    let ctx: Ctx;
    try { text = plainBody(await ports.body(row.gmail_id)); ctx = await ports.context(row); }
    catch { console.error("reply classify: read failed"); await ports.finish(row.id, "failed").catch(() => {}); failed++; continue; }
    try {
      const prepared = await prepareReply(
        { kind: "human", text, now, forbidden: ctx.forbidden, context: { positioning: ctx.positioning, pillars: ctx.pillars, contact: { firstName: String(ctx.lead.contact_name ?? "").split(/\s+/)[0] ?? "", role: String(ctx.lead.title ?? ""), company: String(ctx.lead.company ?? "") } } as never },
        { ...ports.model, record: (r) => ports.receipt(row, r) },
      );
      await ports.save(row, prepared, new Date(now.getTime() + DERIVED_TTL_DAYS * 86_400_000).toISOString());
      await ports.finish(row.id, "done");
      classified++;
    } catch {
      console.error("reply classify: store failed");
      await ports.finish(row.id, "failed").catch(() => {});
      failed++;
    }
  }
  return { classified, skipped, failed };
}
