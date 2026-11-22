// @vitest-environment node
// SDD-20261121-agent-turn-metrics (NK-0191) U-2 · CA-11, CA-12 and the database half of CA-7: runs migration 0109 on an
// in-process Postgres (PGlite) with two fictional companies. Never touches a real database.
// agent_conversations and agent_pending_actions are not in the harness: they are created here from the lines of
// migration 0007 as they are, then 0108 (agent_tool_calls) and 0109 run from their files.
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, build, migrate, REPO, seed, U } from "@/test/pg-harness";
import type { Database } from "@/integrations/supabase/types";

type Db = Awaited<ReturnType<typeof build>>;
let db: Db;
let A: string;
let B: string;
let convA: string;

const TURN_COLUMNS = [
  "attempts",
  "channel",
  "conversation_id",
  "cost_kind",
  "cost_usd",
  "created_at",
  "duration_ms",
  "error_status",
  "id",
  "input_tokens",
  "mode",
  "model",
  "org_id",
  "outcome",
  "output_tokens",
  "proposed_count",
  "provider",
  "steps",
  "user_id",
];

/** The statements of 0007 that create one table, its grants, RLS and policies. */
function from0007(table: string) {
  const sql = readFileSync(`${REPO}/drizzle/migrations/0007_agent_proactive_channels.sql`, "utf8");
  const create = new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`).exec(sql)?.[0];
  expect(create, table).toBeDefined();
  const rest = sql
    .split("\n")
    .filter((l) => new RegExp(` on public\\.${table}[ ;]|table public\\.${table} enable`).test(l))
    .filter((l) => !l.startsWith("create index"));
  return `${create}\n${rest.join("\n")}`;
}

const turn = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  org_id: A,
  user_id: U.ownerA,
  conversation_id: convA,
  channel: "app",
  mode: "chat",
  provider: "openrouter",
  model: "vendor/model-x",
  attempts: 1,
  steps: 2,
  duration_ms: 1500,
  input_tokens: 300,
  output_tokens: 40,
  cost_usd: 0.0031,
  cost_kind: "measured",
  outcome: "answered",
  error_status: null,
  proposed_count: 0,
  ...over,
});
const insertTurn = (row: Record<string, unknown>) => {
  const keys = Object.keys(row);
  return db.query(
    `insert into agent_turns (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    keys.map((k) => row[k]),
  );
};

beforeAll(async () => {
  db = await build();
  ({ A, B } = await seed(db));
  await db.exec(`${from0007("agent_conversations")}\n${from0007("agent_pending_actions")}`);
  const files = readdirSync(`${REPO}/drizzle/migrations`);
  const m0108 = files.find((f) => f.startsWith("0108_"));
  const m0109 = files.find((f) => f.startsWith("0109_"));
  expect(m0108).toBeDefined();
  expect(m0109, "migration 0109 exists").toBeDefined();
  await migrate(db, [m0108!, m0109!]);
  convA = (
    await db.query<{ id: string }>(
      "insert into agent_conversations (org_id, user_id) values ($1, $2) returning id",
      [A, U.ownerA],
    )
  ).rows[0]!.id;
}, 60000);
afterAll(async () => {
  await db?.close();
});

describe("migration 0109 · agent_turns", () => {
  it("CA-11: the table has the columns of SDD section 10 and no other", async () => {
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'agent_turns' order by column_name",
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual(TURN_COLUMNS);
  });

  it("CA-11: no column can hold request, answer, argument, result or error text", async () => {
    const text = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'agent_turns' and data_type in ('text', 'character varying', 'jsonb', 'json') order by column_name",
    );
    // Closed sets (CHECK) plus the provider's model id, which is cut to 200 characters.
    expect(text.rows.map((r) => r.column_name)).toEqual([
      "channel",
      "cost_kind",
      "mode",
      "model",
      "outcome",
      "provider",
    ]);
    await expect(insertTurn(turn({ model: "m".repeat(201) }))).rejects.toThrow();
    for (const [column, value] of [
      ["channel", "whatsapp"],
      ["mode", "debate"],
      ["provider", "anthropic"],
      ["cost_kind", "estimate"],
      ["outcome", "No pude responder: el cliente pidió un descuento"],
    ] as const)
      await expect(insertTurn(turn({ [column]: value })), column).rejects.toThrow();
  });

  it("CA-11: the generated types list the same columns", () => {
    type Row = Database["public"]["Tables"]["agent_turns"]["Row"];
    const typed: Record<keyof Row, true> = {
      attempts: true,
      channel: true,
      conversation_id: true,
      cost_kind: true,
      cost_usd: true,
      created_at: true,
      duration_ms: true,
      error_status: true,
      id: true,
      input_tokens: true,
      mode: true,
      model: true,
      org_id: true,
      outcome: true,
      output_tokens: true,
      proposed_count: true,
      provider: true,
      steps: true,
      user_id: true,
    };
    expect(Object.keys(typed).sort()).toEqual(TURN_COLUMNS);
    const types = readFileSync(`${REPO}/src/integrations/supabase/types.ts`, "utf8");
    const block = /\n {6}agent_turns: \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/.exec(types)?.[1] ?? "";
    expect(
      block
        .split("\n")
        .map((l) => l.trim().split(":")[0])
        .sort(),
    ).toEqual(TURN_COLUMNS);
  });

  it("CA-11: unknown cost is empty, never zero, and a measured cost is never empty", async () => {
    await expect(insertTurn(turn({ cost_kind: "unknown", cost_usd: 0 }))).rejects.toThrow();
    await expect(insertTurn(turn({ cost_kind: "measured", cost_usd: null }))).rejects.toThrow();
    await insertTurn(turn({ cost_kind: "unknown", cost_usd: null }));
    await insertTurn(turn({ provider: "none", cost_usd: 0, input_tokens: null, steps: null }));
  });

  it("CA-12: a person reads only their own turns, and only of companies they belong to", async () => {
    const mine = turn();
    const colleague = turn({ user_id: U.aeA, conversation_id: null });
    const other = turn({ org_id: B, user_id: U.ownerB, conversation_id: null });
    // A turn of ownerA in a company they do not belong to (written by the privileged path).
    const stray = turn({ org_id: B, conversation_id: null });
    for (const row of [mine, colleague, other, stray]) await as(db, null, () => insertTurn(row));
    const ids = async (uid: string) =>
      (
        await as(db, uid, () =>
          db.query<{ id: string }>("select id from agent_turns where id = any($1)", [
            [mine.id, colleague.id, other.id, stray.id],
          ]),
        )
      ).rows.map((r) => r.id);
    expect(await ids(U.ownerA)).toEqual([mine.id]);
    expect(await ids(U.aeA)).toEqual([colleague.id]);
    expect(await ids(U.ownerB)).toEqual([other.id]);
  });

  it("CA-12: a person inserts only their own turn in their own company, and never updates or deletes", async () => {
    await as(db, U.ownerA, () => insertTurn(turn()));
    await expect(as(db, U.ownerA, () => insertTurn(turn({ user_id: U.aeA })))).rejects.toThrow();
    await expect(
      as(db, U.ownerA, () => insertTurn(turn({ org_id: B, conversation_id: null }))),
    ).rejects.toThrow();
    await expect(
      as(db, U.ownerA, () => db.query("update agent_turns set outcome = 'answered'")),
    ).rejects.toThrow(/permission denied/);
    await expect(as(db, U.ownerA, () => db.query("delete from agent_turns"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("CA-12: anon has no privilege on the table", async () => {
    const privileges = await db.query<{ privilege_type: string }>(
      "select privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'agent_turns' and grantee = 'anon'",
    );
    expect(privileges.rows).toEqual([]);
    const authenticated = await db.query<{ privilege_type: string }>(
      "select privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'agent_turns' and grantee = 'authenticated' order by privilege_type",
    );
    expect(authenticated.rows.map((r) => r.privilege_type)).toEqual(["INSERT", "SELECT"]);
    await db.exec("set role anon");
    try {
      await expect(db.query("select 1 from agent_turns")).rejects.toThrow(/permission denied/);
      await expect(insertTurn(turn())).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("CA-12: the table has row level security on and its indexes", async () => {
    const rls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.agent_turns'::regclass",
    );
    expect(rls.rows[0]?.relrowsecurity).toBe(true);
    const idx = await db.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'public' and tablename in ('agent_turns', 'agent_tool_calls', 'agent_pending_actions')",
    );
    const defs = idx.rows.map((r) => r.indexdef).join("\n");
    expect(defs).toMatch(/ON public\.agent_turns .*\(org_id, created_at DESC\)/);
    expect(defs).toMatch(/ON public\.agent_turns .*\(conversation_id\)/);
    expect(defs).toMatch(/ON public\.agent_tool_calls .*\(turn_id\)/);
    expect(defs).toMatch(/ON public\.agent_pending_actions .*\(turn_id\)/);
  });

  it("CA-7: turn_id on actions and tool calls has no foreign key, so proposing works before the turn row exists", async () => {
    const turnId = crypto.randomUUID();
    await as(db, U.ownerA, async () => {
      await db.query(
        "insert into agent_pending_actions (org_id, user_id, conversation_id, tool, turn_id) values ($1, $2, $3, 'create_task', $4)",
        [A, U.ownerA, convA, turnId],
      );
      await db.query(
        "insert into agent_tool_calls (org_id, user_id, conversation_id, tool, kind, outcome, turn_id) values ($1, $2, $3, 'create_task', 'write', 'pending', $4)",
        [A, U.ownerA, convA, turnId],
      );
    });
    const none = await db.query("select 1 from agent_turns where id = $1", [turnId]);
    expect(none.rows).toEqual([]);
    const fks = await db.query<{ conname: string }>(
      "select conname from pg_constraint where contype = 'f' and confrelid = 'public.agent_turns'::regclass",
    );
    expect(fks.rows).toEqual([]);
    // Actions written outside a turn (autopilot, suggestions, MCP) keep working with no turn.
    await db.query(
      "insert into agent_pending_actions (org_id, user_id, tool) values ($1, $2, 'create_task')",
      [A, U.ownerA],
    );
    const loose = await db.query<{ n: number }>(
      "select count(*)::int as n from agent_pending_actions where turn_id is null",
    );
    expect(loose.rows[0]?.n).toBe(1);
  });

  it("CA-11: deleting the conversation or the company removes its turns", async () => {
    const conv = (
      await db.query<{ id: string }>(
        "insert into agent_conversations (org_id, user_id) values ($1, $2) returning id",
        [A, U.ownerA],
      )
    ).rows[0]!.id;
    const row = turn({ conversation_id: conv });
    await insertTurn(row);
    await db.query("delete from agent_conversations where id = $1", [conv]);
    expect((await db.query("select 1 from agent_turns where id = $1", [row.id])).rows).toEqual([]);
  });
});
