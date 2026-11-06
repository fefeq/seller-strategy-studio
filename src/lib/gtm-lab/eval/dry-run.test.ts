// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { framework } from "../methodology";
import { EVAL_PASSES } from "./budget";
import { allCases, CALIBRATION, casesFor, FIXTURES, PINNED_MODEL } from "./cases";
import { dryRun } from "./dry-run";

let dir: string;
const fetchSpy = vi.fn();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nk48-dry-"));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchSpy.mockReset();
});

describe("eval cases (gtm-lab eval-suggest.mjs)", () => {
  it("the fixtures are valid as «done» and give the 24 cases of the baseline", () => {
    expect(allCases(framework)).toHaveLength(24);
  });

  it("the holdout fixtures are valid too", () => {
    expect(allCases(framework, FIXTURES.holdout)).toHaveLength(8);
  });

  it("the pilot is the 5 calibration cases, in order", () => {
    expect(casesFor("pilot", framework).map((c) => c.id)).toEqual(CALIBRATION);
  });

  it("the step under evaluation starts empty", () => {
    const c = casesFor("pilot", framework)[0];
    expect(c.request.user).toContain("# Borrador actual del founder\n\n(vacío)");
  });
});

describe("dry run (NK-0048 CA-15)", () => {
  it.each(EVAL_PASSES)(
    "pass %s builds every request without network or key, into the given folder",
    (pass) => {
      const { file, count } = dryRun(framework, pass, join(dir, pass));
      expect(file).toBe(join(dir, pass, "dry-run.json"));
      expect(existsSync(file)).toBe(true);
      expect(count).toBe(pass === "pilot" ? 5 : 24);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("the OpenRouter passes use the pinned body; the reference, the Anthropic body", () => {
    dryRun(framework, "full", join(dir, "full"));
    dryRun(framework, "reference", join(dir, "reference"));
    const full = JSON.parse(readFileSync(join(dir, "full", "dry-run.json"), "utf8"));
    const reference = JSON.parse(readFileSync(join(dir, "reference", "dry-run.json"), "utf8"));
    expect(full.cases[0].body.model).toBe(PINNED_MODEL);
    expect(full.cases[0].body.provider).toEqual({
      order: ["anthropic"],
      allow_fallbacks: false,
      require_parameters: true,
    });
    expect(reference.cases[0].body.model).toBe("claude-sonnet-5-5");
    expect(reference.cases[0].body.fallbacks).toBe("default");
  });

  it("the same prompt goes to both routes", () => {
    dryRun(framework, "full", join(dir, "full"));
    dryRun(framework, "reference", join(dir, "reference"));
    const full = JSON.parse(readFileSync(join(dir, "full", "dry-run.json"), "utf8"));
    const reference = JSON.parse(readFileSync(join(dir, "reference", "dry-run.json"), "utf8"));
    for (let i = 0; i < 24; i++) {
      expect(full.cases[i].body.messages[0].content[0].text).toBe(
        reference.cases[i].body.system[0].text,
      );
      expect(full.cases[i].body.messages[1].content).toBe(
        reference.cases[i].body.messages[0].content,
      );
      expect(full.cases[i].body.response_format.json_schema.schema).toEqual(
        reference.cases[i].body.output_config.format.schema,
      );
    }
  });

  it("writes no key or header to the evidence", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test-fake");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-fake");
    dryRun(framework, "reference", join(dir, "reference"));
    const text = readFileSync(join(dir, "reference", "dry-run.json"), "utf8");
    expect(text).not.toMatch(/sk-or-|sk-ant-|x-api-key|Authorization/);
  });
});
