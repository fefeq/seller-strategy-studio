// Orchestrator from the screens: the user asks for a need, Nokko picks the services (src/lib/orchestrator/).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { MAX_REVEAL, apolloWebhookBase } from "@/lib/apollo";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import {
  completeAccount,
  connectedServices,
  findIcpCompanies,
  findKeyPeople,
  monthBudget,
  revealKeyPeople,
} from "@/lib/orchestrator/runner";

export const orchestrateCompleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) =>
    completeAccount(
      await userCtx(context.supabase as Db, context.userId),
      data.accountId,
      "manual",
    ),
  );

export const orchestratorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await userCtx(context.supabase as Db, context.userId);
    const b = await monthBudget(c);
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { data } = await c.db
      .from("integration_usage")
      .select("service,cost,trigger,currency")
      .eq("org_id", c.orgId)
      .gte("created_at", start.toISOString());
    // Per service only EUR amounts are added; other currencies and unknown costs are counted, never summed in.
    const byService: Record<string, { calls: number; cost: number; unknown: number }> = {};
    let automatic = 0;
    for (const r of data ?? []) {
      const s = (byService[r.service] ??= { calls: 0, cost: 0, unknown: 0 });
      s.calls++;
      if (r.cost == null || r.currency !== "EUR") {
        s.unknown++;
        continue;
      }
      s.cost += Number(r.cost);
      if (r.trigger === "automatic") automatic += Number(r.cost);
    }
    return {
      connected: connectedServices(),
      spent: b.spent,
      limit: b.limit,
      warn: b.warn,
      paused: b.paused,
      pct: b.pct,
      automatic,
      byService,
      otherCurrencies: b.otherCurrencies,
      unknown: b.unknown,
      complete: b.complete,
    };
  });

const Cursor = z
  .union([
    z.object({ service: z.literal("apollo"), page: z.number().int().min(1).max(100) }),
    z.object({ service: z.literal("clay"), searchId: z.string().regex(/^[A-Za-z0-9_-]{4,80}$/) }),
  ])
  .nullable()
  .optional();
const words = z.array(z.string().trim().min(1).max(120)).max(15).default([]);

export const orchestrateKeyPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        titles: words,
        levels: z.array(z.string().max(20)).max(10).default([]),
        cursor: Cursor,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    findKeyPeople(await userCtx(context.supabase as Db, context.userId), data, "manual"),
  );

export const orchestrateRevealPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        apolloIds: z
          .array(z.string().regex(/^[A-Za-z0-9]{6,64}$/))
          .min(1)
          .max(MAX_REVEAL),
        phone: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let host: string | null = null;
    try {
      host = new URL(getRequest().url).host;
    } catch {
      host = null;
    }
    const webhookBase = apolloWebhookBase(host, process.env["__LOVABLE_PROJECT_ID"] ?? "");
    return revealKeyPeople(await userCtx(context.supabase as Db, context.userId), {
      ...data,
      webhookBase,
    });
  });

export const orchestrateIcpCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cursor: Cursor,
        query: z.object({
          keywords: words,
          countries: words,
          minEmployees: z.number().int().min(1).nullable().optional(),
          maxEmployees: z.number().int().min(1).nullable().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    findIcpCompanies(await userCtx(context.supabase as Db, context.userId), data, "manual"),
  );
