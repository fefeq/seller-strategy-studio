// Connect, check and disconnect an own account (SDD connections-bring-your-own-account, U-2). The rules are in
// connections.ts; this file orders the steps and talks to its ports, so it is tested with fakes and no provider.
// Server-only usage: the credential travels only through `credential` here, is never returned, logged or stored
// in the metadata row, and the port that seals it does not exist until Dani designs the store (SDD question 2).
import type { Db } from "@/lib/org-data";
import { PROVIDERS, SHARED_ACCOUNT_NOTE, accountKey, auditFor, canManage, connectOutcome, disconnectNote, needsSharedConfirmation, READ_ONLY_NOTE, type Audit, type CheckResult, type ConnectionRow, type Provider } from "@/lib/connections";

/** Provider-specific check: «does this credential work, and whose account is it?» Never returns the credential. */
export type Checker = (credential: string) => Promise<CheckResult>;

export type Store = {
  get(orgId: string, provider: string): Promise<ConnectionRow | null>;
  save(orgId: string, provider: string, row: { accountLabel: string; accountKey: string; userId: string }): Promise<void>;
  remove(orgId: string, provider: string): Promise<void>;
  /** Other companies with the same account at the same provider (a count: never who they are). */
  othersWithAccount(orgId: string, provider: string, key: string): Promise<number>;
  event(orgId: string, provider: string, audit: Audit, userId: string): Promise<void>;
};

export type Deps = {
  store: Store;
  checkers: Partial<Record<string, Checker>>;
  /** Seals and keeps the credential. Absent until the credential store is designed: then nothing can be saved. */
  storeCredential?: (orgId: string, provider: string, credential: string) => Promise<void>;
  discardCredential?: (orgId: string, provider: string) => Promise<void>;
  /** The registry; overridden only in tests. */
  providers?: Provider[];
};

export type ConnectInput = { orgId: string; userId: string; role: string | null; provider: string; credential: string; mode: "check" | "save"; confirmShared?: boolean };
export type ConnectResult =
  | { ok: false; message: string; retry?: boolean }
  | { ok: true; saved: false; accountLabel: string; message: string; needsConfirmation: boolean }
  | { ok: true; saved: true; accountLabel: string; message: string };

const MAX_CREDENTIAL = 4096;

export async function connectAccount(i: ConnectInput, d: Deps): Promise<ConnectResult> {
  if (!canManage(i.role)) return { ok: false, message: READ_ONLY_NOTE };
  const p = (d.providers ?? PROVIDERS).find((x) => x.id === i.provider);
  if (!p) return { ok: false, message: "Esa conexión no existe." };
  const checker = d.checkers[p.id];
  if (p.kind === "panel") return { ok: false, message: `${p.name} se conecta desde su propio panel en esta pantalla.` };
  if (!p.ownAccount || !checker) return { ok: false, message: `Todavía no puedes conectar tu propia cuenta de ${p.name}: por ahora solo la proporciona NOKKO.` };
  const credential = typeof i.credential === "string" ? i.credential.trim() : "";
  if (!credential) return { ok: false, message: `Falta la credencial de ${p.name}.` };
  if (credential.length > MAX_CREDENTIAL) return { ok: false, message: "Esa credencial es demasiado larga. Revisa que has copiado solo la clave." };

  // CA-5: the check runs before anything is kept; a thrown error is the provider not answering, not a bad key.
  let check: CheckResult;
  try { check = await checker(credential); } catch { check = { ok: false, reason: "", down: true }; }
  const outcome = connectOutcome(p.name, check);
  if (!outcome.save) {
    if (!check.ok && !check.down) await d.store.event(i.orgId, p.id, { action: "check_failed", accountLabel: "" }, i.userId);
    return { ok: false, message: outcome.message, retry: outcome.retry };
  }

  const key = accountKey(outcome.accountLabel);
  const others = await d.store.othersWithAccount(i.orgId, p.id, key);
  const needsConfirmation = needsSharedConfirmation(others, !!i.confirmShared);
  if (i.mode === "check" || needsConfirmation) {
    return { ok: true, saved: false, accountLabel: outcome.accountLabel, needsConfirmation, message: needsConfirmation ? `${outcome.message} ${SHARED_ACCOUNT_NOTE}` : outcome.message };
  }

  if (!d.storeCredential) return { ok: false, message: `No podemos guardar la credencial de ${p.name} todavía: falta el almacén cifrado. No hemos guardado la conexión.` };
  const previous = await d.store.get(i.orgId, p.id);
  // Last confirmed connection wins (section 8): the credential first, then the row, so a failure leaves no half connection.
  await d.storeCredential(i.orgId, p.id, credential);
  await d.store.save(i.orgId, p.id, { accountLabel: outcome.accountLabel, accountKey: key, userId: i.userId });
  await d.store.event(i.orgId, p.id, auditFor(previous, { accountLabel: outcome.accountLabel }), i.userId);
  return { ok: true, saved: true, accountLabel: outcome.accountLabel, message: outcome.message };
}

export type DisconnectResult = { ok: boolean; message: string };

/** CA-7, CA-8: stops using the account at once; what was imported stays. */
export async function disconnectAccount(i: { orgId: string; userId: string; role: string | null; provider: string }, d: Deps): Promise<DisconnectResult> {
  if (!canManage(i.role)) return { ok: false, message: READ_ONLY_NOTE };
  const p = (d.providers ?? PROVIDERS).find((x) => x.id === i.provider);
  if (!p || p.kind === "panel") return { ok: false, message: "Esa conexión no se desconecta desde aquí." };
  const previous = await d.store.get(i.orgId, p.id);
  if (!previous) return { ok: false, message: `No hay una cuenta propia de ${p.name} conectada.` };
  await d.discardCredential?.(i.orgId, p.id);
  await d.store.remove(i.orgId, p.id);
  await d.store.event(i.orgId, p.id, auditFor(previous, null), i.userId);
  return { ok: true, message: disconnectNote(p.name) };
}

/** The Supabase-backed store. Runs with the admin client after the Owner check in the server function. */
export function dbStore(db: Db): Store {
  return {
    async get(orgId, provider) {
      const { data, error } = await db.from("org_connections").select("provider,status,account_label,connected_by,connected_at,last_error,fallback_active").eq("org_id", orgId).eq("provider", provider).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { ...data, status: data.status as ConnectionRow["status"] } : null;
    },
    async save(orgId, provider, r) {
      const { error } = await db.from("org_connections").upsert(
        { org_id: orgId, provider, status: "connected", account_label: r.accountLabel, account_key: r.accountKey, connected_by: r.userId, connected_at: new Date().toISOString(), checked_at: new Date().toISOString(), last_error: null, fallback_active: false },
        { onConflict: "org_id,provider" },
      );
      if (error) throw new Error(error.message);
    },
    async remove(orgId, provider) {
      const { error } = await db.from("org_connections").delete().eq("org_id", orgId).eq("provider", provider);
      if (error) throw new Error(error.message);
    },
    async othersWithAccount(orgId, provider, key) {
      const { count, error } = await db.from("org_connections").select("id", { count: "exact", head: true }).eq("provider", provider).eq("account_key", key).neq("org_id", orgId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async event(orgId, provider, a, userId) {
      const { error } = await db.from("org_connection_events").insert({ org_id: orgId, provider, action: a.action, account_label: a.accountLabel, actor: userId });
      if (error) throw new Error(error.message);
    },
  };
}
