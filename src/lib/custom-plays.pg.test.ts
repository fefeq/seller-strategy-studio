// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, build, seed, U } from "@/test/pg-harness";

// NK-0171 U-2: custom plays storage — members read their company, only the privileged client writes.
let db: Awaited<ReturnType<typeof build>>;
let orgs: { A: string; B: string };
const file = readdirSync("drizzle/migrations").find((f) => f.endsWith("_custom_plays_storage.sql"));
async function priv<T>(fn: () => Promise<T>) {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = await build();
  orgs = await seed(db);
  await db.exec(
    "alter default privileges in schema public revoke all on tables from anon, authenticated, service_role",
  );
  expect(file).toBeDefined();
  await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
}, 60000);
afterAll(async () => {
  await db?.close();
});

describe("NK-0171 custom plays storage", () => {
  it("members and owners cannot write", async () => {
    await expect(
      as(db, U.aeA, () =>
        db.query(
          "insert into custom_plays(org_id,key,name,definition) values ($1,'custom:x','X','{}')",
          [orgs.A],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      as(db, U.ownerA, () =>
        db.query(
          "insert into custom_plays(org_id,key,name,definition) values ($1,'custom:x','X','{}')",
          [orgs.A],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      as(db, U.ownerA, () =>
        db.query("insert into custom_play_costs(org_id,play_key,amount) values ($1,'custom:x',1)", [
          orgs.A,
        ]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("privileged writes; verified_only defaults off; members read only their company", async () => {
    const r = await priv(() =>
      db.query<{ id: string; verified_only: boolean }>(
        "insert into custom_plays(org_id,key,name,definition) values ($1,'custom:a','A','{}') returning id, verified_only",
        [orgs.A],
      ),
    );
    expect(r.rows[0]!.verified_only).toBe(false);
    await priv(() =>
      db.query(
        "insert into custom_plays(org_id,key,name,definition) values ($1,'custom:b','B','{}')",
        [orgs.B],
      ),
    );
    const seen = await as(db, U.aeA, () => db.query("select key from custom_plays"));
    expect(seen.rows).toEqual([{ key: "custom:a" }]);
  });
  it("key must use the custom: prefix", async () => {
    await expect(
      priv(() =>
        db.query(
          "insert into custom_plays(org_id,key,name,definition) values ($1,'plain','P','{}')",
          [orgs.A],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("evidence quotes reject emails, phones and > 280 chars", async () => {
    const { rows } = await priv(() =>
      db.query<{ id: string }>("select id from custom_plays where key='custom:a'"),
    );
    const id = rows[0]!.id;
    const ins = (q: string) =>
      priv(() =>
        db.query(
          "insert into custom_play_evidence(org_id,play_id,url,quote) values ($1,$2,'https://e.com',$3)",
          [orgs.A, id, q],
        ),
      );
    await ins("Ronda serie A anunciada");
    await expect(ins("escribe a ana@empresa.com")).rejects.toMatchObject({ code: "23514" });
    await expect(ins("llama al +34 612 345 678")).rejects.toMatchObject({ code: "23514" });
    await expect(ins("x".repeat(281))).rejects.toMatchObject({ code: "23514" });
  });
  it("deleting a play removes evidence but keeps its costs", async () => {
    await priv(() =>
      db.query("insert into custom_play_costs(org_id,play_key,amount) values ($1,'custom:a',2.5)", [
        orgs.A,
      ]),
    );
    await priv(() => db.query("delete from custom_plays where key='custom:a'"));
    const ev = await priv(() => db.query("select 1 from custom_play_evidence"));
    const co = await priv(() => db.query("select play_key from custom_play_costs"));
    expect(ev.rows).toHaveLength(0);
    expect(co.rows).toEqual([{ play_key: "custom:a" }]);
  });
});
