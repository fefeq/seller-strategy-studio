// NK-0152: the same leader never gets «Retoma tu onboarding» and «Completa: …» at once.
import { describe, expect, it } from "vitest";
import type { Snapshot } from "./proactive/types";
import type { SetupData } from "@/lib/setup-schema";
import { setupIncomplete } from "./proactive/detectors/setup-incomplete";
const NOW = new Date("2026-10-20T10:00:00Z");
const fullPos = {
  best_customers: "a",
  alternatives: "a",
  differentiation: "a",
  value: "a",
  trend: "a",
  target_customer: "a",
  need: "a",
  category: "a",
  key_benefit: "a",
  competitive_alternative: "a",
  differentiator: "a",
  one_liner: "a",
  elevator_pitch: "a",
};
const setup = (o: Partial<SetupData> = {}): SetupData => ({
  currency: "EUR",
  segments: [{ name: "SMB", acv_min: 5000, acv_max: 50000, win_rate_target: 25, ae_quota: 600000 }],
  icps: [{ industries: "SaaS", company_size: "50-200", why_fit: "x", anti_icp: "y" }],
  positioning: fullPos,
  pillars: [
    { title: "a", message: "m" },
    { title: "b", message: "m" },
    { title: "c", message: "m" },
  ],
  quotas: [{ period: "2026-Q4", amount: 100000 }],
  accounts: 1,
  deals: 1,
  quarter: "2026-Q4",
  ...o,
});
const snap = (o: Partial<Snapshot> = {}): Snapshot => ({
  now: NOW,
  orgId: "o",
  setup: setup(),
  deals: [],
  meetings: [],
  accounts: [],
  stakeholders: [],
  registrations: [],
  trials: [],
  segments: [],
  ...o,
});

const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const members = [{ user_id: "u-owner", role: "owner" }];
const base = { setup: setup({ quotas: [] }), members, setupActivityAt: days(3) };

describe("setup_incomplete with a stalled onboarding (NK-0152)", () => {
  it("goes to the owner when there is no stalled onboarding", () => {
    expect(setupIncomplete(snap(base)).map((x) => x.user_id)).toEqual(["u-owner"]);
  });
  it("is silenced while that owner's onboarding is stalled", () => {
    expect(
      setupIncomplete(
        snap({
          ...base,
          onboarding: [{ user_id: "u-owner", step: "blocks", updated_at: days(2) }],
        } as Partial<Snapshot>),
      ),
    ).toEqual([]);
  });
  it("comes back once the onboarding is finished", () => {
    expect(
      setupIncomplete(
        snap({
          ...base,
          onboarding: [{ user_id: "u-owner", step: "roadmap", updated_at: days(2) }],
        } as Partial<Snapshot>),
      ).map((x) => x.user_id),
    ).toEqual(["u-owner"]);
  });
});
