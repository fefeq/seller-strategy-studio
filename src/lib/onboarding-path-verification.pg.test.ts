// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
import { build, seed, as, migrate, U } from "@/test/pg-harness";
let db: Awaited<ReturnType<typeof build>>;
beforeAll(async () => {
  db = await build(); await seed(db);
  await db.exec("create schema storage; create table storage.objects(bucket_id text,name text); create table onboarding_sessions(id uuid); ");
  await migrate(db, ["0086_onboarding_sources_storage.sql"]);
  const latest = readdirSync("drizzle/migrations").filter((name) => name.endsWith("_onboarding_source_uuid_guard.sql")).sort().pop();
  if (latest) await db.exec(readFileSync(`drizzle/migrations/${latest}`, "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });
it("F9: 36 non-UUID characters return false, never a UUID cast error", async () => {
  await as(db, U.ownerA, async () => {
    for (const prefix of ["-".repeat(36), "a".repeat(36), "00000000-0000-4000-8000-00000000000g"]) {
      expect((await db.query<{ allowed: boolean }>("select onboarding_source_path_ok($1,true) as allowed", [`${prefix}/${U.ownerA}/synthetic.txt`])).rows).toEqual([{ allowed: false }]);
    }
  });
});