// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back from SQL untyped, as in migrations.pg.test.ts */
// SDD-20261027 F2: runs migration 0065 on an in-process Postgres (PGlite) with fictional companies. Never touches a real database.
// gtm_experiments below copies the columns and policies of migration 0003, reduced to what 0065 touches.
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db; let A: string; let oldId: string;
const rows = async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows as Record<string, any>[];
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return ""; } catch (e) { return String((e as Error).message); } };

beforeAll(async () => {
  db = await build();
  ({ A } = await seed(db));
  await db.exec(`
    create table public.gtm_experiments (
      id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
      title text not null default 'Nuevo prototipo', hypothesis text not null default '', prototype text not null default '', audience text not null default '',
      metric text not null default '', target text not null default '', result text not null default '', learning text not null default '',
      status text not null default 'idea' check (status in ('idea','running','learned','adopted','discarded')), starts_on date, ends_on date,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    grant select, insert, update, delete on public.gtm_experiments to authenticated; grant all on public.gtm_experiments to service_role;
    alter table public.gtm_experiments enable row level security;
    create policy "org read" on public.gtm_experiments for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id));
    create policy "org insert" on public.gtm_experiments for insert to authenticated with check (public.is_org_member(org_id));
    create policy "org update" on public.gtm_experiments for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id));
  `);
  oldId = (await rows(`insert into gtm_experiments (org_id, title, hypothesis, metric, target, result, learning, status, starts_on, ends_on) values ('${A}','Prueba vieja','Creemos que sí','respuesta','8 %','6 %','Aprendimos','learned','2026-01-01','2026-02-01') returning id`))[0]!.id;
  await migrate(db, ["0065_experiment_close_rule.sql"]);
}, 60_000);

describe("CA-31: existing experiments keep their data, with the new fields empty", () => {
  it("every old value is intact and the new columns are empty", async () => {
    const e = (await rows("select * from gtm_experiments where id = $1", [oldId]))[0]!;
    expect(e).toMatchObject({ title: "Prueba vieja", hypothesis: "Creemos que sí", metric: "respuesta", target: "8 %", result: "6 %", learning: "Aprendimos", status: "learned", success_threshold: "", close_rule: "", review_on: null, decision: null, decided_at: null, decided_by: null, change_element: null, change_note: "" });
  });
  it("running the migration again changes nothing", async () => {
    await migrate(db, ["0065_experiment_close_rule.sql"]);
    expect((await rows("select count(*)::int n from gtm_experiments"))[0]!.n).toBe(1);
  });
});

describe("CA-26/29 stored values are validated by the database", () => {
  it("a member saves criteria, review date and decision; the lists and lengths are enforced", async () => {
    await as(db, U.aeA, async () => {
      await db.query("update gtm_experiments set success_threshold = '8 %', close_rule = 'a los 30 días', review_on = '2026-11-10' where id = $1", [oldId]);
      await db.query("update gtm_experiments set decision = 'scale', change_element = 'icp', change_note = 'Ampliar' where id = $1", [oldId]);
      expect(await throws(() => db.query("update gtm_experiments set decision = 'parar' where id = $1", [oldId]))).toMatch(/decision/);
      expect(await throws(() => db.query("update gtm_experiments set change_element = 'precio' where id = $1", [oldId]))).toMatch(/change_element/);
      expect(await throws(() => db.query("update gtm_experiments set close_rule = $2 where id = $1", [oldId, "x".repeat(501)]))).toMatch(/texts_len/);
    });
    expect((await rows("select decision, review_on::text r, close_rule from gtm_experiments where id = $1", [oldId]))[0]).toEqual({ decision: "scale", r: "2026-11-10", close_rule: "a los 30 días" });
  });
  it("another company cannot read or change them (RLS unchanged)", async () => {
    await as(db, U.ownerB, async () => {
      expect((await rows("select id from gtm_experiments where id = $1", [oldId])).length).toBe(0);
      await db.query("update gtm_experiments set close_rule = 'x' where id = $1", [oldId]);
    });
    expect((await rows("select close_rule from gtm_experiments where id = $1", [oldId]))[0]!.close_rule).toBe("a los 30 días");
  });
});
