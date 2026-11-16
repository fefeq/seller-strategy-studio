// @vitest-environment node
// NK-0174 SDD 2 R-5: replies are private to whoever linked the mailbox; marks are read by members, written only by the server.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { as, build, seed, U } from "@/test/pg-harness";

let db: Awaited<ReturnType<typeof build>>;
let A: string;
beforeEach(async () => {
  db = await build();
  ({ A } = await seed(db));
  await db.exec(
    "create table mailbox_links(org_id uuid primary key, user_id uuid, address text, status text);",
  );
  await db.exec(readFileSync("drizzle/migrations/0098_reply_inbox_sync.sql", "utf8"));
  await db.query(
    "insert into inbox_replies(org_id,user_id,gmail_id,received_at,kind) values($1,$2,'g1',now(),'human')",
    [A, U.aeA],
  );
  await db.query(
    "insert into lead_replied_marks(org_id,lead_id,replied_at) values($1,gen_random_uuid(),now())",
    [A],
  );
}, 60000);
afterEach(async () => {
  await db?.close();
});

it("only the person who linked reads replies; an Owner of the same company reads 0", async () => {
  expect(
    (await as(db, U.aeA, () => db.query("select gmail_id from inbox_replies"))).rows,
  ).toHaveLength(1);
  expect(
    (await as(db, U.ownerA, () => db.query("select gmail_id from inbox_replies"))).rows,
  ).toHaveLength(0);
});
it("members read marks, other companies do not, and nobody signed in can write them", async () => {
  expect(
    (await as(db, U.ownerA, () => db.query("select * from lead_replied_marks"))).rows,
  ).toHaveLength(1);
  expect(
    (await as(db, U.ownerB, () => db.query("select * from lead_replied_marks"))).rows,
  ).toHaveLength(0);
  await expect(
    as(db, U.ownerA, () =>
      db.query(
        "insert into lead_replied_marks(org_id,lead_id,replied_at) values($1,gen_random_uuid(),now())",
        [A],
      ),
    ),
  ).rejects.toThrow();
  await expect(
    as(db, U.aeA, () =>
      db.query(
        "insert into inbox_replies(org_id,user_id,gmail_id,received_at,kind) values($1,$2,'g2',now(),'human')",
        [A, U.aeA],
      ),
    ),
  ).rejects.toThrow();
});
