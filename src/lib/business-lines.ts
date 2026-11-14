import { diagnose, type DiagnosisInput } from "./gtm-diagnosis";

/** Valid declared answers only; no defaults, coercion or derived ticket. */
export function readLineInput(raw: unknown): DiagnosisInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const { model, acv, friction, stage } = record;
  if (model !== "b2b" && model !== "b2c" && model !== "marketplace") return null;
  if (typeof acv !== "number" || !Number.isFinite(acv) || acv <= 0) return null;
  if (friction !== "self_serve" && friction !== "committee") return null;
  if (stage !== "idea" && stage !== "early" && stage !== "scale") return null;
  return { model, acv, friction, stage };
}

export function lineDiagnosis(raw: unknown) {
  const input = readLineInput(raw);
  return input ? diagnose(input) : null;
}

type SummarySource = { id: string; is_primary: boolean; position: number };

/** Safe projection for future agent readers: no customer labels or ticket-bearing reasons. */
export function summarizeLines<T extends SummarySource>(lines: readonly T[]) {
  return [...lines].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).flatMap((line) => {
    const input = readLineInput(line);
    if (!input) return [];
    const result = diagnose(input);
    return [{ id: line.id, isPrimary: line.is_primary, position: line.position, archetype: result.archetype,
      motion: result.motion, stage: input.stage, nextStep: result.nextStep }];
  });
}