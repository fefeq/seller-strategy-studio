// NK-0064 (SDD tool-plan-real-connections, CA-8): static check of the migration that limits the team's tool plan to the Owner.
// It proves what the file says, not how the database behaves (that is src/lib/integrations-policies.pg.test.ts). The migration is
// found by name pattern: its number is decided when it is integrated. The journal rules live in src/lib/migrations-journal.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = `${process.cwd()}/drizzle/migrations`;
const files = readdirSync(DIR).filter((f) => f.endsWith("_integrations_owner_write.sql"));

describe("the integrations owner-write migration", () => {
  it("exists exactly once", () => {
    expect(files).toHaveLength(1);
  });
  const raw = () => (files[0] ? readFileSync(`${DIR}/${files[0]}`, "utf8") : "");
  const sql = () => raw().replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();
  const policy = (name: string) =>
    sql().match(new RegExp(`create policy "${name}" on public\\.integrations .*?;`))?.[0] ?? "";
  const OWNER = "public.has_org_role(org_id, 'owner')";
  const ACTIVE = "org_id = public.current_org()";

  it("drops and recreates only «org insert» and «org update»", () => {
    expect(sql()).toContain('drop policy if exists "org insert" on public.integrations;');
    expect(sql()).toContain('drop policy if exists "org update" on public.integrations;');
    expect(sql()).not.toMatch(/"org read"|"org delete owner"/);
  });
  it("insert: to authenticated, only the Owner of the active company", () => {
    const p = policy("org insert");
    expect(p).toContain("for insert to authenticated");
    expect(p).toContain(`with check (${ACTIVE} and ${OWNER})`);
  });
  it("update: to authenticated, only the Owner of the active company, before and after the change", () => {
    const p = policy("org update");
    expect(p).toContain("for update to authenticated");
    expect(p).toContain(`using (${ACTIVE} and ${OWNER})`);
    expect(p).toContain(`with check (${ACTIVE} and ${OWNER})`);
  });
  it("documents how to undo it", () => {
    expect(raw()).toMatch(/rollback/i);
  });
});
