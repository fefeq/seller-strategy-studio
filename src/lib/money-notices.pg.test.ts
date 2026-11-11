// @vitest-environment node
// SDD-20261030 money-moment-notices (NK-0030): runs migration 0078 (money notices for a lead reaching SQL and a deal turning Ganado)
// on an in-process Postgres (PGlite) with fictional companies and people. Never touches a real database.
// The harness (src/test/pg-harness.ts) is a replica. Everything below it is defined here, reduced to what 0078 touches:
// notifications (0049/0050 + the live CHECK names), leads (0012), deals (0000/0001), deal_stage_history, and the functions
// lead_stage_change, track_deal_changes and deals_stage_check. The three functions are a RECONSTRUCTION from migrations 0012 and
// 0002 plus the deltas of SDD §3 (the live text is not kept in the repo and was not read), not the live definitions.
// Not replicated: deals_audit, deals_lines_guard, deals_slip, deals_stamp_human_edit, deal_lines, lead_sources, people, deal_stages.
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { as, build, REPO, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
type Row = Record<string, string | number | boolean | Date | null>;
const MIGRATION = "0078_money_moment_notices.sql";
const HARDENING = "0079_money_notices_hardening.sql";

const V = {
  slA: "00000000-0000-4000-8000-0000000000a3", // Sales Leader of A
  repA: "00000000-0000-4000-8000-0000000000a4", // plain member of A, never responsible in the tests
  exA: "00000000-0000-4000-8000-0000000000a5", // used to be in A, no longer a member
  ownerC: "00000000-0000-4000-8000-0000000000c1", // owner of the company that gets archived
};
const LEAD = {
  title: "Hay leads nuevos en SQL.",
  body: "Míralos en Leads.",
  link: "/leads?vista=lista",
};
const DEAL = {
  title: "Hay deals nuevos como Ganados.",
  body: "Míralos en Pipeline.",
  link: "/deals",
};

const SCHEMA = `
  alter table public.organizations add column archived_at timestamptz;
  -- Supabase also grants EXECUTE on new public functions to anon, authenticated and service_role: mimic it, so a migration cannot
  -- rely on the bare PUBLIC default (the revoke in 0078 must name each role).
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
    user_id uuid not null, job_id uuid,
    kind text not null constraint notifications_kind_check check (kind = any (array['done','failed','needs_decision','autopilot'])),
    title text not null constraint notifications_title_check check (length(title) <= 300),
    body text constraint notifications_body_check check (length(body) <= 1000),
    link text constraint notifications_link_check check (length(link) <= 500),
    read_at timestamptz, telegram_sent_at timestamptz, created_at timestamptz not null default now());
  -- the live database has no INSERT policy and authenticated only has select and update (0049): inserting needs service_role or security definer
  revoke all on public.notifications from authenticated;
  grant select, update on public.notifications to authenticated;
  alter table public.notifications enable row level security;
  create policy "own read" on public.notifications for select to authenticated using (user_id = auth.uid() and public.is_org_member(org_id));

  create table public.deals (
    id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
    account_id uuid references public.accounts(id) on delete set null, name text not null, stage text not null, amount numeric default 0,
    probability int, owner_id uuid, source text, segment_id uuid, lead_source_id uuid, external_id text, closed_at timestamptz,
    created_by uuid, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table public.leads (
    id uuid primary key default gen_random_uuid(), org_id uuid default public.current_org() references public.organizations(id) on delete cascade,
    company text not null, contact_name text, email text, title text, account_id uuid references public.accounts(id) on delete set null,
    deal_id uuid references public.deals(id) on delete set null,
    stage text not null default 'new' check (stage in ('new','contacted','mql','sql','opportunity','disqualified')),
    source text, lead_source_id uuid, segment_id uuid, owner_id uuid, external_id text, amount numeric, next_step text not null default '',
    notes text not null default '', stage_entered_at timestamptz not null default now(), contacted_at timestamptz, mql_at timestamptz,
    sql_at timestamptz, opportunity_at timestamptz, disqualified_at timestamptz, created_by uuid, updated_by uuid,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table public.deal_stage_history (
    id uuid primary key default gen_random_uuid(), deal_id uuid not null references public.deals(id) on delete cascade,
    from_stage text, to_stage text not null, changed_at timestamptz not null default now(), changed_by uuid, org_id uuid);

  -- RLS as the live leads and deals have it (SDD §3)
  do $$ declare t text; begin
    foreach t in array array['leads','deals'] loop
      execute format('alter table public.%I enable row level security', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('create policy "org read" on public.%I for select to authenticated using (org_id = public.current_org() and public.is_org_member(org_id))', t);
      execute format('create policy "org insert" on public.%I for insert to authenticated with check (public.is_org_member(org_id))', t);
      execute format('create policy "org update" on public.%I for update to authenticated using (org_id = public.current_org() and public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
      execute format('create policy "org delete owner" on public.%I for delete to authenticated using (org_id = public.current_org() and public.has_org_role(org_id, ''owner''))', t);
    end loop; end $$;
  create trigger leads_audit before insert or update on public.leads for each row execute function public.set_audit();

  -- RECONSTRUCTION of lead_stage_change: 0012 plus the delta (to opportunity it creates the deal with stage and probability null)
  create function public.lead_stage_change() returns trigger language plpgsql set search_path = public as $$
  declare ord text[] := array['new','contacted','mql','sql','opportunity']; idx int; t timestamptz;
  begin
    if tg_op = 'INSERT' or new.stage is distinct from old.stage then
      t := case when tg_op = 'INSERT' then coalesce(new.created_at, now()) else now() end;
      new.stage_entered_at := t;
      idx := coalesce(array_position(ord, new.stage), 0);
      if idx >= 2 then new.contacted_at := coalesce(new.contacted_at, t); end if;
      if idx >= 3 then new.mql_at := coalesce(new.mql_at, t); end if;
      if idx >= 4 then new.sql_at := coalesce(new.sql_at, t); end if;
      if idx >= 5 then new.opportunity_at := coalesce(new.opportunity_at, t); end if;
      if new.stage = 'disqualified' then new.disqualified_at := t; else new.disqualified_at := null; end if;
    end if;
    if new.stage = 'opportunity' and new.deal_id is null then
      if new.account_id is null then
        insert into public.accounts (org_id, name) values (new.org_id, new.company) returning id into new.account_id;
      end if;
      insert into public.deals (org_id, account_id, name, stage, probability, amount, source, segment_id, owner_id, lead_source_id, external_id)
      values (new.org_id, new.account_id, new.company, null, null, new.amount, coalesce(new.source, 'Entrada de leads'), new.segment_id, new.owner_id, new.lead_source_id, null)
      returning id into new.deal_id;
    end if;
    return new;
  end $$;
  create trigger leads_stage before insert or update on public.leads for each row execute function public.lead_stage_change();

  -- RECONSTRUCTION of deals_stage_check (BEFORE INSERT OR UPDATE OF stage): completes the initial stage the way 0012 created deals
  create function public.deals_stage_check() returns trigger language plpgsql set search_path = public as $$
  begin
    new.stage := coalesce(new.stage, 'discovery');
    new.probability := coalesce(new.probability, 10);
    return new;
  end $$;
  create trigger deals_stage_check before insert or update of stage on public.deals for each row execute function public.deals_stage_check();

  -- RECONSTRUCTION of track_deal_changes: 0002 plus the delta (org_id in the history). No closed_at on insert; on update only if empty.
  create function public.track_deal_changes() returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if tg_op = 'INSERT' then
      insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_by, org_id) values (new.id, null, new.stage, auth.uid(), new.org_id);
      return new;
    end if;
    if new.stage is distinct from old.stage then
      insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_by, org_id) values (new.id, old.stage, new.stage, auth.uid(), new.org_id);
      if new.stage in ('won','lost') then
        update public.deals set closed_at = now() where id = new.id and closed_at is null;
      end if;
    end if;
    return new;
  end $$;
  create trigger deals_track after insert or update on public.deals for each row execute function public.track_deal_changes();
`;

async function world(withMigration: boolean) {
  const db = await build();
  const { A, B } = await seed(db);
  await db.exec(SCHEMA);
  const C = (
    (await db.query("insert into organizations (name) values ('Empresa C') returning id"))
      .rows[0] as { id: string }
  ).id;
  const D = (
    (
      await db.query(
        "insert into organizations (name) values ('Empresa D sin miembros') returning id",
      )
    ).rows[0] as { id: string }
  ).id;
  await db.exec(`insert into org_members (org_id, user_id, role) values ('${A}','${V.slA}','sales_leader'),('${A}','${V.repA}','ae'),('${C}','${V.ownerC}','owner');
    insert into profiles (id, current_org_id) values ('${V.slA}','${A}'),('${V.repA}','${A}'),('${V.exA}','${A}'),('${V.ownerC}','${C}');`);
  if (withMigration) {
    await db.exec(readFileSync(`${REPO}/drizzle/migrations/${MIGRATION}`, "utf8"));
    await db.exec(readFileSync(`${REPO}/drizzle/migrations/${HARDENING}`, "utf8"));
  }
  return { db, A, B, C, D };
}

describe("U-1 harness smoke (runs without the migration)", () => {
  let db: Db;
  let A: string;
  beforeAll(async () => {
    ({ db, A } = await world(false));
  });

  it("the replica builds, stamps the SQL time as authenticated and creates the deal with the initial stage", async () => {
    const lead = await as(
      db,
      U.ownerA,
      async () =>
        (
          await db.query<Row>(
            "insert into leads (org_id, company, stage) values ($1,'Lead ficticio','sql') returning sql_at, mql_at",
            [A],
          )
        ).rows[0]!,
    );
    expect(lead["sql_at"]).not.toBeNull();
    expect(lead["mql_at"]).not.toBeNull();
    await as(db, U.ownerA, async () =>
      db.query("update leads set stage = 'opportunity' where company = 'Lead ficticio'"),
    );
    const deal = (
      await db.query<Row>(
        "select d.stage, d.probability, d.closed_at from deals d join leads l on l.deal_id = d.id",
      )
    ).rows[0];
    expect(deal).toMatchObject({ stage: "discovery", probability: 10, closed_at: null });
    // deals_track: history carries org_id and closed_at is only stamped by an update to won
    await db.exec(`insert into deals (org_id, name, stage) values ('${A}','Deal ficticio','won')`);
    const won = (
      await db.query<Row>(
        "select closed_at, (select org_id from deal_stage_history h where h.deal_id = d.id) as hist_org from deals d where name = 'Deal ficticio'",
      )
    ).rows[0]!;
    expect(won["closed_at"]).toBeNull();
    expect(won["hist_org"]).toBe(A);
  });
});

describe("money notices (migration 0078)", () => {
  let db: Db;
  let A: string, B: string, C: string, D: string;
  const rows = async (sql: string, params?: unknown[]) => (await db.query<Row>(sql, params)).rows;
  const notices = () =>
    rows(
      "select user_id, org_id, kind, title, body, link, dedupe_key from notifications order by user_id",
    );
  const who = async () => (await notices()).map((n) => n.user_id).sort();
  const sorted = (...ids: string[]) => [...ids].sort();
  const failure = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return "";
    } catch (e) {
      return String((e as Error).message);
    }
  };
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  /** Runs a statement as a signed-in user (uid) or as service_role (null) so the trigger is exercised with the privileges of each path. */
  const write = (uid: string | null, sql: string, params?: unknown[]) =>
    as(db, uid, () => db.query(sql, params));
  const newLead = (
    uid: string | null,
    stage: string,
    o: { org?: string | null; owner?: string | null; created?: string; company?: string } = {},
  ) =>
    write(
      uid,
      "insert into leads (org_id, company, stage, owner_id, created_at) values ($1,$2,$3,$4,$5) returning id",
      [
        o.org === undefined ? A : o.org,
        o.company ?? "Lead ficticio",
        stage,
        o.owner ?? null,
        o.created ?? new Date().toISOString(),
      ],
    ).then((r) => String(r.rows[0]!["id"]));
  const newDeal = (
    uid: string | null,
    stage: string,
    o: { org?: string; owner?: string | null; closed?: string | null } = {},
  ) =>
    write(
      uid,
      "insert into deals (org_id, name, stage, owner_id, closed_at) values ($1,'Deal ficticio',$2,$3,$4) returning id",
      [o.org ?? A, stage, o.owner ?? null, o.closed ?? null],
    ).then((r) => String(r.rows[0]!["id"]));
  const clear = () => db.exec("delete from notifications");

  beforeAll(async () => {
    ({ db, A, B, C, D } = await world(true));
  });
  beforeEach(async () => {
    await db.exec(
      "reset role; truncate notifications, deal_stage_history, leads, deals cascade; update organizations set archived_at = null",
    );
  });

  it("CA-1: a lead entering SQL notifies Owner, Sales Leader and the responsible, as authenticated and as service_role, even with an old creation date", async () => {
    // the replica must not be more permissive than the live database: authenticated cannot insert notices by itself
    expect(
      await failure(() =>
        write(
          U.ownerA,
          "insert into notifications (org_id, user_id, kind, title) values ($1,$2,'done','x')",
          [A, U.ownerA],
        ),
      ),
    ).toMatch(/permission denied/);
    const expected = sorted(U.ownerA, V.slA, U.aeA);
    for (const writer of [U.ownerA, null] as const) {
      for (const path of ["insert", "update"] as const) {
        await clear();
        await db.exec("truncate leads cascade");
        if (path === "insert")
          await newLead(writer, "sql", { owner: U.aeA, created: "2020-01-02T03:04:05Z" });
        else {
          const id = await newLead(writer, "mql", {
            owner: U.aeA,
            created: "2020-01-02T03:04:05Z",
          });
          expect(await notices()).toHaveLength(0);
          await write(writer, "update leads set stage = 'sql' where id = $1", [id]);
        }
        const got = await notices();
        expect({ writer, path, users: got.map((n) => n.user_id).sort() }).toEqual({
          writer,
          path,
          users: expected,
        });
        expect(got.every((n) => n.kind === "money" && n.org_id === A)).toBe(true);
      }
    }
  });

  it("CA-2: no notice when a lead already in SQL gets another field updated or moves to another stage", async () => {
    const id = await newLead(U.ownerA, "sql", { owner: U.aeA });
    expect(await notices()).toHaveLength(3); // positive control
    await clear();
    await write(U.ownerA, "update leads set notes = 'otra nota' where id = $1", [id]);
    await write(U.ownerA, "update leads set stage = 'sql', next_step = 'llamar' where id = $1", [
      id,
    ]);
    await write(U.ownerA, "update leads set stage = 'mql' where id = $1", [id]);
    await write(U.ownerA, "update leads set stage = 'contacted' where id = $1", [id]);
    expect(await notices()).toHaveLength(0);
  });

  it("CA-3: a responsible who is also Owner or Sales Leader gets one notice", async () => {
    await newLead(U.ownerA, "sql", { owner: U.ownerA });
    const got = await who();
    expect(got).toEqual(sorted(U.ownerA, V.slA));
    await clear();
    await newLead(U.ownerA, "contacted", { owner: V.slA }).then((id) =>
      write(U.ownerA, "update leads set stage = 'sql' where id = $1", [id]),
    );
    expect(await who()).toEqual(sorted(U.ownerA, V.slA));
    await clear();
    await newLead(U.ownerA, "sql", { owner: U.aeA }); // control: a distinct responsible adds a third person
    expect(await who()).toEqual(sorted(U.ownerA, V.slA, U.aeA));
  });

  it("CA-4: a deal turning won, inserted or updated, with a recent close notifies the same people", async () => {
    const expected = sorted(U.ownerA, V.slA, U.aeA);
    for (const writer of [U.ownerA, null] as const) {
      await clear();
      await newDeal(writer, "won", { owner: U.aeA, closed: ago(2) });
      expect(await who()).toEqual(expected);
      await clear();
      await newDeal(writer, "won", { owner: U.aeA }); // an agent or MCP inserting it already won, without closed_at
      expect(await who()).toEqual(expected);
      await clear();
      const id = await newDeal(writer, "negotiation", { owner: U.aeA });
      expect(await notices()).toHaveLength(0);
      await write(writer, "update deals set stage = 'won' where id = $1", [id]);
      expect(await who()).toEqual(expected);
      await clear();
      const id2 = await newDeal(writer, "negotiation", { owner: U.aeA });
      await write(writer, "update deals set stage = 'won', closed_at = $2 where id = $1", [
        id2,
        ago(23),
      ]);
      expect(await who()).toEqual(expected);
    }
  });

  it("CA-5: no notice for an already won deal that is updated (closed_at rewrite included) or for a close older than 24 h", async () => {
    const id = await newDeal(U.ownerA, "won", { owner: U.aeA, closed: ago(1) });
    expect(await notices()).toHaveLength(3); // positive control
    await clear();
    await write(U.ownerA, "update deals set amount = 10 where id = $1", [id]);
    await write(U.ownerA, "update deals set closed_at = $2 where id = $1", [id, ago(0.5)]);
    await write(U.ownerA, "update deals set stage = 'won', closed_at = $2 where id = $1", [
      id,
      ago(3),
    ]);
    expect(await notices()).toHaveLength(0);
    await newDeal(U.ownerA, "won", { owner: U.aeA, closed: ago(24 * 3) }); // imported history
    const open = await newDeal(U.ownerA, "negotiation", { owner: U.aeA });
    await write(U.ownerA, "update deals set stage = 'won', closed_at = $2 where id = $1", [
      open,
      ago(25),
    ]);
    expect(await notices()).toHaveLength(0);
    await newDeal(null, "won", { owner: U.aeA, closed: ago(24.1) }); // six minutes outside the window
    expect(await notices()).toHaveLength(0);
    await newDeal(null, "won", { owner: U.aeA, closed: ago(23.9) }); // six minutes inside the window
    expect(await notices()).toHaveLength(3);
  });

  it("CA-6: a deal reopened and won again with its old closed_at untouched notifies; the first old win does not", async () => {
    const id = await newDeal(U.ownerA, "won", { owner: U.aeA, closed: ago(24 * 3) });
    expect(await notices()).toHaveLength(0);
    await write(U.ownerA, "update deals set stage = 'negotiation' where id = $1", [id]);
    expect(await notices()).toHaveLength(0);
    await write(U.ownerA, "update deals set stage = 'won' where id = $1", [id]);
    expect(
      (
        await rows(
          "select closed_at < now() - interval '48 hours' as old from deals where id = $1",
          [id],
        )
      )[0]!.old,
    ).toBe(true);
    expect(await who()).toEqual(sorted(U.ownerA, V.slA, U.aeA));
  });

  it("0079: the trigger functions are closed to public, anon and authenticated, and the triggers still notify", async () => {
    for (const fn of ["money_lead_sql_trg()", "money_deal_won_trg()"]) {
      for (const role of ["anon", "authenticated"]) {
        const r = await db.query<Row>("select has_function_privilege($1, $2, 'execute') as ok", [
          role,
          `public.${fn}`,
        ]);
        expect(r.rows[0]!["ok"]).toBe(false);
      }
    }
    // control: a write by authenticated still reaches money_notify through the triggers
    await write(
      U.ownerA,
      "insert into leads (org_id, company, stage) values ($1, 'Lead ficticio', 'sql')",
      [A],
    );
    expect((await notices()).length).toBeGreaterThan(0);
  });

  it("0078 and 0079 can be applied again without failing and leave one trigger of each", async () => {
    await db.exec(readFileSync(`${REPO}/drizzle/migrations/${MIGRATION}`, "utf8"));
    await db.exec(readFileSync(`${REPO}/drizzle/migrations/${HARDENING}`, "utf8"));
    const n = await db.query<Row>(
      "select count(*)::int as n from pg_trigger where tgname like 'money\\_%' and not tgisinternal",
    );
    expect(n.rows[0]!["n"]).toBe(4);
  });

  it("money_notify cannot be executed by authenticated or anon (the revoke is what keeps callers from forging notices)", async () => {
    const call = "select public.money_notify($1, 'lead_sql', gen_random_uuid(), null)";
    expect(await failure(() => write(U.ownerA, call, [A]))).toMatch(/permission denied/);
    await db.exec("set role anon");
    try {
      expect(await failure(() => db.query(call, [A]))).toMatch(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    expect(await notices()).toHaveLength(0);
    await db.query(call, [A]); // control: the owner of the function can, and the notice is written
    expect(await notices()).toHaveLength(2);
  });

  it("CA-7: at most one notice per person, type, company and hour; another hour or type creates a new one", async () => {
    const money = (org: string, kind: string, at: string) =>
      db.query("select public.money_notify($1, $2, gen_random_uuid(), null, $3::timestamptz)", [
        org,
        kind,
        at,
      ]);
    await money(A, "lead_sql", "2026-03-01T10:05:00Z");
    await money(A, "lead_sql", "2026-03-01T10:55:00Z");
    await money(A, "lead_sql", "2026-03-01T10:05:00Z");
    expect(await notices()).toHaveLength(2); // Owner and Sales Leader, once
    await money(A, "lead_sql", "2026-03-01T11:00:00Z");
    expect(await notices()).toHaveLength(4);
    await money(A, "deal_won", "2026-03-01T10:30:00Z");
    expect(await notices()).toHaveLength(6);
    await money(B, "lead_sql", "2026-03-01T10:30:00Z");
    expect(await notices()).toHaveLength(7); // the other company has its own key
    expect(new Set((await notices()).map((n) => n.dedupe_key)).size).toBe(4);
  });

  it("CA-8: (user_id, dedupe_key) is unique, and the trigger keys by the hour of now(), not by the event date", async () => {
    await db.exec(
      "insert into notifications (org_id, user_id, kind, title, dedupe_key) values ('" +
        A +
        "','" +
        U.ownerA +
        "','money','t','k1')",
    );
    expect(
      await failure(() =>
        db.exec(
          "insert into notifications (org_id, user_id, kind, title, dedupe_key) values ('" +
            A +
            "','" +
            U.ownerA +
            "','money','t','k1')",
        ),
      ),
    ).toMatch(/unique|duplicate/i);
    await db.exec(
      "insert into notifications (org_id, user_id, kind, title, dedupe_key) values ('" +
        A +
        "','" +
        U.ownerA +
        "','money','t','k2')",
    ); // control: another key
    await db.exec(
      "insert into notifications (org_id, user_id, kind, title) values ('" +
        A +
        "','" +
        U.ownerA +
        "','done','a'),('" +
        A +
        "','" +
        U.ownerA +
        "','done','b')",
    ); // null keys never collide
    await db.exec("delete from notifications");
    // same transaction: the close is two hours ago, so a key built from the event date would carry another hour
    await db.exec("begin");
    try {
      await db.query(
        "insert into deals (org_id, name, stage, owner_id, closed_at) values ($1,'Deal ficticio','won',$2, now() - interval '2 hours')",
        [A, U.aeA],
      );
      const got = await rows(
        `select dedupe_key, 'money:deal_won:' || org_id || ':' || to_char(date_trunc('hour', now() at time zone 'UTC'), 'YYYY-MM-DD"T"HH24"Z"') as expected from notifications`,
      );
      expect(got).toHaveLength(3);
      for (const g of got) expect(g.dedupe_key).toBe(g.expected);
    } finally {
      await db.exec("commit");
    }
    expect(new Set((await notices()).map((n) => n.dedupe_key)).size).toBe(1);
  });

  it("CA-12: no notice crosses companies, reaches an archived company, a former member or a row without org_id", async () => {
    await newLead(U.ownerA, "sql", { owner: U.ownerB }); // the responsible belongs to another company
    expect(await who()).toEqual(sorted(U.ownerA, V.slA)); // positive control; ownerB is not notified for A
    await clear();
    await newLead(null, "sql", { owner: V.exA }); // a former member is not notified; the leaders are
    expect(await who()).toEqual(sorted(U.ownerA, V.slA));
    await clear();
    await newLead(U.ownerB, "sql", { org: B });
    expect(await who()).toEqual([U.ownerB]); // B only, none of A's people
    await clear();
    await db.exec(`update organizations set archived_at = now() where id = '${C}'`);
    await newLead(null, "sql", { org: C });
    await newDeal(null, "won", { org: C, closed: ago(1) });
    expect(await notices()).toHaveLength(0);
    await db.exec(`update organizations set archived_at = null where id = '${C}'`);
    await newLead(null, "sql", { org: C });
    expect(await who()).toEqual([V.ownerC]); // control: not archived, it notices
    await clear();
    const id = await newLead(null, "mql");
    const warnings: string[] = [];
    const onNotice = (n: { message?: string }) => void warnings.push(n.message ?? "");
    await db.query("update leads set org_id = null, stage = 'sql' where id = $1", [id], {
      onNotice,
    });
    expect(await notices()).toHaveLength(0);
    expect(warnings.filter((w) => w.includes("money_"))).toEqual([]); // ignored, not a failure
  });

  it("CA-13: a failing notice keeps the write and leaves a warning without row data; no recipients means no notice and no warning", async () => {
    const warnings: string[] = [];
    const onNotice = (n: { message?: string }) => void warnings.push(n.message ?? "");
    await db.exec(
      "alter table public.notifications add constraint force_fail check (false) not valid",
    );
    try {
      await as(db, U.ownerA, () =>
        db.query(
          "insert into leads (org_id, company, email, notes, contact_name, stage) values ($1,'Empresa ficticia SA','ficticio@example.test','Tel +34 600 000 000','Nombre Ficticio','sql')",
          [A],
          { onNotice },
        ),
      );
      await db.query(
        "insert into deals (org_id, name, stage, closed_at) values ($1,'Deal ficticio SA','won', now())",
        [A],
        { onNotice },
      );
    } finally {
      await db.exec("alter table public.notifications drop constraint force_fail");
    }
    expect((await rows("select count(*)::int as n from leads"))[0]!.n).toBe(1);
    expect((await rows("select count(*)::int as n from deals"))[0]!.n).toBe(1);
    expect(await notices()).toHaveLength(0);
    const own = warnings.filter((w) => w.includes("money_"));
    expect(own).toHaveLength(2);
    expect(own.join(" ")).not.toMatch(/fictici[oa]|example\.test|600 000|Nombre|Empresa ficticia/i);
    // no recipients: the write goes on, no notice and no warning (it is not a failure)
    const quiet: string[] = [];
    await db.query(
      "insert into leads (org_id, company, stage) values ($1,'Lead ficticio','sql')",
      [D],
      { onNotice: (n: { message?: string }) => void quiet.push(n.message ?? "") },
    );
    await db.query(
      "insert into deals (org_id, name, stage, closed_at) values ($1,'Deal ficticio','won', now())",
      [D],
      { onNotice: (n: { message?: string }) => void quiet.push(n.message ?? "") },
    );
    expect(await notices()).toHaveLength(0);
    expect(quiet.filter((w) => w.includes("money_"))).toEqual([]);
    expect((await rows("select count(*)::int as n from leads where org_id = $1", [D]))[0]!.n).toBe(
      1,
    );
    await newLead(U.ownerA, "sql"); // control: with the constraint gone and recipients present, it notices
    expect(await notices()).toHaveLength(2);
  });

  it("CA-14: title, body and link come from a closed list and carry nothing of the lead or deal", async () => {
    await write(
      U.ownerA,
      "insert into leads (org_id, company, email, notes, contact_name, owner_id, stage) values ($1,'Empresa ficticia SA','ficticio@example.test','Tel +34 600 000 000','Nombre Ficticio',$2,'sql')",
      [A, U.aeA],
    );
    await write(
      U.ownerA,
      "insert into deals (org_id, name, stage, owner_id, closed_at) values ($1,'Deal ficticio SA','won',$2, now())",
      [A, U.aeA],
    );
    const got = await notices();
    expect(got).toHaveLength(6);
    const leadRows = got.filter((n) => String(n.dedupe_key).includes(":lead_sql:"));
    const dealRows = got.filter((n) => String(n.dedupe_key).includes(":deal_won:"));
    expect(leadRows).toHaveLength(3);
    expect(dealRows).toHaveLength(3);
    for (const n of leadRows) expect({ title: n.title, body: n.body, link: n.link }).toEqual(LEAD);
    for (const n of dealRows) expect({ title: n.title, body: n.body, link: n.link }).toEqual(DEAL);
    expect(JSON.stringify(got)).not.toMatch(
      /fictici[oa]|example\.test|600 000|Nombre|Empresa ficticia/i,
    );
  });

  it("CA-15: a lead going to opportunity without stopping in SQL, and the deal it creates with a null stage, do not notify", async () => {
    await newLead(U.ownerA, "sql", { owner: U.aeA }); // positive control
    expect(await notices()).toHaveLength(3);
    await clear();
    const id = await newLead(U.ownerA, "mql", { owner: U.aeA });
    await write(U.ownerA, "update leads set stage = 'opportunity' where id = $1", [id]);
    await newLead(U.ownerA, "opportunity", { owner: U.aeA, company: "Otro lead ficticio" });
    const deals = await rows("select stage, probability, closed_at from deals order by created_at");
    expect(deals).toHaveLength(2);
    for (const d of deals)
      expect(d).toMatchObject({ stage: "discovery", probability: 10, closed_at: null });
    expect(await notices()).toHaveLength(0);
    // from SQL straight to opportunity: the entry into SQL already notified (and was cleared); the exit does not
    const sqlLead = await newLead(U.ownerA, "sql", {
      owner: U.aeA,
      company: "Tercer lead ficticio",
    });
    await clear();
    await write(U.ownerA, "update leads set stage = 'opportunity' where id = $1", [sqlLead]);
    expect(await notices()).toHaveLength(0);
  });
});

describe("migration 0078: the CHECK rewrite is scoped to notifications.kind (N-4)", () => {
  let w: Awaited<ReturnType<typeof world>>;
  // the PGlite boot (about 1.5 s of CPU) goes in beforeAll, not inside the test, so the 5 s test limit does not count it
  beforeAll(async () => {
    w = await world(false);
  });

  it("replaces the kind CHECK even under another name, and keeps any other CHECK that merely mentions kind", async () => {
    const { db, A, B } = w;
    await db.exec(`alter table public.notifications rename constraint notifications_kind_check to legacy_kind_check;
      alter table public.notifications add constraint notifications_failed_needs_title check (kind <> 'failed' or length(title) > 3);`);
    const user = "00000000-0000-4000-8000-0000000000b1";
    const insert = (kind: string, title: string) =>
      db.exec(
        `insert into notifications (org_id, user_id, kind, title) values ('${A}','${user}','${kind}','${title}')`,
      );
    const failure = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        return "";
      } catch (e) {
        return String((e as Error).message);
      }
    };
    expect(B).toBeTruthy();
    expect(await failure(() => insert("money", "aviso"))).toMatch(/kind_check|check constraint/i); // before: money is not allowed
    await db.exec(readFileSync(`${REPO}/drizzle/migrations/${MIGRATION}`, "utf8"));
    await insert("money", "aviso"); // after: money goes in
    expect(await failure(() => insert("otro", "aviso"))).toMatch(/notifications_kind_check/); // the new kind CHECK still rejects unknown kinds
    expect(await failure(() => insert("failed", "no"))).toMatch(/notifications_failed_needs_title/); // the unrelated CHECK survived
    await insert("failed", "titulo largo"); // control: it still lets valid rows through
    const names = (
      await db.query<Row>(
        "select conname from pg_constraint where conrelid = 'public.notifications'::regclass and contype = 'c' order by conname",
      )
    ).rows.map((r) => r["conname"]);
    expect(names).not.toContain("legacy_kind_check");
    expect(names).toContain("notifications_failed_needs_title");
  });
});
