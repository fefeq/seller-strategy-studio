import { describe, expect, it } from "vitest";
import { SERVICES, connectionState, monthUsage } from "./connections";

const apollo = SERVICES.find((s) => s.id === "apollo")!;
const stripe = SERVICES.find((s) => s.id === "stripe")!;

describe("C1 connection state", () => {
  it("shared key present → Incluida en NOKKO; company row → Tu cuenta", () => {
    expect(connectionState(apollo, true, null)).toBe("included");
    expect(connectionState(stripe, true, null)).toBe("own");
  });
  it("absent → Sin conectar; failed test → Error", () => {
    expect(connectionState(apollo, false, null)).toBe("missing");
    expect(connectionState(apollo, true, { ok: false, at: "x" })).toBe("error");
  });
  it("catalogue never exposes values, only env names", () => {
    for (const s of SERVICES) expect(JSON.stringify(s)).not.toMatch(/sk_|sb_secret|Bearer/);
  });
});

describe("C1 month usage", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  it("sums by currency, counts unknown apart, ignores last month", () => {
    const u = monthUsage(
      [
        { service: "apollo", cost: 0.5, currency: "USD", created_at: "2026-11-02T00:00:00Z" },
        { service: "apollo", cost: null, currency: "USD", created_at: "2026-11-03T00:00:00Z" },
        { service: "apollo", cost: 9, currency: "USD", created_at: "2026-10-30T00:00:00Z" },
        { service: "clay", cost: 1, currency: "USD", created_at: "2026-11-03T00:00:00Z" },
      ],
      apollo,
      now,
    );
    expect(u).toEqual({ uses: 2, byCurrency: { USD: 0.5 }, unknown: 1 });
  });
});
