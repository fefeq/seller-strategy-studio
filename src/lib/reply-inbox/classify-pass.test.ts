import { describe, expect, it } from "vitest";
import {
  MAX_CLASSIFY_PER_PASS,
  plainBody,
  runClassifyPass,
  type PassPorts,
  type PendingReply,
} from "./classify-pass";

const b64 = (s: string) =>
  btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const now = new Date("2026-11-14T12:00:00Z");
const row = (id: string, kind: "human" | "auto" = "human"): PendingReply => ({
  id,
  org_id: "o",
  user_id: "u",
  gmail_id: `g${id}`,
  lead_id: "l",
  kind,
});

function fakePorts(rows: PendingReply[], opts: { reserve?: boolean; bodyFails?: boolean } = {}) {
  const log: string[] = [];
  const receipts: unknown[] = [];
  const saved: { id: string; expires: string; category: string | null }[] = [];
  const finished: Record<string, string> = {};
  const ports: PassPorts = {
    pending: async (limit) => rows.slice(0, limit),
    reserve: async (id) => {
      log.push(`reserve:${id}`);
      return opts.reserve ?? true;
    },
    body: async (g) => {
      log.push(`body:${g}`);
      if (opts.bodyFails) throw new Error("x");
      return {
        payload: {
          mimeType: "text/plain",
          body: { data: b64("Me interesa, ¿hablamos el martes? secreto-remitente") },
        },
      };
    },
    context: async () => ({
      positioning: {},
      pillars: [],
      lead: { contact_name: "Ana" },
      forbidden: [],
    }),
    model: {
      classify: async () => {
        log.push("classify");
        return {
          completed: true,
          output: {
            category: "interested",
            confidence: 0.9,
            returnDate: null,
            referredName: null,
            referredEmail: null,
          },
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.01 },
        };
      },
      draft: async () => {
        log.push("draft");
        return { completed: true, output: "Hola Ana, claro.", usage: null };
      },
    },
    receipt: async (_r, rec) => {
      receipts.push(rec);
    },
    save: async (r, p, expires) => {
      saved.push({ id: r.id, expires, category: p.classification?.category ?? null });
    },
    finish: async (id, status) => {
      finished[id] = status;
    },
    purge: async () => {
      log.push("purge");
    },
  };
  return { ports, log, receipts, saved, finished };
}

describe("plainBody", () => {
  it("decodes the text/plain part", () => {
    expect(
      plainBody({
        payload: {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/html", body: { data: b64("<b>x</b>") } },
            { mimeType: "text/plain", body: { data: b64("Hola ñ") } },
          ],
        },
      }),
    ).toBe("Hola ñ");
  });
  it("falls back to stripped html", () => {
    expect(
      plainBody({
        payload: { mimeType: "text/html", body: { data: b64("<p>Hola</p><p>Ana</p>") } },
      }),
    ).toBe("Hola Ana");
  });
});

describe("runClassifyPass", () => {
  it("reserves before reading the body or calling the model", async () => {
    const f = fakePorts([row("1")]);
    await runClassifyPass(f.ports, now);
    expect(f.log.indexOf("reserve:1")).toBeLessThan(f.log.indexOf("body:g1"));
    expect(f.log.indexOf("body:g1")).toBeLessThan(f.log.indexOf("classify"));
    expect(f.finished["1"]).toBe("done");
    expect(f.saved[0]?.category).toBe("interested");
  });
  it("never spends when the reservation is lost", async () => {
    const f = fakePorts([row("1")], { reserve: false });
    await runClassifyPass(f.ports, now);
    expect(f.log).not.toContain("classify");
    expect(f.log).not.toContain("body:g1");
  });
  it("marks failed and does not call the model when the body cannot be read", async () => {
    const f = fakePorts([row("1")], { bodyFails: true });
    await runClassifyPass(f.ports, now);
    expect(f.log).not.toContain("classify");
    expect(f.finished["1"]).toBe("failed");
  });
  it("skips automatic replies without AI", async () => {
    const f = fakePorts([row("1", "auto")]);
    await runClassifyPass(f.ports, now);
    expect(f.log).not.toContain("classify");
    expect(f.finished["1"]).toBe("skipped");
  });
  it("processes at most 10 replies per pass", async () => {
    expect(MAX_CLASSIFY_PER_PASS).toBe(10);
    const f = fakePorts(Array.from({ length: 15 }, (_, i) => row(String(i))));
    const out = await runClassifyPass(f.ports, now);
    expect(out.classified).toBe(10);
  });
  it("receipts carry no reply text", async () => {
    const f = fakePorts([row("1")]);
    await runClassifyPass(f.ports, now);
    expect(JSON.stringify(f.receipts)).not.toContain("secreto-remitente");
    expect(JSON.stringify(f.receipts)).not.toContain("interesa");
  });
  it("derived rows expire after 30 days", async () => {
    const f = fakePorts([row("1")]);
    await runClassifyPass(f.ports, now);
    expect(f.saved[0]?.expires).toBe("2026-12-14T12:00:00.000Z");
    expect(f.log).toContain("purge");
  });
});
