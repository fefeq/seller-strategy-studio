import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const DIR = resolve(__dirname, "../../scripts/migration");
const VERIFY = join(DIR, "verify-data.mjs");
const VAULT = join(DIR, "verify-vault.mjs");
const SAFE = join(DIR, "check-preprod-safe.mjs");

let root: string;

function run(script: string, ...args: string[]) {
  const r = spawnSync("node", [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, NOKKO_SOURCE_DB_URL: "", NOKKO_TARGET_DB_URL: "" },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

// A real failure of the script prints FALLO; a missing script also exits 1, which must not count.
const failed = (r: { code: number | null; out: string }) => r.code === 1 && r.out.includes("FALLO");

const catalog = () => ({
  triggers: ["auth.users.on_auth_user_created"],
  policies: ["public.accounts.org_read:abc"],
  grants: ["public.accounts.authenticated.SELECT"],
  publications: ["supabase_realtime.public.deals"],
  extensions: ["pgcrypto"],
  cron_jobs: 0,
  db_webhooks: 0,
});

function snapshot(over: Record<string, unknown> = {}) {
  return {
    version: 1,
    kind: "snapshot",
    taken_at: "2026-10-31T00:00:00Z",
    tables: {
      "public.accounts": { rows: 10, md5: "aaa" },
      "public.deals": { rows: 3, md5: "bbb" },
      "vault.secrets": { rows: 2, md5: "ccc" },
    },
    cipher_columns: { "public.posthog_connections.api_key_enc": { rows: 1, md5: "ddd" } },
    catalog: catalog(),
    ...over,
  };
}

function write(name: string, body: unknown) {
  const p = join(root, name);
  writeFileSync(p, JSON.stringify(body));
  return p;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nokko-migration-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("verify-data diff (CA-5, CA-6, CA-27)", () => {
  it("passes when counts, hashes, encrypted columns and catalog match", () => {
    const a = write("a.json", snapshot());
    const b = write("b.json", snapshot());
    const r = run(VERIFY, "diff", a, b);
    expect(r.code).toBe(0);
    expect(r.out).toContain("OK");
  });

  it("fails and names the table when a row count differs", () => {
    const a = write("a.json", snapshot());
    const b = write(
      "b.json",
      snapshot({ tables: { ...snapshot().tables, "public.deals": { rows: 2, md5: "bbb" } } }),
    );
    const r = run(VERIFY, "diff", a, b);
    expect(failed(r)).toBe(true);
    expect(r.out).toContain("public.deals");
  });

  it("fails when the content hash differs with the same count", () => {
    const a = write("a.json", snapshot());
    const b = write(
      "b.json",
      snapshot({ tables: { ...snapshot().tables, "public.accounts": { rows: 10, md5: "zzz" } } }),
    );
    expect(failed(run(VERIFY, "diff", a, b))).toBe(true);
  });

  it("fails when the target is missing a source table", () => {
    const t = snapshot().tables as Record<string, unknown>;
    delete t["vault.secrets"];
    const a = write("a.json", snapshot());
    const b = write("b.json", snapshot({ tables: t }));
    const r = run(VERIFY, "diff", a, b);
    expect(failed(r)).toBe(true);
    expect(r.out).toContain("vault.secrets");
  });

  it("fails when an encrypted column changed (CA-27)", () => {
    const a = write("a.json", snapshot());
    const b = write(
      "b.json",
      snapshot({
        cipher_columns: { "public.posthog_connections.api_key_enc": { rows: 1, md5: "xxx" } },
      }),
    );
    const r = run(VERIFY, "diff", a, b);
    expect(failed(r)).toBe(true);
    expect(r.out).toContain("api_key_enc");
  });

  it("fails when the target lacks the auth trigger or a realtime publication (CA-6)", () => {
    const a = write("a.json", snapshot());
    const b = write(
      "b.json",
      snapshot({ catalog: { ...catalog(), triggers: [], publications: [] } }),
    );
    const r = run(VERIFY, "diff", a, b);
    expect(failed(r)).toBe(true);
    expect(r.out).toContain("on_auth_user_created");
    expect(r.out).toContain("public.deals");
  });

  it("does not fail for extra objects only present in the target", () => {
    const a = write("a.json", snapshot());
    const b = write(
      "b.json",
      snapshot({
        tables: { ...snapshot().tables, "public.extra": { rows: 0, md5: "" } },
        catalog: { ...catalog(), extensions: ["pgcrypto", "pg_stat_statements"] },
      }),
    );
    expect(run(VERIFY, "diff", a, b).code).toBe(0);
  });

  it("fails when a table could not be read on either side", () => {
    const bad = { ...snapshot().tables, "public.accounts": { error: "permission denied" } };
    const a = write("a.json", snapshot());
    const b = write("b.json", snapshot({ tables: bad }));
    expect(failed(run(VERIFY, "diff", a, b))).toBe(true);
  });
});

describe("verify-data files manifest (CA-7)", () => {
  it("records hashes and detects a changed or missing file", () => {
    const f1 = join(root, "dump1.enc");
    const f2 = join(root, "dump2.enc");
    writeFileSync(f1, "cipher-one");
    writeFileSync(f2, "cipher-two");
    const m = join(root, "manifest.json");
    expect(run(VERIFY, "files", "manifest", "--out", m, f1, f2).code).toBe(0);
    expect(Object.keys(JSON.parse(readFileSync(m, "utf8")).files)).toHaveLength(2);
    expect(run(VERIFY, "files", "verify", m).code).toBe(0);

    writeFileSync(f2, "cipher-tampered");
    const bad = run(VERIFY, "files", "verify", m);
    expect(failed(bad)).toBe(true);
    expect(bad.out).toContain("dump2.enc");

    rmSync(f1);
    expect(failed(run(VERIFY, "files", "verify", m))).toBe(true);
  });
});

describe("verify-vault diff (CA-28)", () => {
  const vault = (orgs: string[], extra: Record<string, unknown> = {}) => ({
    version: 1,
    kind: "vault",
    stripe_orgs_with_key: orgs,
    ...extra,
  });

  it("passes when the same companies have a usable key", () => {
    const a = write("a.json", vault(["h1", "h2"]));
    const b = write("b.json", vault(["h2", "h1"]));
    expect(run(VAULT, "diff", a, b).code).toBe(0);
  });

  it("fails and counts the companies that lost their key", () => {
    const a = write("a.json", vault(["h1", "h2", "h3"]));
    const b = write("b.json", vault(["h1"]));
    const r = run(VAULT, "diff", a, b);
    expect(failed(r)).toBe(true);
    expect(r.out).toContain("2");
  });

  it("never prints company ids or keys, only counts", () => {
    const a = write("a.json", vault(["h1", "h2"]));
    const b = write("b.json", vault(["h1"]));
    const r = run(VAULT, "diff", a, b);
    expect(r.out).not.toContain("h2");
  });

  it("fails if the destination could not evaluate a key", () => {
    const a = write("a.json", vault(["h1"]));
    const b = write("b.json", vault([], { errors: 1 }));
    expect(failed(run(VAULT, "diff", a, b))).toBe(true);
  });
});

describe("check-preprod-safe (CA-26, data part)", () => {
  it("passes with no cron jobs and no database webhooks", () => {
    const s = write("s.json", snapshot());
    expect(run(SAFE, "--from", s).code).toBe(0);
  });

  it("fails when the destination has scheduled jobs", () => {
    const s = write("s.json", snapshot({ catalog: { ...catalog(), cron_jobs: 2 } }));
    const r = run(SAFE, "--from", s);
    expect(failed(r)).toBe(true);
    expect(r.out).toContain("cron");
  });

  it("fails when the destination has database webhooks", () => {
    const s = write("s.json", snapshot({ catalog: { ...catalog(), db_webhooks: 1 } }));
    expect(failed(run(SAFE, "--from", s))).toBe(true);
  });
});

describe("secret handling", () => {
  it("snapshot without a database URL stops without printing anything sensitive", () => {
    const r = run(
      VERIFY,
      "snapshot",
      "--env",
      "NOKKO_SOURCE_DB_URL",
      "--out",
      join(root, "x.json"),
    );
    expect(failed(r)).toBe(true);
    expect(r.out).toContain("NOKKO_SOURCE_DB_URL");
    expect(r.out).not.toMatch(/postgres(ql)?:\/\//);
  });
});
