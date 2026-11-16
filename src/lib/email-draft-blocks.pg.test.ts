// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, build, seed, U } from "@/test/pg-harness";

let db: Awaited<ReturnType<typeof build>>;
let orgs: { A: string; B: string };
beforeAll(async () => {
  db = await build();
  orgs = await seed(db);
  // Match actual Cloud defaults rather than the legacy harness's broad default grants.
  await db.exec(
    "alter default privileges in schema public revoke all on tables from anon, authenticated, service_role",
  );
  await db.exec(readFileSync("drizzle/migrations/0090_email_draft_blocks.sql", "utf8"));
}, 60000);
afterAll(async () => {
  await db?.close();
});

describe("NK-0173 CA-6 blocked drafts", () => {
  it("members read and insert only in their current company", async () => {
    await db.query(
      "insert into email_draft_blocks(org_id,surface,status,reason) values ($1,'draft_followup','invalid','Synthetic block'),($2,'followup_sequence','catch_all','Synthetic block')",
      [orgs.A, orgs.B],
    );
    const result = await as(db, U.aeA, () =>
      db.query("select org_id,status from email_draft_blocks"),
    );
    expect(result.rows).toEqual([{ org_id: orgs.A, status: "invalid" }]);
    await as(db, U.aeA, () =>
      db.query(
        "insert into email_draft_blocks(surface,status,reason) values ('draft_followup','invalid','Synthetic block')",
      ),
    );
    await expect(
      as(db, U.aeA, () =>
        db.query(
          "insert into email_draft_blocks(org_id,surface,status,reason) values ($1,'draft_followup','invalid','Synthetic block')",
          [orgs.B],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("members cannot edit or delete and anonymous callers cannot read", async () => {
    await expect(
      as(db, U.ownerA, () => db.query("update email_draft_blocks set reason='Changed'")),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      as(db, U.ownerA, () => db.query("delete from email_draft_blocks")),
    ).rejects.toMatchObject({ code: "42501" });
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from email_draft_blocks")).rejects.toMatchObject({
        code: "42501",
      });
    } finally {
      await db.exec("reset role");
    }
  });
  it("stores no address and restricts surface and status to blocked drafts", async () => {
    const columns = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='email_draft_blocks' order by ordinal_position",
    );
    expect(columns.rows.map((r) => r.column_name)).toEqual([
      "id",
      "org_id",
      "surface",
      "status",
      "reason",
      "created_at",
    ]);
    await expect(
      db.query(
        "insert into email_draft_blocks(org_id,surface,status,reason) values ($1,'draft_followup','verified','Synthetic block')",
        [orgs.A],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query(
        "insert into email_draft_blocks(org_id,surface,status,reason) values ($1,'unknown','invalid','Synthetic block')",
        [orgs.A],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
