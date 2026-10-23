// Apollo from the screens: any member of the active company can search and spend credits.
// Same cores as the agent tools; phones arrive later through /api/public/apollo/phone-webhook.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { APOLLO_SENIORITY, MAX_REVEAL, apolloWebhookBase } from "@/lib/apollo";
import { enrichAccount, findCompanies, findPeople, revealStakeholder, revealToAccount } from "@/lib/apollo-gateway";

const words = z.array(z.string().trim().min(1).max(120)).max(15).default([]);
const page = z.number().int().min(1).max(100).default(1);

/** The webhook host follows where the app is served: the stable preview host in the editor, the published one otherwise. */
function webhookBase() {
  let host: string | null = null;
  try { host = new URL(getRequest().url).host; } catch { host = null; }
  return apolloWebhookBase(host, process.env["__LOVABLE_PROJECT_ID"] ?? "");
}

export const apolloPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid(), page, query: z.object({ titles: words, seniorities: z.array(z.enum(APOLLO_SENIORITY)).default([]) }).optional() }).parse(d))
  .handler(async ({ data, context }) => findPeople(await userCtx(context.supabase as Db, context.userId), data));

export const apolloRevealToAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid(), apolloIds: z.array(z.string().regex(/^[A-Za-z0-9]{6,64}$/)).min(1).max(MAX_REVEAL), phone: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => revealToAccount(await userCtx(context.supabase as Db, context.userId), { ...data, webhookBase: webhookBase() }));

export const apolloRevealStakeholder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ stakeholderId: z.string().uuid(), phone: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => revealStakeholder(await userCtx(context.supabase as Db, context.userId), { ...data, webhookBase: webhookBase() }));

export const apolloCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    page,
    query: z.object({ keywords: words, countries: words, minEmployees: z.number().int().min(1).nullable().optional(), maxEmployees: z.number().int().min(1).nullable().optional() }),
  }).parse(d))
  .handler(async ({ data, context }) => findCompanies(await userCtx(context.supabase as Db, context.userId), data));

export const apolloEnrich = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => enrichAccount(await userCtx(context.supabase as Db, context.userId), data.accountId));
