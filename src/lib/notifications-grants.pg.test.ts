// @vitest-environment node
// SDD-20261109-rls-price-suggestions-and-notices, U-2 (NK-0070): migration 0082 leaves `authenticated` with UPDATE on
// notifications.read_at only. Runs on an in-process Postgres (PGlite) with fictional companies and people; never touches a real database.
// The notifications table is rebuilt here with the columns of 0049 + 0050 + 0078 and the policies of 0049:24-28 (the harness has no
// background_jobs, so job_id has no foreign key). Every case runs in two permission variants:
//   repo = grants as 0049:21 (select, update to authenticated);
//   live = Supabase defaults (all to anon and authenticated) plus an extra column UPDATE grant, as the gate probe did.
// Not replicated: notify_job_end and money_notify (their inserts are mimicked with a small security definer function).
import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { as, build, REPO, seed, U } from "@/test/pg-harness";

type Db = Awaited<ReturnType<typeof build>>;
type Variant = "repo" | "live";
const MIGRATION = "0082_notifications_read_only.sql";
const SERVICE = "00000000-0000-4000-8000-0000000000a9"; // a person of company A who is not the notice owner

const SCHEMA = `
  create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
    user_id uuid not null, job_id uuid,
    kind text not null constraint notifications_kind_check check (kind = any (array['done','failed','needs_decision','autopilot','money'])),
    title text not null constraint notifications_title_check check (length(title) <= 300),
    body text constraint notifications_body_check check (length(body) <= 1000),
    link text constraint notifications_link_check check (length(link) <= 500),
    read_at timestamptz, telegram_sent_at timestamptz, created_at timestamptz not null default now(),
    dedupe_key text, constraint notifications_user_dedupe_key unique (user_id, dedupe_key));
  alter table public.notifications enable row level security;
  create policy "own read" on public.notifications for select to authenticated using (user_id = auth.uid() and public.is_org_member(org_id));
  create policy "own mark read" on public.notifications for update to authenticated
    using (user_id = auth.uid() and public.is_org_member(org_id)) with check (user_id = auth.uid());
  create function public.fake_notify(_org uuid, _user uuid) returns void language plpgsql security definer set search_path = public as $$
  begin insert into public.notifications (org_id, user_id, kind, title, dedupe_key) values (_org, _user, 'money', 'Aviso del sistema', 'sys:1'); end $$;
`;

const GRANTS: Record<Variant, string> = {
  repo: `revoke all on public.notifications from authenticated, anon, service_role;
    grant select, update on public.notifications to authenticated; grant all on public.notifications to service_role;`,
  live: `grant all on public.notifications to anon, authenticated, service_role;
    grant update (title) on public.notifications to authenticated;`,
};

const migrationSql = () =>
  existsSync(`${REPO}/drizzle/migrations/${MIGRATION}`)
    ? readFileSync(`${REPO}/drizzle/migrations/${MIGRATION}`, "utf8")
    : "";

async function world(variant: Variant, withMigration = true) {
  const db = await build();
  const { A, B } = await seed(db);
  await db.exec(
    `insert into org_members (org_id, user_id, role) values ('${A}','${SERVICE}','ae'); insert into profiles (id, current_org_id) values ('${SERVICE}','${A}');`,
  );
  await db.exec(SCHEMA);
  await db.exec(GRANTS[variant]);
  if (withMigration) await db.exec(migrationSql());
  const mine = (
    await db.query(
      `insert into public.notifications (org_id, user_id, kind, title, body, link, dedupe_key) values ('${A}','${U.aeA}','money','Mi aviso','Cuerpo','/deals','k:mine') returning id`,
    )
  ).rows[0] as { id: string };
  const other = (
    await db.query(
      `insert into public.notifications (org_id, user_id, kind, title, dedupe_key) values ('${A}','${SERVICE}','done','Aviso ajeno','k:other') returning id`,
    )
  ).rows[0] as { id: string };
  return { db, A, B, mine: mine.id, other: other.id };
}

const rows = async (db: Db) =>
  (await db.query("select * from public.notifications order by dedupe_key")).rows as Record<
    string,
    unknown
  >[];
const fingerprint = async (db: Db) =>
  (
    (
      await db.query(
        "select md5(coalesce(string_agg(n::text, '|' order by id), '')) as f from public.notifications n",
      )
    ).rows[0] as { f: string }
  ).f;
const grantsOf = async (db: Db) =>
  (
    await db.query(
      `select 't' as k, grantee, privilege_type as p, '' as c from information_schema.role_table_grants where table_name = 'notifications' and table_schema = 'public'
       union all select 'c', grantee, privilege_type, column_name from information_schema.column_privileges where table_name = 'notifications' and table_schema = 'public' and privilege_type = 'UPDATE' and grantee in ('anon','authenticated')
       order by 1,2,3,4`,
    )
  ).rows;
async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
}

describe("migration 0082 file", () => {
  it("exists, only touches update privileges and carries its rollback script", () => {
    expect(existsSync(`${REPO}/drizzle/migrations/${MIGRATION}`)).toBe(true);
    const sql = migrationSql();
    expect(sql).toMatch(/revoke update on public\.notifications from authenticated, anon;/);
    expect(sql).toMatch(/grant update \(read_at\) on public\.notifications to authenticated;/);
    expect(sql).toMatch(/-- rollback/i);
    expect(sql).toMatch(/comprobaci[oó]n previa 3|precheck 3/i);
    expect(sql).not.toMatch(/^\s*(begin|commit)\b/im);
  });

  it("is in the journal with a when above 0081's", () => {
    const j = JSON.parse(readFileSync(`${REPO}/drizzle/migrations/meta/_journal.json`, "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    const e = j.entries.find((x) => x.tag === "0082_notifications_read_only");
    expect(e).toBeTruthy();
    expect(e!.when).toBeGreaterThan(1794225600000);
  });
});

describe.each<Variant>(["repo", "live"])(
  "notifications: a member only marks read (permissions: %s)",
  (variant) => {
    let w: Awaited<ReturnType<typeof world>>;
    beforeEach(async () => {
      w = await world(variant);
    });

    it("CA-11: a member sets read_at on their own notice (update ... in ids)", async () => {
      const r = await as(w.db, U.aeA, () =>
        w.db.query(
          "update public.notifications set read_at = now() where id = any($1) returning id",
          [[w.mine]],
        ),
      );
      expect(r.rows).toHaveLength(1);
      const row = (await rows(w.db)).find((x) => x.dedupe_key === "k:mine")!;
      expect(row.read_at).not.toBeNull();
    });

    it("CA-11: another person's notice is not touched", async () => {
      const r = await as(w.db, U.aeA, () =>
        w.db.query("update public.notifications set read_at = now() where id = $1 returning id", [
          w.other,
        ]),
      );
      expect(r.rows).toHaveLength(0);
    });

    const colsOf = (B: string): [string, string][] => [
      ["dedupe_key", "'k:changed'"],
      ["title", "'Cambiado'"],
      ["body", "'Cambiado'"],
      ["link", "'/otro'"],
      ["kind", "'done'"],
      ["job_id", "gen_random_uuid()"],
      ["org_id", `'${B}'::uuid`],
      ["user_id", `'${U.ownerA}'::uuid`],
      ["telegram_sent_at", "now()"],
      ["created_at", "now() - interval '1 day'"],
    ];
    it.each([
      "dedupe_key",
      "title",
      "body",
      "link",
      "kind",
      "job_id",
      "org_id",
      "user_id",
      "telegram_sent_at",
      "created_at",
    ])("CA-12: cannot update %s (permission denied, row unchanged)", async (col) => {
      const val = colsOf(w.B).find((c) => c[0] === col)![1];
      const before = await fingerprint(w.db);
      const c = await as(w.db, U.aeA, () =>
        code(w.db.query(`update public.notifications set ${col} = ${val} where id = '${w.mine}'`)),
      );
      expect(c).toBe("42501");
      expect(await fingerprint(w.db)).toBe(before);
    });

    it("CA-12: an update mixing read_at and another column fails entirely", async () => {
      const before = await fingerprint(w.db);
      const c = await as(w.db, U.aeA, () =>
        code(
          w.db.query(
            `update public.notifications set read_at = now(), title = 'Cambiado' where id = '${w.mine}'`,
          ),
        ),
      );
      expect(c).toBe("42501");
      expect(await fingerprint(w.db)).toBe(before);
    });

    it("CA-13: cannot insert or delete notices; anon cannot update", async () => {
      const before = await fingerprint(w.db);
      const ins = await as(w.db, U.aeA, () =>
        code(
          w.db.query(
            `insert into public.notifications (org_id, user_id, kind, title) values ('${w.A}','${U.aeA}','done','Propio')`,
          ),
        ),
      );
      expect(ins).toBe("42501");
      await as(w.db, U.aeA, () =>
        w.db.query(`delete from public.notifications where id = '${w.mine}'`).catch(() => null),
      );
      const anon = await code(
        (async () => {
          await w.db.exec("set role anon");
          try {
            await w.db.query("update public.notifications set read_at = now()");
          } finally {
            await w.db.exec("reset role");
          }
        })(),
      );
      expect(anon).toBe("42501");
      expect(await fingerprint(w.db)).toBe(before);
    });

    it("CA-14: service_role still updates telegram_sent_at and inserts; a security definer function still inserts", async () => {
      const u = await as(w.db, null, () =>
        w.db.query(
          "update public.notifications set telegram_sent_at = now() where id = $1 returning id",
          [w.mine],
        ),
      );
      expect(u.rows).toHaveLength(1);
      await as(w.db, null, () =>
        w.db.query(
          `insert into public.notifications (org_id, user_id, kind, title, dedupe_key) values ('${w.A}','${U.aeA}','money','Del servidor','k:srv')`,
        ),
      );
      await as(w.db, U.aeA, () => w.db.query("select public.fake_notify($1, $2)", [w.A, U.aeA]));
      expect(await rows(w.db)).toHaveLength(4);
    });

    it("CA-15: applying 0082 twice does not fail, changes no row and leaves the same privileges", async () => {
      const f = await fingerprint(w.db);
      const g = await grantsOf(w.db);
      await w.db.exec(migrationSql());
      expect(await fingerprint(w.db)).toBe(f);
      expect(await grantsOf(w.db)).toEqual(g);
    });

    it("final privileges: authenticated has select and UPDATE on read_at only; anon has no update", async () => {
      const g = (await grantsOf(w.db)) as { k: string; grantee: string; p: string; c: string }[];
      expect(g.filter((x) => x.k === "c" && x.grantee === "authenticated").map((x) => x.c)).toEqual(
        ["read_at"],
      );
      expect(g.filter((x) => x.k === "c" && x.grantee === "anon")).toEqual([]);
      expect(g.some((x) => x.k === "t" && x.grantee === "authenticated" && x.p === "UPDATE")).toBe(
        false,
      );
    });
  },
);
