// Server-side schema of the `onboarding_read` job input. Kept out of onboarding-sources.ts on purpose: that module is
// imported by client screens, and zod would land in their chunk (NK-0164, D-S8-5).
import { z } from "zod";
import { MAX_FILES, MAX_SOURCES } from "@/lib/onboarding-files-limit";

/** Input of the `onboarding_read` background job. Own module (zod) imported only by background.functions.ts and tests, so client chunks never carry the zod runtime (D-S8-5). */
export const onboardingReadInput = z
  .object({
    depth: z.enum(["express", "standard", "deep"]),
    url: z.string().trim().max(500).default(""),
    text: z.string().max(40_000).default(""),
    files: z
      .array(
        z.object({
          filename: z.string().max(200),
          dataUrl: z.string().startsWith("data:").max(6_000_000),
        }),
      )
      .max(MAX_FILES)
      .default([]),
    // Documents by reference only (storage path or Drive id): the request never carries their content.
    sources: z
      .array(
        z.object({
          kind: z.enum(["storage", "drive"]),
          ref: z
            .string()
            .trim()
            .min(3)
            .max(400)
            .refine((r) => !r.startsWith("data:"), "Solo referencias"),
          name: z.string().trim().min(1).max(200),
        }),
      )
      .max(MAX_SOURCES)
      .default([]),
  })
  .refine(
    (i) => i.url || i.text.trim() || i.files.length || i.sources.length,
    "Añade una web, texto o un documento",
  );
