// C2: per-company Google Drive account. Only the Owner connects/disconnects (CA-10); members read the safe status.
// The connection key is encrypted at rest and never leaves the server. Disconnecting keeps everything already imported.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/org-data";
import { userCtx } from "@/lib/agent.functions";
import { errorText } from "@/lib/errors";
import { canManageDrive, driveCompanyState, DRIVE_CLIENT_ENV, DRIVE_CONNECTOR, DRIVE_SCOPES, type DriveCompanyState } from "@/lib/drive-company";

const GATEWAY = "https://connector-gateway.lovable.dev";
const OWNER_ONLY = "Solo el Owner de la empresa puede conectar, cambiar o desconectar el Drive.";

async function ownerCtx(supabase: Db, userId: string) {
  const c = await userCtx(supabase, userId);
  if (!canManageDrive(c.roles)) throw new Error(OWNER_ONLY);
  return c;
}

export const driveCompanyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ state: DriveCompanyState; canManage: boolean }> => {
    const c = await userCtx(context.supabase as Db, context.userId);
    const { data, error } = await context.supabase.rpc("drive_company_connection_status", { _org: c.orgId });
    if (error) throw new Error(errorText(error));
    const row = data?.[0] ?? null;
    let by: string | null = null;
    if (row?.connected_by) {
      const { data: p } = await context.supabase.from("profiles").select("full_name").eq("id", row.connected_by).maybeSingle();
      by = p?.full_name || "Un miembro del equipo";
    }
    return {
      state: driveCompanyState(!!process.env[DRIVE_CLIENT_ENV], row ? { ...row, by } : null),
      canManage: canManageDrive(c.roles),
    };
  });

export const startDriveCompanyConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ownerCtx(context.supabase as Db, context.userId);
    const clientKey = process.env[DRIVE_CLIENT_ENV];
    if (!clientKey) throw new Error("La conexión con Google aún no está preparada en NOKKO.");
    const request = getRequest();
    if (!request) throw new Error("La conexión debe empezar desde la app.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/api/oauth/google-drive/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY,
      connectorId: DRIVE_CONNECTOR,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      credentialsConfiguration: { scopes: DRIVE_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeDriveCompanyConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await ownerCtx(context.supabase as Db, context.userId);
    const { exchangeAppUserOAuthCode, callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
    const { encryptConnectionKey } = await import("@/lib/connection-key-crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY, data.code);
    if (connectorId !== DRIVE_CONNECTOR) throw new Error("Google devolvió una conexión que no es de Drive.");
    let email: string | null = null;
    const about = await callAsAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey, connectorId, path: "/drive/v3/about?fields=user(emailAddress)", requiredScopes: DRIVE_SCOPES });
    if (about.ok) email = ((await about.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null;
    // Transition backup (once per company): copy the current shared-Drive folder rows before switching. Nothing is deleted.
    const { count } = await supabaseAdmin.from("drive_folders_backup").select("id", { count: "exact", head: true }).eq("org_id", c.orgId);
    if (!count) {
      const { data: folders, error } = await supabaseAdmin.from("drive_folders").select("*").eq("org_id", c.orgId);
      if (error) throw new Error(errorText(error));
      if (folders?.length) {
        const ins = await supabaseAdmin.from("drive_folders_backup").insert(folders.map((f) => ({ org_id: c.orgId, folder_row: f })));
        if (ins.error) throw new Error(errorText(ins.error));
      }
    }
    const up = await supabaseAdmin.from("drive_company_connections").upsert({
      org_id: c.orgId,
      connection_key_enc: await encryptConnectionKey(connectionAPIKey),
      account_email: email,
      connected_by: context.userId,
      connected_at: new Date().toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
    });
    if (up.error) throw new Error(errorText(up.error));
    return { email };
  });

export const disconnectDriveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await ownerCtx(context.supabase as Db, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("drive_company_connections").select("connection_key_enc").eq("org_id", c.orgId).maybeSingle();
    if (!row) return { ok: true };
    const { decryptConnectionKey } = await import("@/lib/connection-key-crypto.server");
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    try {
      await disconnectAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: await decryptConnectionKey(row.connection_key_enc), connectorId: DRIVE_CONNECTOR });
    } catch (e) {
      console.error("drive disconnect at gateway failed", e instanceof Error ? e.message.slice(0, 120) : "");
    }
    // CA-4: stop reading at once. Imported knowledge keeps its origin and is never deleted.
    const del = await supabaseAdmin.from("drive_company_connections").delete().eq("org_id", c.orgId);
    if (del.error) throw new Error(errorText(del.error));
    return { ok: true };
  });
