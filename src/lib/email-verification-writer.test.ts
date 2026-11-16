import { beforeEach, describe, expect, it, vi } from "vitest";

// NK-0173 SDD 2: every Apollo reveal stores the email status it already returns, written only by the
// privileged client with an explicit org_id (the table has no insert policy for members).
const upserts: { rows: unknown; onConflict?: string }[] = [];
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      upsert: async (rows: unknown, opts?: { onConflict?: string }) => {
        upserts.push({ rows, onConflict: opts?.onConflict });
        return { error: null };
      },
    }),
  },
}));

import { buildVerificationRow, recordApolloVerifications } from "./email-verification-writer";

const ORG = "org-1";
const ME = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-11-13T10:00:00Z");

beforeEach(() => upserts.splice(0));

describe("buildVerificationRow", () => {
  it("CA-3 normalizes the email and fixes provider, source, date and requester", () => {
    const row = buildVerificationRow({
      orgId: ORG,
      email: "  SYNTHETIC@EXAMPLE.INVALID ",
      providerStatus: "verified",
      requestedBy: ME,
      now,
    });
    expect(row).toEqual({
      org_id: ORG,
      email: "synthetic@example.invalid",
      status: "verified",
      provider_status: "verified",
      provider: "apollo",
      source: "revelado_apollo",
      checked_at: now.toISOString(),
      requested_by: ME,
    });
  });
  it("CA-4 an unknown or absent provider value is never verified, and no email means no row", () => {
    for (const value of [null, undefined, "", "extrapolated", "surprise"])
      expect(
        buildVerificationRow({
          orgId: ORG,
          email: "a@example.invalid",
          providerStatus: value,
          requestedBy: ME,
          now,
        })?.status,
      ).toBe("unverifiable");
    expect(
      buildVerificationRow({
        orgId: ORG,
        email: " ",
        providerStatus: "verified",
        requestedBy: ME,
        now,
      }),
    ).toBeNull();
    expect(
      buildVerificationRow({
        orgId: ORG,
        email: null,
        providerStatus: "verified",
        requestedBy: ME,
        now,
      }),
    ).toBeNull();
  });
  it("CA-3 the literal provider value is kept short for auditing", () => {
    const row = buildVerificationRow({
      orgId: ORG,
      email: "a@example.invalid",
      providerStatus: "x".repeat(200),
      requestedBy: ME,
      now,
    });
    expect(row?.provider_status).toHaveLength(120);
  });
});

describe("recordApolloVerifications", () => {
  it("CA-3 upserts by company and email with the privileged client", async () => {
    const row = buildVerificationRow({
      orgId: ORG,
      email: "a@example.invalid",
      providerStatus: "verified",
      requestedBy: ME,
      now,
    })!;
    await recordApolloVerifications([row]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].onConflict).toBe("org_id,email");
    expect(upserts[0].rows).toEqual([row]);
  });
  it("CA-4 writes nothing when there are no rows", async () => {
    await recordApolloVerifications([]);
    expect(upserts).toHaveLength(0);
  });
});
