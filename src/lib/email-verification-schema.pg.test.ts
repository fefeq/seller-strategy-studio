// @vitest-environment node
import { readFileSync, existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { as, build, seed, U } from "@/test/pg-harness";
let world: Awaited<ReturnType<typeof build>>;
let orgs: { A: string; B: string };
beforeAll(async () => {
  world = await build();
  orgs = await seed(world);
  await world.exec(`create table public.people(id uuid primary key default gen_random_uuid(),org_id uuid,email text);
    create table public.leads(id uuid primary key default gen_random_uuid(),org_id uuid,email text);
    create table public.stakeholders(id uuid primary key default gen_random_uuid(),org_id uuid,email text);`);
  const path = "drizzle/migrations/0089_email_verification_model.sql";
  if (existsSync(path)) await world.exec(readFileSync(path, "utf8"));
}, 60000);
describe("NK-0173 CA-6 verification isolation and retention", () => {
  it("only reads current-company rows and cannot forge verified from the browser", async () => {
    await world.query("insert into email_verifications(org_id,email,status,checked_at,provider,source) values ($1,'synthetic@example.invalid','verified',now(),'apollo','revelado_apollo'),($2,'other@example.invalid','verified',now(),'apollo','revelado_apollo')", [orgs.A, orgs.B]);
    const rows = await as(world, U.aeA, () => world.query("select email from email_verifications"));
    expect(rows.rows).toEqual([{ email: "synthetic@example.invalid" }]);
    await expect(as(world, U.aeA, () => world.query("update email_verifications set status='invalid'"))).rejects.toMatchObject({ code: "42501" });
    await expect(as(world, U.ownerA, () => world.query("insert into email_verifications(email,status,checked_at,provider,source) values ('forged@example.invalid','verified',now(),'apollo','revelado_apollo')"))).rejects.toMatchObject({ code: "42501" });
  });
  it("retains a shared address until the last contact changes or is deleted, then cascades with the company", async () => {
    await world.query("insert into people(org_id,email) values ($1,' SYNTHETIC@EXAMPLE.INVALID ')", [orgs.A]);
    await world.query("insert into stakeholders(org_id,email) values ($1,'synthetic@example.invalid')", [orgs.A]);
    await world.query("insert into leads(org_id,email) values ($1,'synthetic@example.invalid')", [orgs.A]);
    await world.query("delete from people where org_id=$1", [orgs.A]);
    await world.query("update stakeholders set email='new@example.invalid' where org_id=$1", [orgs.A]);
    expect((await world.query("select count(*)::int n from email_verifications where org_id=$1", [orgs.A])).rows).toEqual([{ n: 1 }]);
    await world.query("delete from leads where org_id=$1", [orgs.A]);
    expect((await world.query("select count(*)::int n from email_verifications where org_id=$1", [orgs.A])).rows).toEqual([{ n: 0 }]);
    await world.query("delete from organizations where id=$1", [orgs.B]);
    expect((await world.query("select count(*)::int n from email_verifications where org_id=$1", [orgs.B])).rows).toEqual([{ n: 0 }]);
  });
});