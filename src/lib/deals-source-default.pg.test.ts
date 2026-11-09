// @vitest-environment node
// SDD-20261109-deals-no-source U-1 (NK-0107) CA-1 and CA-2: migration 0083 drops the default 'outbound' of deals.source, on an
// in-process Postgres (PGlite) with fictional rows. Never touches a real database.
// Only a reduced deals table is created, with the column as 0001 left it (source text default 'outbound'). The lead trigger of 0012 is
// not replicated: 0083 does not touch that function and its coalesce(new.source, 'Entrada de leads') does not read the default.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const FILE = "drizzle/migrations/0083_deals_source_no_default.sql";
let db: PGlite;
const sql = () => readFileSync(`${process.cwd()}/${FILE}`, "utf8");
const defaultOf = async () =>
  (
    await db.query<{ column_default: string | null }>(
      "select column_default from information_schema.columns where table_schema = 'public' and table_name = 'deals' and column_name = 'source'",
    )
  ).rows[0]!.column_default;
const sources = async () =>
  (
    await db.query<{ name: string; source: string | null }>(
      "select name, source from public.deals order by name",
    )
  ).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    create table public.deals (
      id uuid primary key default gen_random_uuid(), name text not null, stage text not null default 'discovery',
      source text default 'outbound');
    insert into public.deals (name) values ('Deal por defecto');
    insert into public.deals (name, source) values ('Deal inbound', 'inbound'), ('Deal sin origen', null), ('Deal libre', 'Entrada de leads');
  `);
}, 60_000);

describe("migration 0083: deals.source has no default", () => {
  it("control, before the migration: an insert without source is stored as outbound", async () => {
    await db.query("insert into public.deals (name) values ('Antes de la migración')");
    const r = await db.query<{ source: string | null }>(
      "select source from public.deals where name = 'Antes de la migración'",
    );
    expect(r.rows[0]!.source).toBe("outbound");
    expect(await defaultOf()).toMatch(/outbound/);
  });

  let before: unknown;
  it("CA-1: after it, an insert without source is null; an explicit source is kept; no existing row changes", async () => {
    await db.query("delete from public.deals where name = 'Antes de la migración'");
    before = await sources();
    await db.exec(sql());
    expect(await defaultOf()).toBeNull();
    await db.query("insert into public.deals (name) values ('Después, sin source')");
    await db.query(
      "insert into public.deals (name, source) values ('Después, inbound', 'inbound')",
    );
    const after = await sources();
    expect(after.find((r) => r.name === "Después, sin source")!.source).toBeNull();
    expect(after.find((r) => r.name === "Después, inbound")!.source).toBe("inbound");
    expect(after.filter((r) => !r.name.startsWith("Después"))).toEqual(before);
  });

  it("CA-1: applying it twice does not fail", async () => {
    await db.exec(sql());
    expect(await defaultOf()).toBeNull();
  });

  it("CA-2: the commented rollback puts default 'outbound' back, in the same database", async () => {
    const rollback = sql()
      .split("\n")
      .filter((l) => /^--\s*rollback:/i.test(l))
      .map((l) => l.replace(/^--\s*rollback:\s*/i, ""))
      .join("\n");
    expect(rollback).toMatch(/set default 'outbound'/);
    await db.exec(rollback);
    expect(await defaultOf()).toMatch(/outbound/);
    await db.query("insert into public.deals (name) values ('Tras la vuelta atrás')");
    const r = await db.query<{ source: string | null }>(
      "select source from public.deals where name = 'Tras la vuelta atrás'",
    );
    expect(r.rows[0]!.source).toBe("outbound");
  });
});
