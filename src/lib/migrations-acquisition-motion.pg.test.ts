// @vitest-environment node
// Runs migration 0071 (segments.acquisition_motion and the template motions) on an in-process Postgres with two fictional
// companies (see src/test/pg-harness.ts for what it does and does not model). create_organization is stubbed here: the live one
// was applied before the migration history, so the stub only inserts the same segment names the real templates insert.
import { beforeAll, describe, expect, it } from "vitest";
import { build, migrate, seed } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;
const rows = async (sql: string, params?: unknown[]) =>
  // rows are free-shaped SQL results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (await db.query(sql, params)).rows as Record<string, any>[];
const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "";
  } catch (e) {
    return String((e as Error).message);
  }
};

beforeAll(async () => {
  db = await build();
  ({ A } = await seed(db));
  // A segment that exists before the migration: it must come out empty, nothing inferred.
  await db.query(
    "insert into segments (org_id, name, motion) values ($1, 'Mid-market', 'inside')",
    [A],
  );
  await migrate(db, ["0071_segment_acquisition_motion.sql"]);
}, 60_000);

describe("migration 0071: segments.acquisition_motion", () => {
  it("CA-1: existing segments stay empty and keep their sales model", async () => {
    const r = (
      await rows("select motion, acquisition_motion from segments where org_id = $1", [A])
    )[0]!;
    expect(r).toEqual({ motion: "inside", acquisition_motion: null });
  });

  it("CA-1: accepts plg, slg, marketing, partner and null; refuses anything else, including the sales-model values", async () => {
    for (const v of ["plg", "slg", "marketing", "partner"]) {
      await db.query("update segments set acquisition_motion = $1 where org_id = $2", [v, A]);
      expect(
        (await rows("select acquisition_motion from segments where org_id = $1", [A]))[0]!
          .acquisition_motion,
      ).toBe(v);
    }
    await db.query("update segments set acquisition_motion = null where org_id = $1", [A]);
    for (const v of ["inside", "field", "strategic", "PLG", ""]) {
      expect(
        await throws(() =>
          db.query("update segments set acquisition_motion = $1 where org_id = $2", [v, A]),
        ),
        v,
      ).toMatch(/segments_acquisition_motion_check/);
    }
  });

  it("is idempotent: running the migration again changes nothing", async () => {
    await migrate(db, ["0071_segment_acquisition_motion.sql"]);
    expect(
      (
        await rows("select count(*)::int as n from segments where acquisition_motion is not null")
      )[0]!.n,
    ).toBe(0);
  });
});

describe("migration 0071: template motions (CA-3)", () => {
  beforeAll(async () => {
    await db.exec(`
      alter table public.organizations add column if not exists currency text default 'EUR', add column if not exists website text;
      create or replace function public.create_organization(_name text, _segments text) returns uuid language plpgsql as $$
      declare o uuid;
      begin
        insert into public.organizations (name) values (_name) returning id into o;
        if _segments = 'low_ticket' then
          insert into public.segments (org_id, name, motion) values (o, 'Self-service', 'plg'), (o, 'Venta asistida', 'inside');
        elsif _segments = 'template' then
          insert into public.segments (org_id, name, motion) values (o, 'SMB', 'plg'), (o, 'Mid-market', 'inside'), (o, 'Enterprise', 'field'), (o, 'Strategic', 'strategic');
        end if;
        return o;
      end $$;`);
  });
  const motions = async (org: string) =>
    Object.fromEntries(
      (await rows("select name, acquisition_motion from segments where org_id = $1", [org])).map(
        (r) => [r.name, r.acquisition_motion],
      ),
    );

  it("low ticket: Self-service is plg and Venta asistida is slg", async () => {
    const o = (
      await rows("select public.create_organization_full('Ticket bajo', 'low_ticket') as id")
    )[0]!.id;
    expect(await motions(o)).toEqual({ "Self-service": "plg", "Venta asistida": "slg" });
  });

  it("ACV template: Enterprise is slg and the other segments stay empty", async () => {
    const o = (
      await rows("select public.create_organization_full('Enterprise', 'template') as id")
    )[0]!.id;
    expect(await motions(o)).toEqual({
      SMB: null,
      "Mid-market": null,
      Enterprise: "slg",
      Strategic: null,
    });
  });

  it("an empty company gets no segments, and another company's segments are never touched", async () => {
    const o = (await rows("select public.create_organization_full('Vacía', 'empty') as id"))[0]!.id;
    expect(await motions(o)).toEqual({});
    expect(await motions(A)).toEqual({ "Mid-market": null });
  });
});
