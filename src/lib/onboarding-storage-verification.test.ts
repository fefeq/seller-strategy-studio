import { describe, expect, it, vi } from "vitest";
import { provisionOnboardingStorage } from "./onboarding-storage.server";

describe("F2: reproducible native Storage provisioning", () => {
  it("creates a private 20 MB bucket with exactly the four allowed MIME types", async () => {
    const storage = { getBucket: vi.fn().mockResolvedValue({ data: null, error: { status: 404 } }), createBucket: vi.fn().mockResolvedValue({ data: { name: "onboarding-sources" }, error: null }) };
    await provisionOnboardingStorage({ storage } as unknown as Parameters<typeof provisionOnboardingStorage>[0]);
    expect(storage.createBucket).toHaveBeenCalledWith("onboarding-sources", { public: false, fileSizeLimit: 20_971_520, allowedMimeTypes: ["application/pdf", "text/plain", "text/markdown", "text/csv"] });
  });
  it("does not change an existing bucket or its documents", async () => {
    const storage = { getBucket: vi.fn().mockResolvedValue({ data: { id: "onboarding-sources" }, error: null }), createBucket: vi.fn() };
    expect((await provisionOnboardingStorage({ storage } as unknown as Parameters<typeof provisionOnboardingStorage>[0])).created).toBe(false);
    expect(storage.createBucket).not.toHaveBeenCalled();
  });
  it("does not create a bucket on permission or connectivity errors", async () => {
    const storage = { getBucket: vi.fn().mockResolvedValue({ data: null, error: { status: 403 } }), createBucket: vi.fn() };
    await expect(provisionOnboardingStorage({ storage } as unknown as Parameters<typeof provisionOnboardingStorage>[0])).rejects.toMatchObject({ status: 403 });
    expect(storage.createBucket).not.toHaveBeenCalled();
  });
});