// NK-0064 (SDD tool-plan-real-connections, CA-1 and CA-2): what Nokko does with each tool of the team's plan.
// The expected table is written here on purpose, so the module cannot grade itself. Names are the 15 seeded by
// create_organization (0002_multitenant_organizations.sql:210-225); no customer data.
import { describe, expect, it } from "vitest";
import { connectionFor, type ConnectionKind } from "@/lib/tool-plan";

const SEED: [string, ConnectionKind][] = [
  ["Apollo", "native"],
  ["Clay", "native"],
  ["HubSpot", "webhook"],
  ["Attio", "webhook"],
  ["LinkedIn Sales Navigator", "webhook"],
  ["Gmail", "not_yet"],
  ["Google Calendar", "not_yet"],
  ["Gong", "not_yet"],
  ["Fireflies", "not_yet"],
  ["GitHub", "none"],
  ["Slack", "none"],
  ["Instantly", "none"],
  ["Lemlist", "none"],
  ["DocuSign", "none"],
  ["PandaDoc", "none"],
];

describe("connectionFor, the 15 seeded tools (CA-1)", () => {
  it("covers exactly 15 names: 2 native, 3 webhook, 4 not_yet, 6 none", () => {
    expect(SEED).toHaveLength(15);
    const count = (k: ConnectionKind) => SEED.filter(([, kind]) => kind === k).length;
    expect([count("native"), count("webhook"), count("not_yet"), count("none")]).toEqual([
      2, 3, 4, 6,
    ]);
  });
  it.each(SEED)("%s is %s", (name, kind) => {
    expect(connectionFor(name)).toEqual({ kind });
  });
});

describe("connectionFor, names outside the seed (CA-2)", () => {
  it("returns none for an unknown name, never throws", () => {
    expect(connectionFor("Una herramienta inventada")).toEqual({ kind: "none" });
    expect(connectionFor("")).toEqual({ kind: "none" });
  });
  it("ignores case and surrounding or repeated spaces", () => {
    expect(connectionFor("  hubspot ")).toEqual({ kind: "webhook" });
    expect(connectionFor("LINKEDIN   sales navigator")).toEqual({ kind: "webhook" });
  });
  it.each(["Apollo.io", "Google Drive", "Firecrawl", "Parallel", "Perplexity", "Apify"])(
    "alias %s is native",
    (name) => {
      expect(connectionFor(name)).toEqual({ kind: "native" });
    },
  );
  it.each(["Pipedrive", "Salesforce"])(
    "%s (listed in NOT_YET as arriving by webhook) is webhook",
    (name) => {
      expect(connectionFor(name)).toEqual({ kind: "webhook" });
    },
  );
});
