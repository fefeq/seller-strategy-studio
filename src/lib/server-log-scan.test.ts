// @vitest-environment node
// NK-0104 CA-5: a console.error|warn|log in src/lib/**/*.server.ts must not carry a slice of a body or model output
// (`.slice(`) nor the whole error (`, e)` / `, err)` / `, error)`). Use safeErrorLog(e) or lengths and status instead.
// The exception list is closed: each entry names the file, the exact call and why it is left. These were found when the
// scan was written and are NOT approved as safe: they are pending follow-up tickets. A new entry needs a reason.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const LIB = join(import.meta.dirname);

function serverFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? serverFiles(p) : n.endsWith(".server.ts") ? [p] : [];
  });
}

/** Every console.error|warn|log call: its text up to the matching parenthesis, whitespace collapsed. */
function consoleCalls(src: string): string[] {
  const out: string[] = [];
  const re = /console\.(?:error|warn|log)\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    out.push(src.slice(m.index, i).replace(/\s+/g, " "));
  }
  return out;
}

function isUnsafeLog(call: string): boolean {
  return /\.slice\(/.test(call) || /,\s*(?:e|err|error)\s*\)$/.test(call);
}

const PENDING = "Pending follow-up (found by the NK-0104 scan, out of its scope): ";
// file -> exact call -> reason. Closed list.
const EXCEPTIONS: Record<string, Record<string, string>> = {
  "src/lib/email.server.ts": {
    'console.error("resend error", res.status, err)': PENDING + "provider body slice",
  },
  "src/lib/posthog-sync.server.ts": {
    "console.error(`PostHog query failed [${res.status}]: ${body.slice(0, 400)}`)":
      PENDING + "provider body slice",
  },
  "src/lib/telegram.server.ts": {
    "console.error(`Telegram ${method} failed [${res.status}]: ${text.slice(0, 300)}`)":
      PENDING + "provider body slice",
  },
  "src/lib/inngest/send.server.ts": {
    "console.error(`Inngest send failed [${res.status}]: ${body.slice(0, 400)}`)":
      PENDING + "provider body slice",
  },
  "src/lib/weekly-report.server.ts": {
    'console.error("weekly report failed", o.id, e)': PENDING + "whole error",
    'console.error("weekly telegram failed", e)': PENDING + "whole error",
  },
  "src/lib/daily-email.server.ts": {
    'console.error("daily email failed", p.id, e)': PENDING + "whole error",
  },
  "src/lib/notices.server.ts": {
    'console.error("deliverJobNotice", e)': PENDING + "whole error",
    'console.error("flushHeldNotices", e)': PENDING + "whole error",
  },
  "src/lib/after-response.server.ts": {
    "console.error(`afterResponse ${label}`, e)": PENDING + "whole error",
    'console.error("waitUntil", e)': PENDING + "whole error",
  },
};

describe("server logs carry no body, output or whole error (NK-0104 CA-5)", () => {
  const files = serverFiles(LIB).map((f) => ({
    rel: relative(ROOT, f).split("\\").join("/"),
    src: readFileSync(f, "utf8"),
  }));

  it("finds the server files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no unsafe console call outside the closed exception list", () => {
    const found = files.flatMap((f) =>
      consoleCalls(f.src)
        .filter(isUnsafeLog)
        .filter((c) => !(c in (EXCEPTIONS[f.rel] ?? {})))
        .map((c) => `${f.rel}: ${c}`),
    );
    expect(found).toEqual([]);
  });

  it("every exception still matches an unsafe call and has a reason (no stale entries)", () => {
    const stale: string[] = [];
    for (const [file, calls] of Object.entries(EXCEPTIONS)) {
      const f = files.find((x) => x.rel === file);
      const present = f ? consoleCalls(f.src).filter(isUnsafeLog) : [];
      for (const [call, why] of Object.entries(calls))
        if (!present.includes(call) || !why.trim()) stale.push(`${file}: ${call}`);
    }
    expect(stale).toEqual([]);
  });

  it("the scan itself flags the three NK-0104 patterns", () => {
    expect(isUnsafeLog('console.error("x", e)')).toBe(true);
    expect(isUnsafeLog("console.error(`x ${body.slice(0, 500)}`)")).toBe(true);
    expect(isUnsafeLog('console.error("x", raw.slice(0, 300))')).toBe(true);
    expect(isUnsafeLog('console.error("x", safeErrorLog(e))')).toBe(false);
    expect(isUnsafeLog('console.error("x", res.status, body.length)')).toBe(false);
  });
});
