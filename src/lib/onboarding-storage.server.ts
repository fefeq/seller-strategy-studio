import type { Db } from "@/lib/org-data";
import { MAX_UPLOAD_BYTES } from "@/lib/onboarding-source-refs";

/** Explicit provisioning only, never called by a page, job or signup. Storage schema is managed by its API. */
export const ONBOARDING_BUCKET = {
  id: "onboarding-sources",
  options: {
    public: false,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: ["application/pdf", "text/plain", "text/markdown", "text/csv"],
  },
};

export async function provisionOnboardingStorage(db: Pick<Db, "storage">) {
  const current = await db.storage.getBucket(ONBOARDING_BUCKET.id);
  if (current.error && !["404", "400"].includes(String(current.error.status))) throw current.error;
  // Do not overwrite an existing bucket: audit its settings separately, matching the requested ON CONFLICT behavior.
  if (current.data) return { created: false, bucket: current.data };
  const created = await db.storage.createBucket(ONBOARDING_BUCKET.id, ONBOARDING_BUCKET.options);
  if (created.error) throw created.error;
  return { created: true, bucket: created.data };
}
