// @vitest-environment node
// SDD-20261031-ux-move-without-drag CA-16: «Deshacer» only writes if the stage is still the one that was moved to.
import { beforeAll, describe, expect, it } from "vitest";
import { build, seed } from "@/test/pg-harness";
import { undoDeal, undoLead } from "@/lib/board-move";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;

beforeAll(async () => {
  db = await build();
  ({ A } = await seed(db));
  await db.exec(`create table public.deals (id uuid primary key default gen_random_uuid(), org_id uuid, stage text not null, probability int);
    create table public.leads (id uuid primary key default gen_random_uuid(), org_id uuid, stage text not null);`);
}, 60_000);

async function undo(table: "deals" | "leads", id: string, plan: { patch: Record<string, unknown>; onlyIfStage: string }) {
  const keys = Object.keys(plan.patch);
  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
  return (await db.query(`update public.${table} set ${sets} where id = $1 and stage = $2 returning id`, [id, plan.onlyIfStage, ...keys.map((k) => plan.patch[k])])).rows;
}

describe("CA-16 deal", () => {
  it("restores stage and the hand-edited probability when nobody touched it", async () => {
    const id = ((await db.query("insert into deals (org_id, stage, probability) values ($1,'proposal',25) returning id", [A])).rows[0] as { id: string }).id;
    const rows = await undo("deals", id, undoDeal({ prevStage: "qualified", prevProbability: 37, movedTo: "proposal" }));
    expect(rows).toHaveLength(1);
    expect((await db.query("select stage, probability from deals where id = $1", [id])).rows[0]).toEqual({ stage: "qualified", probability: 37 });
  });
  it("does nothing if someone moved it again meanwhile", async () => {
    const id = ((await db.query("insert into deals (org_id, stage, probability) values ($1,'negotiation',60) returning id", [A])).rows[0] as { id: string }).id;
    const rows = await undo("deals", id, undoDeal({ prevStage: "qualified", prevProbability: 37, movedTo: "proposal" }));
    expect(rows).toHaveLength(0);
    expect((await db.query("select stage, probability from deals where id = $1", [id])).rows[0]).toEqual({ stage: "negotiation", probability: 60 });
  });
});

describe("CA-16 lead", () => {
  it("restores the previous stage only if it is still the moved one", async () => {
    const id = ((await db.query("insert into leads (org_id, stage) values ($1,'mql') returning id", [A])).rows[0] as { id: string }).id;
    expect(await undo("leads", id, undoLead({ prevStage: "contacted", movedTo: "sql" }))).toHaveLength(0);
    expect(await undo("leads", id, undoLead({ prevStage: "contacted", movedTo: "mql" }))).toHaveLength(1);
    expect(((await db.query("select stage from leads where id = $1", [id])).rows[0] as { stage: string }).stage).toBe("contacted");
  });
});
