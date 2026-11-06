// Dry run of an eval pass: builds every request body of the pass, with no network and no key, and writes them to
// `outDir/dry-run.json` (NK-0048 CA-15). Only bodies are written: headers carry keys and never reach the evidence.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openrouterPinnedBody } from "@/lib/ai-pinned";
import type { Framework } from "../core";
import type { EvalPass } from "./budget";
import { casesFor, PINNED_MODEL, SCHEMA_NAME, type EvalCase } from "./cases";
import { REFERENCE_MODEL, referenceBody } from "./reference-request";

/** Generation route of each pass: OpenRouter with the pinned model, or Anthropic direct for the reference. */
export function generationRoute(pass: EvalPass): {
  route: "openrouter" | "anthropic";
  model: string;
} {
  return pass === "reference"
    ? { route: "anthropic", model: REFERENCE_MODEL }
    : { route: "openrouter", model: PINNED_MODEL };
}

export function generationBody(pass: EvalPass, c: EvalCase): Record<string, unknown> {
  return pass === "reference"
    ? referenceBody(c.request)
    : openrouterPinnedBody(PINNED_MODEL, c.request.system, c.request.user, {
        schema: { name: SCHEMA_NAME, schema: c.request.schema },
      });
}

export function dryRun(
  framework: Framework,
  pass: EvalPass,
  outDir: string,
): { file: string; lines: string[]; count: number } {
  const cases = casesFor(pass, framework);
  const { route, model } = generationRoute(pass);
  const rows = cases.map((c) => ({
    id: c.id,
    step: c.step,
    userChars: c.request.user.length,
    emptyContext: c.request.user.includes("(sin contexto)"),
    body: generationBody(pass, c),
  }));
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, "dry-run.json");
  writeFileSync(file, JSON.stringify({ pass, route, model, cases: rows }, null, 2));
  const lines = rows.map(
    (r) =>
      `${r.id.padEnd(36)} ${String(r.userChars).padStart(5)} caracteres${r.emptyContext ? "  ⚠ sin contexto" : ""}`,
  );
  lines.push(
    `\n${rows.length} peticiones construidas (pasada «${pass}», ${route}, ${model}), 0 llamadas a la API. Detalle: ${file}`,
  );
  return { file, lines, count: rows.length };
}
