import { describe, expect, it } from "vitest";
import {
  allotBudget, mergeRefs, ownsPath, statusOf, statusLabel, storagePath, uploadProblem,
} from "@/lib/onboarding-source-refs";
import { onboardingReadInput } from "@/lib/onboarding-read-input";
import { MAX_SOURCES } from "@/lib/onboarding-files-limit";

const ref = (i: number) => ({ kind: "drive" as const, ref: `id${i}`, name: `Doc ${i}` });

describe("onboarding sources by reference", () => {
  it("takes 20 sources and drops the 21st", () => {
    const r = mergeRefs([], Array.from({ length: 21 }, (_, i) => ref(i)));
    expect(MAX_SOURCES).toBe(20);
    expect(r.sources).toHaveLength(20);
    expect(r.dropped).toEqual(["Doc 20"]);
  });
  it("does not add the same document twice", () => {
    const r = mergeRefs([ref(1)], [ref(1)]);
    expect(r.sources).toHaveLength(1);
    expect(r.duplicated).toEqual(["Doc 1"]);
  });
  it("splits the budget fairly: short texts keep everything", () => {
    expect(allotBudget([100, 5000, 5000], 3000)).toEqual([100, 1450, 1450]);
    expect(allotBudget([10, 20], 1000)).toEqual([10, 20]);
    expect(allotBudget([0, 500], 100)).toEqual([0, 100]);
  });
  it("states full, partial and unread", () => {
    expect(statusOf(ref(1), 10, 10).state).toBe("full");
    expect(statusLabel(statusOf(ref(1), 1000, 4000))).toBe("Leída en parte: 1.000 de 4.000 caracteres");
    expect(statusLabel(statusOf(ref(1), 0, 0, "fuera de la carpeta"))).toBe("No leída: fuera de la carpeta");
  });
  it("refuses wrong types and files over 20 MB", () => {
    expect(uploadProblem({ name: "a.exe", size: 1 })).toMatch(/PDF/);
    expect(uploadProblem({ name: "a.pdf", size: 21 * 1024 * 1024 })).toMatch(/20 MB/);
    expect(uploadProblem({ name: "a.pdf", size: 1000 })).toBeNull();
  });
  it("only reads storage paths in the caller's own company folder", () => {
    const p = storagePath("org", "me", "u1", "Plan de negocio 2026.pdf");
    expect(p).toBe("org/me/u1-Plan_de_negocio_2026.pdf");
    expect(ownsPath(p, "org", "me")).toBe(true);
    expect(ownsPath("other/me/x.pdf", "org", "me")).toBe(false);
    expect(ownsPath("org/other/x.pdf", "org", "me")).toBe(false);
  });
  it("job input takes N references and rejects N+1, never file content", () => {
    const base = { depth: "express" as const };
    const ok = onboardingReadInput.safeParse({ ...base, sources: Array.from({ length: 20 }, (_, i) => ref(i)) });
    expect(ok.success).toBe(true);
    const tooMany = onboardingReadInput.safeParse({ ...base, sources: Array.from({ length: 21 }, (_, i) => ref(i)) });
    expect(tooMany.success).toBe(false);
    const content = onboardingReadInput.safeParse({ ...base, sources: [{ ...ref(1), ref: "data:application/pdf;base64,AAAA" }] });
    expect(content.success).toBe(false);
  });
});
