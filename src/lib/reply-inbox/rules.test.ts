// NK-0174 SDD 1 U-1
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { canLinkMailbox, chunkIds, GMAIL_OPERATIONS, LEGAL_GATE_TEXT } from "./rules";

describe("R-1 legal gate", () => {
  it("lets only a superadmin member link", () => {
    expect(canLinkMailbox({ isPlatformAdmin: true, isMember: true }).ok).toBe(true);
    expect(canLinkMailbox({ isPlatformAdmin: false, isMember: true })).toEqual({
      ok: false,
      reason: LEGAL_GATE_TEXT,
    });
    expect(canLinkMailbox({ isPlatformAdmin: true, isMember: false }).ok).toBe(false);
  });
});

describe("R-3 closed Gmail client", () => {
  const src = readFileSync("src/lib/reply-inbox/gmail.server.ts", "utf8");
  it("exposes exactly the four read operations", () => {
    expect([...GMAIL_OPERATIONS]).toEqual(["profile", "listMessages", "getMetadata", "getBody"]);
  });
  it("never sends, modifies, watches or reads history", () => {
    for (const bad of ["/send", "/modify", "/trash", "/watch", "/history", "/drafts", "method:"])
      expect(src).not.toContain(bad);
  });
  it("caps metadata batches at 50", () => {
    expect(chunkIds(Array.from({ length: 120 }, (_, i) => String(i))).map((c) => c.length)).toEqual(
      [50, 50, 20],
    );
  });
});

describe("R-6 no assistant access (Q-10 a)", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  }
  it("agent, MCP and Telegram never import reply-inbox modules", () => {
    const paths = [
      ...files("src/lib/agent"),
      ...files("src/lib/mcp"),
      "src/lib/telegram.server.ts",
    ];
    for (const p of paths) expect(readFileSync(p, "utf8"), p).not.toMatch(/reply-inbox/);
  });
});
