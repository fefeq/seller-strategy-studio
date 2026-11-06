// GTM Lab eval runner (SDD-20261101-gtm-lab-1-core §13). Never part of `vitest run` nor of the gate: launched by
// hand, e.g. GTM_LAB_EVAL_MODE=dry-run GTM_LAB_EVAL_PASS=pilot npx vitest run --config vitest.eval.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/gtm-lab/*.eval.ts"],
    // A full pass of 24 cases took between 4.5 and 6.3 minutes in gtm-lab; 30 minutes is the ceiling of one run.
    testTimeout: 30 * 60 * 1000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
