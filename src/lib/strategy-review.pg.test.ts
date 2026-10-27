// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in migrations.pg.test.ts */
// SDD-20261027 F4: runs migration 0072 (stored AI reviews) on an in-process Postgres (PGlite) with two fictional companies.
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string, B: string;
const LEADER = "00000000-0000-4000-8000-0000000000a3";
const rows = async (sql: string, params?: unknown[]) =>
  (await db.query(sql, params)).rows as Record<string, any>[];
const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "";
  } catch (e) {
    return String((e as Error).message);
  }
};
const ins = (fp = "abcd1234", extra = "", sugg = "[]") =>
  db.query(
    `insert into strategy_reviews (mode, depth, input_fingerprint, suggestions ${extra ? "," + extra.split("=")[0] : ""}) values ('normal','low',$1,$2 ${extra ? "," + extra.split("=")[1] : ""}) returning id`,
    [fp, sugg],
  );

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(
    `insert into org_members (org_id, user_id, role) values ('${A}','${LEADER}','sales_leader'); insert into profiles (id, current_org_id) values ('${LEADER}','${A}');`,
  );
  await migrate(db, ["0072_strategy_reviews.sql"]);
}, 60_000);

describe("migration 0072", () => {
  it("is additive: running it again changes nothing", async () => {
    await migrate(db, ["0072_strategy_reviews.sql"]);
    expect((await rows("select count(*)::int n from strategy_reviews"))[0]!.n).toBe(0);
  });
  it("owner and sales leader store and read a review of their company; the company and author are set by the database (CA-40)", async () => {
    await as(db, U.ownerA, async () => {
      await ins("aaaaaaaa");
    });
    await as(db, LEADER, async () => {
      await ins("bbbbbbbb");
    });
    const r = await as(db, LEADER, async () =>
      rows("select org_id, created_by from strategy_reviews order by created_at"),
    );
    expect(r.map((x: Record<string, any>) => x.org_id)).toEqual([A, A]);
  });
  it("other roles can neither read nor write reviews (price and cost stay with leaders)", async () => {
    await as(db, U.aeA, async () => {
      expect(await rows("select 1 from strategy_reviews")).toHaveLength(0);
      expect(await throws(() => ins("cccccccc"))).toMatch(/row-level security|policy/);
    });
  });
  it("another company never sees them (RLS)", async () => {
    await as(db, U.ownerB, async () =>
      expect(await rows("select 1 from strategy_reviews")).toHaveLength(0),
    );
  });
  it("is append-only for the app: no update, no delete", async () => {
    await as(db, U.ownerA, async () => {
      expect(await throws(() => db.query("update strategy_reviews set cost = 1"))).toMatch(
        /permission denied/,
      );
      expect(await throws(() => db.query("delete from strategy_reviews"))).toMatch(
        /permission denied/,
      );
    });
  });
  it("refuses more than 7 suggestions, a bad fingerprint, mode or depth, and a negative cost", async () => {
    const eight = JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ i })));
    await as(db, U.ownerA, async () => {
      expect(await throws(() => ins("dddddddd", "", eight))).toMatch(/strategy_reviews_max7/);
      expect(await throws(() => ins("short"))).toMatch(/strategy_reviews_fp/);
      expect(await throws(() => ins("eeeeeeee", "cost=-1"))).toMatch(/strategy_reviews_cost/);
      expect(
        await throws(() =>
          db.query(
            "insert into strategy_reviews (mode, depth, input_fingerprint) values ('x','low','ffffffff')",
          ),
        ),
      ).toMatch(/strategy_reviews_mode/);
      expect(
        await throws(() =>
          db.query(
            "insert into strategy_reviews (mode, depth, input_fingerprint) values ('normal','high','ffffffff')",
          ),
        ),
      ).toMatch(/strategy_reviews_depth/);
    });
  });
  it("cannot be written on behalf of another author or company", async () => {
    await as(db, U.ownerA, async () => {
      expect(
        await throws(() => ins("99999999", `created_by='${LEADER}'`.replace("'", "'"))),
      ).toMatch(/row-level security|policy/);
      expect(await throws(() => ins("88888888", `org_id='${B}'`))).toMatch(
        /row-level security|policy/,
      );
    });
  });
});
