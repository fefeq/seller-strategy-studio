import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { TOOLS } from "@/lib/agent/tools";
it("dump", () => {
  writeFileSync(process.env.OUT!, JSON.stringify(TOOLS.map((t) => [t.name, t.kind, t.description, (t.roles ?? []).join(","), t.summarize ? "s" : "", JSON.stringify(t.input._def)])));
});
