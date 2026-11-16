import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { columnsFromTypes } from "./field-coverage";

const root = path.resolve(__dirname, "../..");
const cols = columnsFromTypes(
  readFileSync(path.join(root, "src/integrations/supabase/types.ts"), "utf8"),
);

/** table → columns named in the track_field_sources(...) triggers of a migration. */
function tracked(file: string): Record<string, string[]> {
  const sql = readFileSync(path.join(root, "drizzle/migrations", file), "utf8");
  const out: Record<string, string[]> = {};
  for (const m of sql.matchAll(
    /CREATE TRIGGER \w+ BEFORE UPDATE ON public\.(\w+)\s+FOR EACH ROW EXECUTE FUNCTION public\.track_field_sources\(([^)]*)\)/g,
  )) {
    out[m[1]!] = [...m[2]!.matchAll(/'(\w+)'/g)].map((c) => c[1]!);
  }
  return out;
}

describe("field provenance triggers (migrations not applied: a typo here would only show on Dani's test environment)", () => {
  for (const file of ["0058_field_sources_generic.sql", "0061_field_sources_strategy.sql"]) {
    it(`${file} tracks only columns that exist`, () => {
      const t = tracked(file);
      expect(Object.keys(t).length).toBeGreaterThan(0);
      for (const [table, columns] of Object.entries(t)) {
        expect(cols.has(table), table).toBe(true);
        for (const c of columns) expect(cols.get(table)?.has(c), `${table}.${c}`).toBe(true);
      }
    });
  }

  it("the strategy tables the screens confirm per field are all covered", () => {
    expect(Object.keys(tracked("0061_field_sources_strategy.sql")).sort()).toEqual([
      "messaging_pillars",
      "positioning",
      "segments",
    ]);
  });
});

import { TRACKED_FIELDS } from "./field-actions";

describe("TRACKED_FIELDS mirrors the trigger columns of the migrations", () => {
  const a = tracked("0058_field_sources_generic.sql");
  const b = tracked("0061_field_sources_strategy.sql");
  it("accounts, icp_profiles, positioning, messaging_pillars and segments", () => {
    expect([...TRACKED_FIELDS.account].sort()).toEqual([...a["accounts"]!].sort());
    expect([...TRACKED_FIELDS.icp].sort()).toEqual([...a["icp_profiles"]!].sort());
    expect([...TRACKED_FIELDS.positioning].sort()).toEqual([...b["positioning"]!].sort());
    expect([...TRACKED_FIELDS.pillar].sort()).toEqual([...b["messaging_pillars"]!].sort());
    expect([...TRACKED_FIELDS.segment].sort()).toEqual([...b["segments"]!].sort());
  });
});
