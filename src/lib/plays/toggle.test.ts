// NK-0080: the agent and the assistants server showed the database error of play_states as it came.
import { expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { checkToggle } from "./status";
import { togglePlay } from "./toggle";
import type { ToolCtx } from "@/lib/agent/tool-kit";

const RAW = 'new row violates row-level security policy for table "play_states"';
const roles = ["owner"];
const play = CATALOG.find((p) => checkToggle({ play: p, roles, enable: false }).ok)!;
const ctx = (error: { message: string; code?: string } | null) =>
  ({
    db: { from: () => ({ upsert: async () => ({ error }) }) },
    orgId: "org-synthetic",
    userId: "user-synthetic",
    roles,
  }) as unknown as ToolCtx;

it("a failed write answers in Spanish, without the database wording", async () => {
  const failure = await togglePlay(ctx({ message: RAW, code: "42501" }), play.id, false).catch(
    (e: Error) => e,
  );
  expect(failure).toBeInstanceOf(Error);
  const text = (failure as Error).message;
  expect(text).not.toContain("row-level security");
  expect(text).not.toContain("play_states");
  expect(text.length).toBeGreaterThan(10);
});

it("a write that works still answers with the play and its new state", async () => {
  const out = await togglePlay(ctx(null), play.id, false);
  expect(out).toMatchObject({ play_id: play.id, enabled: false });
  expect(out.mensaje).toContain("Pausado");
});
