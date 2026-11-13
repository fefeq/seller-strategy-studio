// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, build, seed, U } from "@/test/pg-harness";

// NK-0173: after migration 0091 only the privileged client writes blocked-draft rows.
let db: Awaited<ReturnType<typeof build>>;
let orgs: { A: string; B: string };
beforeAll(async () => {
  db = await build();
  orgs = await seed(db);
  await db.exec("alter default privileges in schema public revoke all on tables from anon, authenticated, service_role");
  await db.exec(readFileSync("drizzle/migrations/0090_email_draft_blocks.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0091_email_draft_blocks_privileged_writes.sql", "utf8"));
}, 60000);
afterAll(async () => { await db?.close(); });

describe("NK-0173 blocked drafts are written only by the privileged client", () => {
  it("a member cannot insert, not even in their own company", async () => {
    await expect(as(db, U.aeA, () => db.query("insert into email_draft_blocks(surface,status,reason) values ('draft_followup','invalid','Synthetic block')"))).rejects.toMatchObject({ code: "42501" });
    await expect(as(db, U.ownerA, () => db.query("insert into email_draft_blocks(org_id,surface,status,reason) values ($1,'draft_followup','invalid','Synthetic block')", [orgs.A]))).rejects.toMatchObject({ code: "42501" });
  });
  it("the privileged role still writes and members still read their company", async () => {
    await db.exec("set role service_role");
    try { await db.query("insert into email_draft_blocks(org_id,surface,status,reason) values ($1,'draft_followup','invalid','Synthetic block')", [orgs.A]); }
    finally { await db.exec("reset role"); }
    const r = await as(db, U.aeA, () => db.query("select org_id from email_draft_blocks"));
    expect(r.rows).toEqual([{ org_id: orgs.A }]);
  });
});
