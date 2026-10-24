// Google Drive from the screens (any member of the active company). Same cores as the agent tools (drive-core.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";

const SECTIONS = ["company", "objections", "playbooks", "methodology", "campaigns", "skills", "rules"] as const;
const Ref = z.string().trim().min(5).max(500);

async function scope(context: { supabase: unknown; userId: string }) {
  const c = await userCtx(context.supabase as Db, context.userId);
  return { db: c.db, orgId: c.orgId, userId: c.userId };
}

export const driveBrowse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ folderId: Ref.optional(), query: z.string().max(100).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { browse } = await import("@/lib/drive-core");
    return browse(await scope(context), data);
  });

export const driveImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ file: Ref, section: z.enum(SECTIONS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { importToKnowledge } = await import("@/lib/drive-core");
    return importToKnowledge(await scope(context), data.file, data.section);
  });

/** Text of one file for the AI setup (nothing is saved). */
export const driveRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ file: Ref }).parse(d))
  .handler(async ({ data, context }) => {
    const { readFile } = await import("@/lib/drive-core");
    const r = await readFile(await scope(context), data.file);
    return { name: r.name, text: r.text.slice(0, 30_000), truncated: r.truncated || r.text.length > 30_000 };
  });

const AccountIn = z.object({ accountId: z.string().uuid() });

export const accountDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AccountIn.parse(d))
  .handler(async ({ data, context }) => {
    const { accountFiles } = await import("@/lib/drive-core");
    return accountFiles(await scope(context), data.accountId);
  });

export const createAccountFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AccountIn.parse(d))
  .handler(async ({ data, context }) => {
    const { accountFolder } = await import("@/lib/drive-core");
    return accountFolder(await scope(context), data.accountId, true);
  });

export const linkAccountDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AccountIn.extend({ folder: Ref }).parse(d))
  .handler(async ({ data, context }) => {
    const { linkAccountFolder } = await import("@/lib/drive-core");
    return linkAccountFolder(await scope(context), data.accountId, data.folder);
  });

export const saveToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().trim().min(1).max(200), markdown: z.string().min(1).max(300_000), accountId: z.string().uuid().nullish() }).parse(d))
  .handler(async ({ data, context }) => {
    const { saveDocument } = await import("@/lib/drive-core");
    return saveDocument(await scope(context), data);
  });

/** Conocimiento → «Drive por cuenta». */
export const driveAccountsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { accountsOverview } = await import("@/lib/drive-core");
    return accountsOverview(await scope(context));
  });

export const summarizeDriveDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fileId: Ref, accountId: z.string().uuid().nullish() }).parse(d))
  .handler(async ({ data, context }) => {
    const { summarizeDoc } = await import("@/lib/drive-core");
    return summarizeDoc(await scope(context), data.fileId, data.accountId ?? null);
  });
