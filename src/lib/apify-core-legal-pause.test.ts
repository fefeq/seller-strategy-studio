// Legal pause in the Apify consumers (SDD pieza A, CA-1): with the pause on, no LinkedIn robot runs, no
// auxiliary LinkedIn search or URL write happens, and the saved page stays readable. G2 is not paused.
import { beforeEach, describe, expect, it, vi } from "vitest";

const pause = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/linkedin-legal.server", () => ({
  linkedinExtractionPaused: async () => pause.on,
  assertLinkedinExtractionAllowed: async () => {
    if (pause.on) throw new Error("En pausa · pendiente de revisión legal.");
  },
}));

const calls = vi.hoisted(() => ({ actor: 0, search: 0, update: 0 }));
vi.mock("@/lib/apify-gateway", () => ({
  runActor: async () => {
    calls.actor++;
    return [];
  },
}));
vi.mock("@/lib/web-search", () => ({
  searchBoth: async () => {
    calls.search++;
    return [];
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    const q = {
      select: () => q,
      eq: () => q,
      update: () => {
        calls.update++;
        return q;
      },
      maybeSingle: async () => ({ data: null, error: null }),
    };
    return { from: () => q };
  },
}));

import type { Db } from "@/lib/org-data";
import { companyLinkedin, linkedinSignalItems } from "./apify-core";

const ACC = {
  id: "acc-1",
  org_id: "org-1",
  name: "Acme Demo",
  domain: "acme-demo.test",
  linkedin_url: null as string | null,
};
const db = {} as Db;

beforeEach(() => {
  pause.on = true;
  calls.actor = 0;
  calls.search = 0;
  calls.update = 0;
});

describe("companyLinkedin with the legal pause on", () => {
  it("keeps the saved page readable without searching or writing", async () => {
    const url = await companyLinkedin(db, {
      ...ACC,
      linkedin_url: "https://www.linkedin.com/company/acme-demo/",
    });
    expect(url).toBe("https://www.linkedin.com/company/acme-demo/");
    expect(calls.search).toBe(0);
    expect(calls.update).toBe(0);
  });

  it("does not run the auxiliary search nor write the URL when nothing is saved", async () => {
    expect(await companyLinkedin(db, ACC)).toBeNull();
    expect(calls.search).toBe(0);
    expect(calls.update).toBe(0);
  });
});

describe("linkedinSignalItems with the legal pause on", () => {
  it("returns nothing and launches no robot", async () => {
    expect(await linkedinSignalItems(db, ACC)).toEqual([]);
    expect(calls.actor).toBe(0);
    expect(calls.search).toBe(0);
  });
});

describe("with the pause off the behavior is the old one", () => {
  it("the auxiliary search runs again", async () => {
    pause.on = false;
    await companyLinkedin(db, ACC);
    expect(calls.search).toBe(1);
  });
});
