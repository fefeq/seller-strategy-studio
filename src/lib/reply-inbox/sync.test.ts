import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchReplies, replyKind, senderQueries, headerMap } from "./sync";
import { followupStatus } from "@/lib/followup";

const msg = (id: string, from: string, extra: Record<string, string> = {}) => ({ id, threadId: "t" + id, internalDate: "1763100000000", headers: { from, ...extra } });

describe("NK-0174 SDD 2 sync rules", () => {
  it("R-1 queries always filter by sender, in batches, deduped", () => {
    const q = senderQueries(["A@x.com", "a@x.com", "bad", ...Array.from({ length: 25 }, (_, i) => `p${i}@y.com`)]);
    expect(q).toHaveLength(2);
    for (const s of q) expect(s).toMatch(/^from:\(.+\) newer_than:30d$/);
    expect(q.join(" ")).not.toContain("bad");
    expect(senderQueries([])).toEqual([]);
  });
  it("R-2 only the exact contact address matches", () => {
    const r = matchReplies([msg("1", "Ana <ana@x.com>"), msg("2", "otra@x.com"), msg("3", "ana@x.com.evil.io")], [{ id: "L", email: " Ana@X.com " }]);
    expect(r.rows.map((x) => x.gmail_id)).toEqual(["1"]);
    expect(r.marks).toEqual([{ lead_id: "L", replied_at: new Date(1763100000000).toISOString() }]);
  });
  it("R-3 automatic replies are stored but never mark; daemons are dropped", () => {
    expect(replyKind(headerMap([{ name: "Auto-Submitted", value: "auto-replied" }, { name: "From", value: "a@x.com" }]))).toBe("auto");
    expect(replyKind({ from: "a@x.com", "auto-submitted": "no" })).toBe("human");
    expect(replyKind({ from: "a@x.com", precedence: "bulk" })).toBe("auto");
    expect(replyKind({ from: "MAILER-DAEMON@google.com" })).toBe("drop");
    const r = matchReplies([msg("1", "a@x.com", { "x-autoreply": "yes" })], [{ id: "L", email: "a@x.com" }]);
    expect(r.rows[0]!.kind).toBe("auto");
    expect(r.marks).toEqual([]);
  });
  it("R-4 a replied lead stops the follow-up sequence without touching contacted_at", () => {
    const base = { stage: "contacted", contacted_at: "2026-11-01", next_step_at: null, company: "X" };
    const now = new Date("2026-11-05");
    expect(followupStatus(base, now).due?.id).toBe("nudge");
    const st = followupStatus({ ...base, replied: true }, now);
    expect(st.due).toBeNull();
    expect(st.reason).toBe("replied");
  });
  it("R-6 the sync never fetches message bodies", () => {
    const src = readFileSync("src/lib/reply-inbox/sync.server.ts", "utf8");
    expect(src).not.toMatch(/getBody|format=full/);
    expect(src).not.toMatch(/console\.(log|error|warn)\([^)]*(subject|snippet|from)/i);
  });
});
