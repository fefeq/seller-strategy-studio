// @ts-nocheck — a plain test harness: an in-process Postgres (PGlite) with the tables, helper functions, triggers and
// policies the provenance and change-log migrations touch. The five tables, their NOT NULLs and defaults, the real
// set_audit() and positioning_copy_guard() triggers, the foreign keys into segments and the policies were read from the
// real database's catalog on 2026-10-26 (schema only, no data). It is still an in-process copy, not the database itself.
// Builds an in-process Postgres with the tables, helper functions and policies the migrations touch,
// taken from the repo (types.ts for columns, 0002 for policies and helpers, 0046 for the old trigger).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

export const REPO = process.cwd();

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
    create function public.set_audit() returns trigger language plpgsql set search_path to 'public' as $$
    begin
      if tg_op = 'INSERT' then
        new.created_by := coalesce(auth.uid(), new.created_by);
        new.org_id := coalesce(new.org_id, public.current_org());
        if new.org_id is null then raise exception 'Selecciona una empresa antes de crear datos'; end if;
      end if;
      new.updated_by := coalesce(auth.uid(), new.updated_by); new.updated_at := now(); return new;
    end $$;
  `);
  // Supabase gives anon and authenticated every privilege on new public tables: mimic it so a migration cannot rely on a bare default.
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role; alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;`);
  // The tables as the real database has them (catalog read 2026-10-26). accounts.field_sources comes from 0046 below.
  await db.exec(`
    create table public.segments (
      id uuid primary key default gen_random_uuid(), name text not null, acv_min numeric default 0, acv_max numeric,
      motion text not null default 'inside', cycle_days integer, sdr_per_ae numeric, ae_per_se numeric, cac_target numeric,
      payback_months integer, notes text default '', created_by uuid, updated_by uuid,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      org_id uuid default public.current_org(), win_rate_target numeric, ae_quota numeric, gross_margin_pct numeric, priority integer);
    create table public.accounts (
      id uuid primary key default gen_random_uuid(), name text not null, domain text, industry text, size text, tier text default 'B',
      health text default 'green', owner_id uuid, notes text default '', created_by uuid, updated_by uuid,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), is_target boolean not null default false,
      abm_tier text default '2', segment_id uuid references public.segments(id) on delete set null, org_id uuid default public.current_org(),
      country text, signals_checked_at timestamptz, linkedin_url text, auto_researched_at timestamptz);
    create table public.icp_profiles (
      id uuid primary key default gen_random_uuid(), name text not null, segment_id uuid references public.segments(id) on delete set null,
      industries text default '', company_size text default '', geography text default '', tech_stack text default '', growth_stage text default '',
      hiring_signals text default '', funding_signals text default '', adoption text default '', anti_icp text default '', why_fit text default '',
      created_by uuid, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      org_id uuid default public.current_org(), min_employees integer, max_employees integer, countries text[] not null default '{}',
      search_keywords text[] not null default '{}', target_titles text[] not null default '{}', seniorities text[] not null default '{}', pains text);
    create table public.messaging_pillars (
      id uuid primary key default gen_random_uuid(), title text not null, pain text default '', message text default '', proof text default '',
      position integer not null default 0, created_by uuid, updated_by uuid, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(), org_id uuid default public.current_org());
    create table public.positioning (
      id uuid primary key default gen_random_uuid(), best_customers text default '', alternatives text default '', differentiation text default '',
      value text default '', trend text default '', target_customer text default '', need text default '', product_name text default '',
      category text default '', key_benefit text default '', competitive_alternative text default '', differentiator text default '',
      tagline text default '', one_liner text default '', short_pitch text default '', elevator_pitch text default '', created_by uuid, updated_by uuid,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), org_id uuid default public.current_org(),
      copy_status jsonb not null default '{}');
    -- the tables that cascade or null out when a segment goes (a sample of the real foreign keys)
    create table public.account_assignment_rules (id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org(), segment_id uuid references public.segments(id) on delete cascade);
    create table public.segment_targets (id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org(), segment_id uuid not null references public.segments(id) on delete cascade, period text not null, amount numeric not null);
    create function public.positioning_copy_guard() returns trigger language plpgsql set search_path to 'public' as $$
    declare f text; old_t text; new_t text; result jsonb := coalesce(new.copy_status, '{}'::jsonb);
    begin
      foreach f in array array['tagline','one_liner','short_pitch','elevator_pitch'] loop
        old_t := coalesce(to_jsonb(old) ->> f, ''); new_t := coalesce(to_jsonb(new) ->> f, '');
        if old_t is distinct from new_t then result := result - f; end if;
      end loop;
      if auth.uid() is not null
         and exists (select 1 from jsonb_object_keys(result) k where (old.copy_status -> k) is distinct from (result -> k))
         and not (public.has_org_role(new.org_id, 'owner') or public.has_org_role(new.org_id, 'sales_leader')) then
        raise exception 'Solo el Owner o el Sales Leader pueden aprobar textos para uso externo.' using errcode = '42501';
      end if;
      new.copy_status := result; return new;
    end $$;
  `);
  await db.exec(readFileSync(`${REPO}/drizzle/migrations/0046_field_sources_auto_enrich.sql`, "utf8").split("\n").filter((l) => !l.includes("lead_settings")).join("\n"));
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
    grant select, insert, update, delete on public.account_assignment_rules, public.segment_targets to authenticated;
    create trigger positioning_copy_guard before update on public.positioning for each row execute function public.positioning_copy_guard();
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
