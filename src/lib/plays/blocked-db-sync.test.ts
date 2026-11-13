import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAYS } from "./catalog";

// NK-0081: the database refuses enabled=true for blocked/planned plays; its list must match the catalogue.
describe("blocked plays guard in the database", () => {
  it("lists exactly the blocked and planned plays of the catalogue", () => {
    const sql = readFileSync("drizzle/migrations/0087_price_suggestions_and_blocked_plays_guard.sql", "utf8");
    const body = sql.slice(sql.indexOf("NOT IN ("), sql.indexOf(")", sql.indexOf("NOT IN (")));
    const inDb = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const blocked = PLAYS.filter((p) => p.status === "bloqueado" || p.status === "planificado").map((p) => p.id).sort();
    expect(inDb).toEqual(blocked);
  });
});
