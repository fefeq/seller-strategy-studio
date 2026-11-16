import { describe, expect, it } from "vitest";
import { dailyEmailBody, dailyEmailDue, dailySubject, localClock } from "./daily-email";

const madrid = { daily_email: true, daily_email_hour: 8, timezone: "Europe/Madrid" };

describe("Email diario", () => {
  it("goes out at 8:00 local time (Madrid is UTC+2 on 24 Oct 2026)", () => {
    expect(dailyEmailDue(madrid, new Date("2026-10-24T06:07:00Z"))).toEqual({
      due: true,
      day: "2026-10-24",
    });
    expect(dailyEmailDue(madrid, new Date("2026-10-24T05:07:00Z")).due).toBe(false);
  });
  it("still goes out up to 2 hours late if a run was missed, never later", () => {
    expect(dailyEmailDue(madrid, new Date("2026-10-24T08:07:00Z")).due).toBe(true);
    expect(dailyEmailDue(madrid, new Date("2026-10-24T09:07:00Z")).due).toBe(false);
  });
  it("respects the chosen hour, the off switch and the person's time zone", () => {
    expect(
      dailyEmailDue({ ...madrid, daily_email_hour: 7 }, new Date("2026-10-24T05:07:00Z")).due,
    ).toBe(true);
    expect(
      dailyEmailDue({ ...madrid, daily_email: false }, new Date("2026-10-24T06:07:00Z")).due,
    ).toBe(false);
    expect(
      dailyEmailDue(
        { ...madrid, timezone: "America/Mexico_City" },
        new Date("2026-10-24T14:07:00Z"),
      ).due,
    ).toBe(true);
  });
  it("falls back to Madrid with an unknown time zone", () => {
    expect(localClock(new Date("2026-10-24T06:07:00Z"), "Not/AZone")).toMatchObject({
      day: "2026-10-24",
      hour: 8,
      offsetMin: 120,
    });
  });
  it("names the decisions in the subject and links each item to Nokko", () => {
    const c = {
      name: "Fede",
      orgName: "Postin",
      auto: [{ text: "Investigué 2 cuentas nuevas.", link: "/accounts" as const }],
      decisions: ["Revisar lead Acme"],
      today: [],
      hour: 8,
    };
    expect(dailySubject(c)).toBe("Postin · 1 cosa necesita tu decisión hoy");
    const { html, text } = dailyEmailBody(c, "https://nokko.ai");
    expect(html).toContain('href="https://nokko.ai/accounts"');
    expect(text).toContain("https://nokko.ai/team#avisos");
  });
});
