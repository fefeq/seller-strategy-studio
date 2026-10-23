// Clay from the screens: any member of the active company can search. Same cores as the agent tools.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { CLAY_REVENUES, CLAY_SENIORITY, MAX_PAGE } from "@/lib/clay";
import { clayIndustries, enrichAccount, findCompanies, findPeople } from "@/lib/clay-gateway";

const words = z.array(z.string().trim().min(1).max(120)).max(15).default([]);
const searchId = z.string().regex(/^[A-Za-z0-9_-]{4,80}$/).optional();
const limit = z.number().int().min(1).max(MAX_PAGE).default(10);

const CompaniesIn = z.object({
  searchId, limit,
  query: z.object({
    keywords: words, industries: words, countries: words, revenues: z.array(z.enum(CLAY_REVENUES)).default([]),
    minEmployees: z.number().int().min(1).nullable().optional(), maxEmployees: z.number().int().min(1).nullable().optional(),
  }).optional(),
});
const PeopleIn = z.object({
  accountId: z.string().uuid(), searchId, limit,
  query: z.object({ titles: words, seniority: z.array(z.enum(CLAY_SENIORITY)).default([]), countries: words }).optional(),
});

export const clayCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CompaniesIn.parse(d))
  .handler(async ({ data, context }) => findCompanies(await userCtx(context.supabase as Db, context.userId), data));

export const clayPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeopleIn.parse(d))
  .handler(async ({ data, context }) => findPeople(await userCtx(context.supabase as Db, context.userId), data));

export const clayEnrich = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => enrichAccount(await userCtx(context.supabase as Db, context.userId), data.accountId));

export const clayIndustryList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await userCtx(context.supabase as Db, context.userId);
    return clayIndustries();
  });
