// @ts-nocheck — a plain test harness: an in-process Postgres (PGlite) with the tables, helper functions and policies the
// provenance and change-log migrations touch. Columns come from the generated types, policies and helpers from
// migrations 0002 and 0046. It is NOT the real database (no NOT NULL or defaults beyond the ones the migrations need,
// no other triggers): it proves the migrations' own logic and the RLS they rely on, not their application to production.
// Builds an in-process Postgres with the tables, helper functions and policies the migrations touch,
// taken from the repo (types.ts for columns, 0002 for policies and helpers, 0046 for the old trigger).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

export const REPO = process.cwd();
const types = readFileSync(`${REPO}/src/integrations/supabase/types.ts`, "utf8");

function ddlFor(table, skip = []) {
  const m = types.match(new RegExp(`^ {6}${table}: \\{\\n {8}Row: \\{\\n([\\s\\S]*?)\\n {8}\\}`, "m"));
  if (!m) throw new Error("no table " + table);
  const cols = [...m[1].matchAll(/^ {10}(\w+)(\??): (.+)$/gm)].filter((c) => !skip.includes(c[1]));
  const sql = cols.map(([, name, , t]) => {
    if (name === "id") return "id uuid primary key default gen_random_uuid()";
    if (name === "org_id") return "org_id uuid default public.current_org()";
    if (["created_by", "updated_by", "owner_id"].includes(name)) return `${name} uuid`;
    if (["created_at", "updated_at"].includes(name)) return `${name} timestamptz not null default now()`;
    const base = t.replace(/ \| null/, "");
    const ty = base === "Json" ? "jsonb" : base === "number" ? "numeric" : base === "boolean" ? "boolean" : base === "string[]" ? "text[]" : base.endsWith("_id") ? "uuid" : "text";
    return `${name} ${ty}`;
  });
  return `create table public.${table} (${sql.join(", ")});`;
}

export async function build() {
  const db = new PGlite();
  await db.exec(`
    create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
    grant usage on schema public to authenticated, anon, service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon, service_role;
    create type public.app_role as enum ('owner','sales_leader','marketing','sdr','ae','se','cs','deal_desk','enablement');
    create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, created_by uuid, created_at timestamptz not null default now());
    create table public.org_members (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null, role public.app_role not null default 'ae', created_at timestamptz not null default now(), unique (org_id, user_id));
    create table public.profiles (id uuid primary key, current_org_id uuid, full_name text);
    create function public.current_org() returns uuid language sql stable security definer set search_path = public as $$ select current_org_id from public.profiles where id = auth.uid() $$;
    create function public.is_org_member(_org uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.org_members where org_id = _org and user_id = auth.uid()) $$;
    create function public.has_org_role(_org uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.org_members where org_id = _org and user_id = auth.uid() and role = _role) $$;
    create function public.set_audit() returns trigger language plpgsql set search_path = public as $$
    begin
      if tg_op = 'INSERT' then new.created_by := coalesce(auth.uid(), new.created_by); end if;
      new.updated_by := coalesce(auth.uid(), new.updated_by); new.updated_at := now(); return new;
    end $$;
  `);
  // accounts as before this work: field_sources + the 0046 trigger
  await db.exec(ddlFor("accounts", ["field_sources"]));
  await db.exec(readFileSync(`${REPO}/drizzle/migrations/0046_field_sources_auto_enrich.sql`, "utf8").split("\n").filter((l) => !l.includes("lead_settings")).join("\n"));
  for (const t of ["icp_profiles", "segments", "positioning", "messaging_pillars"]) await db.exec(ddlFor(t, ["field_sources"]));
  // 0002 policies and the audit trigger, as the real tables have them
  await db.exec(`do $$ declare t text; begin
    foreach t in array array['accounts','icp_profiles','segments','positioning','messaging_pillars'] loop
      execute format('alter table public.%I enable row level security', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('grant all on public.%I to service_role', t);
      execute format('create policy "org read" on public.%I for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id))', t);
      execute format('create policy "org insert" on public.%I for insert to authenticated with check (public.is_org_member(org_id))', t);
      execute format('create policy "org update" on public.%I for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
      execute format('create policy "org delete owner" on public.%I for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, ''owner''))', t);
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit()', t || '_audit', t);
    end loop; end $$;
    grant select on public.organizations, public.org_members, public.profiles to authenticated;
  `);
  return db;
}

export async function migrate(db, files) {
  for (const f of files) await db.exec(readFileSync(`${REPO}/drizzle/migrations/${f}`, "utf8"));
}

export const U = {
  ownerA: "00000000-0000-4000-8000-0000000000a1", aeA: "00000000-0000-4000-8000-0000000000a2",
  ownerB: "00000000-0000-4000-8000-0000000000b1",
};
export async function seed(db) {
  const A = (await db.query("insert into organizations (name) values ('Empresa A') returning id")).rows[0].id;
  const B = (await db.query("insert into organizations (name) values ('Empresa B') returning id")).rows[0].id;
  await db.exec(`insert into org_members (org_id, user_id, role) values ('${A}','${U.ownerA}','owner'),('${A}','${U.aeA}','ae'),('${B}','${U.ownerB}','owner');
    insert into profiles (id, current_org_id) values ('${U.ownerA}','${A}'),('${U.aeA}','${A}'),('${U.ownerB}','${B}');`);
  return { A, B };
}

/** Runs fn as a signed-in user (authenticated role + jwt sub); null = service role (no auth.uid()). */
export async function as(db, uid, fn) {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);` : `set role service_role; select set_config('request.jwt.claim.sub', '', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
