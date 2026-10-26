import { describe, expect, it } from "vitest";
import { PROVIDERS, STATE_LABEL, rowFromPosthog, rowFromStripe, accountKey, auditFor, canManage, connectOutcome, connectSteps, connectedLine, connectionState, coverageNote, disconnectNote, needsSharedConfirmation, providerById, visibleAccount, type ConnectionRow } from "./connections";

const apollo = providerById("apollo")!;
const drive = providerById("google_drive")!;
const posthog = providerById("posthog")!;
const row = (over: Partial<ConnectionRow> = {}): ConnectionRow => ({ provider: "apollo", status: "connected", account_label: "ventas@acme.test", connected_by: "u1", connected_at: "2026-10-20T10:00:00Z", last_error: null, ...over });

describe("registry", () => {
  it("has unique ids and a purpose for every provider (CA-3)", () => {
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
    for (const p of PROVIDERS) expect(p.purpose.length).toBeGreaterThan(10);
  });
  it("lists the five decided providers and Drive as the first case", () => {
    for (const id of ["google_drive", "apollo", "clay", "parallel", "perplexity", "firecrawl"]) expect(providerById(id)).not.toBeNull();
    expect(PROVIDERS[0]!.id).toBe("google_drive");
  });
});

describe("CA-1 connection state", () => {
  it("is own, error or no response when the company has a row", () => {
    expect(connectionState(posthog, row({ provider: "posthog" }), false)).toBe("own");
    expect(connectionState(posthog, row({ status: "error" }), false)).toBe("error");
    expect(connectionState(posthog, row({ status: "no_response" }), false)).toBe("no_response");
  });
  it("is provided by NOKKO or not connected without a row", () => {
    expect(connectionState(posthog, null, true)).toBe("nokko");
    expect(connectionState(posthog, null, false)).toBe("none");
  });
  it("says only NOKKO provides it while own accounts are not available", () => {
    expect(apollo.ownAccount).toBe(false);
    expect(connectionState(apollo, null, true)).toBe("nokko_only");
    expect(connectionState(apollo, null, false)).toBe("none");
  });
  it("shows a provider that is down as no response, never as disconnected", () => {
    expect(STATE_LABEL[connectionState(apollo, row({ status: "no_response" }), true)]).toBe("Sin respuesta");
  });
  it("labels every state with a word", () => {
    expect(STATE_LABEL).toEqual({ own: "Cuenta propia", nokko: "Proporcionada por NOKKO", none: "Sin conectar", error: "Error", no_response: "Sin respuesta", nokko_only: "Solo proporcionada por NOKKO" });
  });
});

describe("CA-2 who and since when, never the credential", () => {
  it("words the account, who connected it and how long ago", () => {
    const now = new Date("2026-10-22T10:00:00Z");
    expect(connectedLine(row(), "Ana Prueba", now)).toBe("ventas@acme.test · conectada por Ana Prueba · hace 2 días");
    expect(connectedLine(row({ connected_at: "2026-10-22T08:00:00Z" }), null, now)).toBe("ventas@acme.test · hoy");
  });
  it("refuses a visible identifier shaped like a key", () => {
    expect(visibleAccount("  ventas@acme.test ")).toBe("ventas@acme.test");
    expect(visibleAccount("sk_test_abcdefghijklmnopqrstuvwx")).toBeNull();
    expect(visibleAccount("phx_abcdefghijklmnopqrstuvwxyz")).toBeNull();
    expect(visibleAccount("A".repeat(48))).toBeNull();
    expect(visibleAccount("   ")).toBeNull();
  });
});

describe("CA-4 guided steps", () => {
  it("differ by connection kind and name the provider", () => {
    expect(connectSteps("oauth", "Google Drive")[0]).toMatch(/Elige la cuenta de Google Drive/);
    expect(connectSteps("key", "Apollo.io")[1]).toMatch(/cifrada/);
    expect(connectSteps("panel", "Stripe")).toHaveLength(1);
  });
});

describe("CA-5 and CA-6 check before saving", () => {
  it("saves only after a passing check and shows the account", () => {
    expect(connectOutcome("Apollo.io", { ok: true, accountLabel: "ventas@acme.test" })).toEqual({ save: true, accountLabel: "ventas@acme.test", message: "Funciona. Cuenta: ventas@acme.test." });
  });
  it("explains a failed check and saves nothing", () => {
    const o = connectOutcome("Apollo.io", { ok: false, reason: "La clave no es válida." });
    expect(o).toMatchObject({ save: false, retry: false });
    expect(o.message).toMatch(/La clave no es válida\. No hemos guardado/);
  });
  it("asks to retry when the provider did not answer", () => {
    expect(connectOutcome("Clay", { ok: false, reason: "", down: true })).toMatchObject({ save: false, retry: true });
  });
  it("does not save when the account identifier looks like a credential", () => {
    expect(connectOutcome("Clay", { ok: true, accountLabel: "sk_test_abcdefghijklmnopqrstuvwx" })).toMatchObject({ save: false });
  });
});

describe("CA-8 disconnect", () => {
  it("says the imported data stays", () => {
    expect(disconnectNote("Google Drive")).toMatch(/deja de usar tu cuenta de Google Drive ahora mismo.*no se borra/);
  });
});

describe("CA-10 audit and section 8", () => {
  it("records connect, change and disconnect", () => {
    expect(auditFor(null, { accountLabel: "a@x.test" }).action).toBe("connected");
    expect(auditFor(row(), { accountLabel: "b@x.test" }).action).toBe("changed");
    expect(auditFor(row({ status: "error" }), { accountLabel: "b@x.test" }).action).toBe("connected");
    expect(auditFor(row(), null)).toEqual({ action: "disconnected", accountLabel: "ventas@acme.test" });
  });
  it("asks for confirmation when the account is connected in another company", () => {
    expect(needsSharedConfirmation(1, false)).toBe(true);
    expect(needsSharedConfirmation(1, true)).toBe(false);
    expect(needsSharedConfirmation(0, false)).toBe(false);
    expect(accountKey(" Ventas@Acme.test ")).toBe("ventas@acme.test");
  });
});

describe("CA-11 roles", () => {
  it("only the owner manages", () => {
    expect(canManage("owner")).toBe(true);
    for (const r of ["sales_leader", "member", "viewer", null, undefined]) expect(canManage(r)).toBe(false);
  });
});

describe("CA-13 coverage note", () => {
  it("is shown only while NOKKO's account covers", () => {
    expect(coverageNote(row({ fallback_active: true }))).toMatch(/NOKKO usa la suya/);
    expect(coverageNote(row())).toBeNull();
    expect(coverageNote(null)).toBeNull();
  });
});

describe("drive is the first provider", () => {
  it("is OAuth and not enabled for own accounts until the Google client is decided", () => {
    expect(drive.kind).toBe("oauth");
    expect(drive.ownAccount).toBe(false);
  });
});

describe("existing panels read as connection rows", () => {
  it("maps PostHog and Stripe without exposing keys or hints", () => {
    const ph = rowFromPosthog({ project_id: "12345", status: "ok", created_at: "2026-10-01T00:00:00Z", created_by: "u1", last_error: null });
    expect(ph).toEqual({ provider: "posthog", status: "connected", account_label: "Proyecto 12345", connected_by: "u1", connected_at: "2026-10-01T00:00:00Z", last_error: null });
    expect(rowFromPosthog({ project_id: "1", status: "error", created_at: "x", created_by: null, last_error: "caducada" })!.status).toBe("error");
    const st = rowFromStripe({ account_name: "Acme Test", key_hint: "abcd", status: "pending", created_at: "2026-10-02T00:00:00Z", connected_by: null, last_error: null })!;
    expect(st).toMatchObject({ provider: "stripe", status: "connected", account_label: "Acme Test" });
    expect(JSON.stringify(st)).not.toContain("abcd");
    expect(rowFromPosthog(null)).toBeNull();
    expect(rowFromStripe(null)).toBeNull();
  });
});
