// GTM Lab eval passes (SDD-20261101-gtm-lab-1-core CA-14..CA-19). Orchestration only: every rule lives in
// src/lib/gtm-lab/eval/ (tested). Launched by hand with vitest.eval.config.ts; mode and pass go by env vars because
// vitest rejects unknown flags. The spend cap never does: it comes from APPROVED_USD.
//   GTM_LAB_EVAL_MODE = dry-run | run | record-cost
//   GTM_LAB_EVAL_PASS = pilot | reference | full
//   record-cost also needs GTM_LAB_EVAL_COST_USD, GTM_LAB_EVAL_COST_SOURCE, GTM_LAB_EVAL_COST_APPROVED_BY and
//   optionally GTM_LAB_EVAL_COST_DATE (AAAA-MM-DD, today by default).
// Keys come from .env.local (git-ignored) or the environment; they are never logged nor written to the evidence.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { it } from "vitest";
import { askPinned, type PinnedResult } from "@/lib/ai-pinned";
import { validateDeliverable } from "@/lib/gtm-lab/core";
import { framework } from "@/lib/gtm-lab/methodology";
import { costUsd, type AnthropicMessage, type Env } from "@/lib/gtm-lab/eval/anthropic-http";
import { EVAL_PASSES, recordManualCost, withRun, type EvalPass } from "@/lib/gtm-lab/eval/budget";
import { casesFor, PINNED_MODEL, SCHEMA_NAME, type EvalCase } from "@/lib/gtm-lab/eval/cases";
import { optionsText, runChecks } from "@/lib/gtm-lab/eval/checks";
import { dryRun, generationRoute } from "@/lib/gtm-lab/eval/dry-run";
import { judgeRequest, judgeVerdict, type Verdict } from "@/lib/gtm-lab/eval/judge-request";
import {
  REFERENCE_MODEL,
  referenceRequest,
  referenceResult,
} from "@/lib/gtm-lab/eval/reference-request";
import { summarize, type CaseResult } from "@/lib/gtm-lab/eval/report";
import { FACTORY_DIR } from "../factory/paths.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const MODES = ["dry-run", "run", "record-cost"] as const;
type Mode = (typeof MODES)[number];

/** KEY=value lines; the values never leave this process (no logs, no output files). */
function readEnvFile(path: string): Env {
  if (!existsSync(path)) return {};
  const env: Env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

class CallError extends Error {}

interface Generation {
  model: string | null;
  provider: string | null;
  stopReason: string | null;
  output: unknown;
  costUsd: number | null;
  byok: boolean | null;
  usage: unknown;
  latencyMs: number;
  /** Reference only: a server-side fallback answered with another model. */
  fallbackModel?: boolean;
}

async function postAnthropic(
  request: { url: string; headers: Record<string, string>; body: Record<string, unknown> },
  what: string,
): Promise<AnthropicMessage> {
  let res: Response;
  try {
    res = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
    });
  } catch {
    throw new CallError(`${what}: Anthropic no respondió`);
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new CallError(`${what}: Anthropic HTTP ${res.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as AnthropicMessage;
  } catch {
    throw new CallError(`${what}: Anthropic devolvió una respuesta inválida`);
  }
}

async function generate(pass: EvalPass, c: EvalCase, env: Env): Promise<Generation> {
  const started = Date.now();
  if (pass === "reference") {
    const request = referenceRequest(c.request, env);
    if (!request) throw new CallError("Falta ANTHROPIC_API_KEY");
    const message = await postAnthropic(request, "generación");
    const result = referenceResult(message);
    return {
      model: result.model,
      provider: "anthropic",
      stopReason: result.stopReason,
      output: result.output,
      costUsd: costUsd(message.model, message.usage),
      byok: null,
      usage: message.usage,
      latencyMs: Date.now() - started,
      fallbackModel: !(
        message.model === REFERENCE_MODEL || message.model.startsWith(`${REFERENCE_MODEL}-`)
      ),
    };
  }
  let result: PinnedResult;
  try {
    result = await askPinned(
      PINNED_MODEL,
      c.request.system,
      c.request.user,
      { schema: { name: SCHEMA_NAME, schema: c.request.schema } },
      env,
    );
  } catch (error) {
    throw new CallError(`generación: ${(error as Error).message}`);
  }
  return {
    model: result.model,
    provider: result.provider,
    stopReason: result.stopReason,
    output: result.output,
    costUsd: result.usage.costUsd,
    byok: result.usage.byok,
    usage: result.usage,
    latencyMs: Date.now() - started,
  };
}

async function judge(c: EvalCase, output: unknown, env: Env) {
  const started = Date.now();
  const request = judgeRequest(c.request.user, output, env);
  if (!request) throw new CallError("Falta ANTHROPIC_API_KEY");
  const message = await postAnthropic(request, "juez");
  return {
    model: message.model,
    latencyMs: Date.now() - started,
    usage: message.usage,
    costUsd: costUsd(message.model, message.usage),
    stopReason: message.stop_reason,
    verdict: judgeVerdict(message),
  };
}

interface CaseRecord {
  id: string;
  providerError: string | null;
  generation: Generation | null;
  checks: ReturnType<typeof runChecks>["checks"] | null;
  pass: boolean;
  judge: Awaited<ReturnType<typeof judge>> | null;
}

const usd = (n: number | null) => (n === null ? "sin dato" : `$${n.toFixed(4)}`);

async function runPass(pass: EvalPass, evidence: string, out: string) {
  const env: Env = { ...readEnvFile(join(ROOT, ".env.local")), ...process.env };
  const { route, model } = generationRoute(pass);
  if (route === "openrouter" && !env["OPENROUTER_API_KEY"])
    throw new Error("Falta OPENROUTER_API_KEY (en .env.local o en el entorno).");
  if (!env["ANTHROPIC_API_KEY"])
    throw new Error("Falta ANTHROPIC_API_KEY (en .env.local o en el entorno): la usa el juez.");
  const cases = casesFor(pass, framework);
  mkdirSync(out, { recursive: true });

  await withRun(evidence, pass, { now: () => new Date(), pid: process.pid }, async (run) => {
    const startedAt = new Date().toISOString();
    const file = join(out, `run-${startedAt.replace(/[:.]/g, "-")}.json`);
    const records: CaseRecord[] = [];
    let stoppedBy: string | null = null;
    const save = () => {
      const results: CaseResult[] = records.map((r) => ({
        id: r.id,
        providerError: r.providerError,
        stopReason: r.generation?.stopReason ?? null,
        checks: r.checks,
        pass: r.pass,
        verdict: (r.judge?.verdict ?? null) as Verdict | null,
      }));
      writeFileSync(
        file,
        JSON.stringify(
          {
            pass,
            route,
            model,
            startedAt,
            capUsd: run.capUsd,
            spentUsd: run.spentUsd(),
            stoppedBy,
            summary: summarize(results),
            results: records,
          },
          null,
          2,
        ),
      );
    };
    console.log(
      `Pasada «${pass}» (${route}, ${model}): ${cases.length} casos, tope de esta ejecución $${run.capUsd.toFixed(4)}.`,
    );

    for (const c of cases) {
      if (run.overCap()) {
        stoppedBy = "tope";
        break;
      }
      let generation: Generation;
      try {
        generation = await generate(pass, c, env);
      } catch (error) {
        records.push({
          id: c.id,
          providerError: (error as Error).message,
          generation: null,
          checks: null,
          pass: false,
          judge: null,
        });
        stoppedBy = "error del proveedor";
        break;
      }
      const record: CaseRecord = {
        id: c.id,
        providerError: null,
        generation,
        checks: null,
        pass: false,
        judge: null,
      };
      records.push(record);
      if (run.record(generation.costUsd, `${c.id} (generación)`) === "no-data") {
        stoppedBy = "sin dato (coste de la generación)";
        break;
      }
      const report = runChecks({
        validate: (output) => validateDeliverable(framework, c.step, output, "done"),
        source: `${c.request.user}\n${optionsText(c.request.schema)}`,
        result: { stopReason: generation.stopReason, output: generation.output },
      });
      record.checks = report.checks;
      record.pass = report.pass;
      if (run.canJudge() && report.checks.finished.length === 0) {
        try {
          record.judge = await judge(c, generation.output, env);
        } catch (error) {
          record.providerError = (error as Error).message;
          stoppedBy = "error del proveedor (juez)";
          break;
        }
        if (run.record(record.judge.costUsd, `${c.id} (juez)`) === "no-data") {
          stoppedBy = "sin dato (coste del juez)";
          break;
        }
      }
      save();
      const v = record.judge?.verdict;
      console.log(
        `${c.id.padEnd(30)} ${generation.model ?? "?"} ${generation.provider ?? "?"} ${generation.latencyMs} ms ` +
          `${usd(generation.costUsd)}${generation.byok === null ? "" : ` byok:${generation.byok}`}` +
          `${generation.fallbackModel ? " ⚠ respaldo" : ""} · ${generation.stopReason} · checks ${report.pass ? "OK" : "FALLA"}` +
          ` · juez ${v ? `${v.concreta.nota} ${v.coherente.nota} ${v.accionable.nota} inv:${v.invencion.hay}` : "—"}`,
      );
    }
    if (!stoppedBy && run.overCap()) stoppedBy = "tope";
    save();
    console.log(
      `\n${records.length} de ${cases.length} casos, gasto de esta ejecución $${run.spentUsd().toFixed(4)}` +
        `${stoppedBy ? `, detenida: ${stoppedBy}` : ""}. Detalle: ${file}`,
    );
  });
}

it("gtm-lab eval (NK-0048)", async () => {
  const mode = process.env["GTM_LAB_EVAL_MODE"] as Mode | undefined;
  const pass = process.env["GTM_LAB_EVAL_PASS"] as EvalPass | undefined;
  if (!mode || !MODES.includes(mode))
    throw new Error(`GTM_LAB_EVAL_MODE debe ser ${MODES.join(", ")}.`);
  if (!pass || !EVAL_PASSES.includes(pass))
    throw new Error(`GTM_LAB_EVAL_PASS debe ser ${EVAL_PASSES.join(", ")}.`);
  const evidence = join(FACTORY_DIR, "evidence", "NK-0048");
  const out = join(evidence, pass);

  if (mode === "dry-run") {
    for (const line of dryRun(framework, pass, out).lines) console.log(line);
    return;
  }
  if (mode === "record-cost") {
    const result = recordManualCost(evidence, pass, {
      costUsd: Number(process.env["GTM_LAB_EVAL_COST_USD"]),
      source: process.env["GTM_LAB_EVAL_COST_SOURCE"] ?? "",
      approvedBy: process.env["GTM_LAB_EVAL_COST_APPROVED_BY"] ?? "",
      date: process.env["GTM_LAB_EVAL_COST_DATE"] ?? new Date().toISOString().slice(0, 10),
    });
    if (!result.ok) throw new Error(result.message);
    console.log(
      `Coste manual anotado en la pasada «${pass}». Total $${result.ledger.spentUsd.toFixed(4)} de $${result.ledger.approvedUsd}.`,
    );
    return;
  }
  await runPass(pass, evidence, out);
});
