// @vitest-environment node
// SDD-20261031-deal-won-duplicate-approvals CA-3 and CA-4d: migration 0074 on an in-process Postgres with two fictional companies.
import { beforeAll, describe, expect, it } from "vitest";
import { build, migrate, seed } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;
let B: string;
const D = "11111111-1111-4111-8111-111111111111";
const ev = (id: string) => JSON.stringify({ deal_id: id, stage: "won" });
const insert = (org: string, kind: string, status: string, evidence: string) =>
  db.query("insert into approvals (org_id, kind, title, evidence, status) values ($1,$2,'t',$3,$4)", [org, kind, evidence, status]);
const fails = async (fn: () => Promise<unknown>) => { try { await fn(); return ""; } catch (e) { return String((e as Error).message); } };

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`create table public.approvals (id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org(), kind text not null, title text not null, evidence text default '', status text not null default 'pending', decided_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
  await migrate(db, ["0074_one_pending_won_request_per_deal.sql"]);
}, 60_000);

describe("CA-3 one pending request per deal", () => {
  it("two simultaneous requests leave exactly one", async () => {
    const results = await Promise.allSettled([insert(A, "stage_change", "pending", ev(D)), insert(A, "stage_change", "pending", ev(D))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(rejected.reason.message)).toMatch(/approvals_one_pending_stage_change_per_deal|duplicate key/);
    const n = (await db.query("select count(*)::int as n from approvals where org_id = $1 and status = 'pending'", [A])).rows[0] as { n: number };
    expect(n.n).toBe(1);
  });
  it("a resolved request does not block a new one", async () => {
    await db.query("update approvals set status = 'skipped' where org_id = $1", [A]);
    expect(await fails(() => insert(A, "stage_change", "pending", ev(D)))).toBe("");
  });
  it("only stage changes are constrained: discounts and free-text evidence repeat freely", async () => {
    expect(await fails(() => insert(A, "discount", "pending", ev(D)))).toBe("");
    expect(await fails(() => insert(A, "discount", "pending", ev(D)))).toBe("");
    expect(await fails(() => insert(A, "stage_change", "pending", "texto libre"))).toBe("");
    expect(await fails(() => insert(A, "stage_change", "pending", "texto libre"))).toBe("");
  });
});

describe("CA-4d companies are isolated", () => {
  it("the same deal id pending in another company does not collide", async () => {
    expect(await fails(() => insert(B, "stage_change", "pending", ev(D)))).toBe("");
  });
});
