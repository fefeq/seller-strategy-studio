import { describe, expect, it } from "vitest";
import {
  canApproveAssignment,
  countryName,
  proposeAssignment,
  regionOf,
  ruleLabel,
  ruleMatches,
  tierWeight,
  validateAssignment,
  type AssignAccount,
  type AssignMember,
  type AssignRule,
} from "./assignment";

const acc = (id: string, o: Partial<AssignAccount> = {}): AssignAccount => ({
  id,
  name: id,
  tier: "B",
  segment_id: null,
  country: null,
  owner_id: null,
  ...o,
});
const mem = (user_id: string, o: Partial<AssignMember> = {}): AssignMember => ({
  user_id,
  name: user_id,
  role: "ae",
  max_accounts: null,
  ...o,
});
const rule = (id: string, members: string[], o: Partial<AssignRule> = {}): AssignRule => ({
  id,
  position: 1,
  segment_id: null,
  region: null,
  country: null,
  members,
  ...o,
});
const segNames = new Map([
  ["mm", "Mid-market"],
  ["ent", "Enterprise"],
]);

describe("regions and countries", () => {
  it("groups countries into the four markets and the rest", () => {
    expect(regionOf("ES")).toBe("es");
    expect(regionOf("us")).toBe("us");
    expect(regionOf("MX")).toBe("latam");
    expect(regionOf("BR")).toBe("latam");
    expect(regionOf("PT")).toBe("europe");
    expect(regionOf("JP")).toBe("other");
    expect(regionOf(null)).toBeNull();
    expect(regionOf("")).toBeNull();
  });
  it("names countries in Spanish", () => {
    expect(countryName("ES")).toBe("España");
    expect(countryName(null)).toBe("");
  });
  it("weighs tiers A 3, B 2, C 1 and no tier as B", () => {
    expect([tierWeight("A"), tierWeight("b"), tierWeight("C"), tierWeight(null)]).toEqual([
      3, 2, 1, 2,
    ]);
  });
  it("only Owner and Sales Leader approve", () => {
    expect(canApproveAssignment(["sales_leader"])).toBe(true);
    expect(canApproveAssignment(["ae"])).toBe(false);
  });
});

describe("rules", () => {
  it("match by segment, country and region; country wins over region; empty rule fits all", () => {
    const a = { segment_id: "mm", country: "MX" };
    expect(ruleMatches({ segment_id: "mm", region: null, country: null }, a)).toBe(true);
    expect(ruleMatches({ segment_id: "ent", region: null, country: null }, a)).toBe(false);
    expect(ruleMatches({ segment_id: null, region: "latam", country: null }, a)).toBe(true);
    expect(ruleMatches({ segment_id: null, region: "es", country: null }, a)).toBe(false);
    expect(ruleMatches({ segment_id: null, region: "es", country: "MX" }, a)).toBe(true);
    expect(
      ruleMatches(
        { segment_id: null, region: null, country: null },
        { segment_id: null, country: null },
      ),
    ).toBe(true);
    expect(
      ruleMatches(
        { segment_id: null, region: "latam", country: null },
        { segment_id: null, country: null },
      ),
    ).toBe(false);
  });
  it("labels", () => {
    expect(ruleLabel({ segment_id: "mm", region: "latam", country: null }, segNames)).toBe(
      "Mid-market · LatAm",
    );
    expect(ruleLabel({ segment_id: null, region: null, country: "ES" }, segNames)).toBe("España");
    expect(ruleLabel({ segment_id: null, region: null, country: null }, segNames)).toBe(
      "Cualquier cuenta",
    );
  });
});

describe("proposal", () => {
  it("with no rules, balances the whole eligible team by weighted load; A accounts first", () => {
    const r = proposeAssignment({
      accounts: [acc("c1", { tier: "C" }), acc("a1", { tier: "A" }), acc("b1"), acc("b2")],
      members: [mem("ana"), mem("luis"), mem("mk", { role: "marketing" })],
      rules: [],
    });
    expect(r.rows.map((x) => [x.account_id, x.user_id])).toEqual([
      ["a1", "ana"],
      ["b1", "luis"],
      ["b2", "luis"],
      ["c1", "ana"],
    ]);
    expect(r.load.get("ana")).toEqual({ accounts: 2, weight: 4 });
    expect(r.load.get("luis")).toEqual({ accounts: 2, weight: 4 });
    expect(r.rows.every((x) => x.user_id !== "mk")).toBe(true);
  });

  it("owned accounts count as load and are never reassigned", () => {
    const r = proposeAssignment({
      accounts: [acc("x", { owner_id: "ana", tier: "A" }), acc("y")],
      members: [mem("ana"), mem("luis")],
      rules: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ account_id: "y", user_id: "luis" });
  });

  it("the first rule that fits picks the people; unmatched accounts are left with the reason", () => {
    const rules = [
      rule("r2", ["luis"], { position: 2, region: "latam" }),
      rule("r1", ["ana"], { position: 1, segment_id: "mm", country: "MX" }),
    ];
    const r = proposeAssignment({
      accounts: [
        acc("mx", { segment_id: "mm", country: "MX" }),
        acc("co", { country: "CO" }),
        acc("es", { country: "ES" }),
      ],
      members: [mem("ana"), mem("luis")],
      rules,
      segNames,
    });
    expect(r.rows.map((x) => [x.account_id, x.user_id, x.rule])).toEqual([
      ["co", "luis", "LatAm"],
      ["mx", "ana", "Mid-market · México"],
    ]);
    expect(r.unassigned).toEqual([
      { account_id: "es", account: "es", reason: "Ninguna regla encaja (segmento o país)." },
    ]);
  });

  it("respects maximums and says when everyone is full", () => {
    const r = proposeAssignment({
      accounts: [acc("own", { owner_id: "ana" }), acc("n1"), acc("n2"), acc("n3")],
      members: [mem("ana", { max_accounts: 1 }), mem("luis", { max_accounts: 1 })],
      rules: [],
    });
    expect(r.rows.map((x) => x.user_id)).toEqual(["luis"]);
    expect(r.unassigned.map((x) => x.account_id)).toEqual(["n2", "n3"]);
    expect(r.unassigned[0].reason).toMatch(/máximo/);
  });

  it("a rule whose people cannot own accounts leaves the account unassigned", () => {
    const r = proposeAssignment({
      accounts: [acc("a")],
      members: [mem("mk", { role: "marketing" })],
      rules: [rule("r", ["mk"])],
      segNames,
    });
    expect(r.rows).toEqual([]);
    expect(r.unassigned[0].reason).toMatch(/no tiene personas/);
  });

  it("is deterministic and explains each row", () => {
    const input = { accounts: [acc("b"), acc("a")], members: [mem("x"), mem("y")], rules: [] };
    expect(proposeAssignment(input).rows).toEqual(proposeAssignment(input).rows);
    expect(proposeAssignment(input).rows[0].reason).toBe(
      "Sin reglas: todo el equipo; empata en carga con otra persona y se desempata por nombre (0 cuentas, carga 0).",
    );
    expect(proposeAssignment(input).rows[1].reason).toBe(
      "Sin reglas: todo el equipo; es quien menos carga lleva de 2 (0 cuentas, carga 0).",
    );
    expect(proposeAssignment({ ...input, members: [mem("x")] }).rows[0].reason).toMatch(
      /única persona disponible/,
    );
  });
});

describe("validation of an edited proposal", () => {
  it("needs an eligible person and holds the maximums", () => {
    const members = [mem("ana", { max_accounts: 2 }), mem("mk", { role: "marketing" })];
    expect(
      validateAssignment([{ account_id: "1", account: "Acme", user_id: "ana" }], members, [
        { owner_id: "ana" },
      ]),
    ).toEqual([]);
    expect(
      validateAssignment([{ account_id: "1", account: "Acme", user_id: "mk" }], members, []),
    ).toEqual(["«Acme»: elige una persona que pueda llevar cuentas."]);
    expect(
      validateAssignment(
        [
          { account_id: "1", account: "A", user_id: "ana" },
          { account_id: "2", account: "B", user_id: "ana" },
        ],
        members,
        [{ owner_id: "ana" }],
      ),
    ).toEqual(["ana pasaría a 3 cuentas y su máximo es 2."]);
  });
});
