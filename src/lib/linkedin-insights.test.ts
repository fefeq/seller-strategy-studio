import { describe, expect, it } from "vitest";
import { engagement, hiringSignals, hiringTeam } from "./linkedin-insights";

describe("A+ hiring signals from job offers", () => {
  it("classifies teams", () => {
    expect(hiringTeam("Senior Account Executive")).toBe("Ventas");
    expect(hiringTeam("Backend Engineer")).toBe("Ingeniería");
    expect(hiringTeam("Recepcionista")).toBe("Otros");
    expect(hiringTeam("Ingeniero de backend")).toBe("Ingeniería");
    expect(hiringTeam("Ingeniería de ventas")).toBe("Ventas");
  });
  it("lead/principal individual contributors are not counted as directivos", () => {
    expect(hiringSignals([{ title: "Lead Developer", level: "" }, { title: "Principal Engineer", level: "" }]).senior).toBe(0);
  });
  it("headline names the top teams and senior roles", () => {
    const s = hiringSignals([
      { title: "SDR", level: "" },
      { title: "Account Executive", level: "" },
      { title: "Head of Marketing", level: "Director" },
    ]);
    expect(s.total).toBe(3);
    expect(s.senior).toBe(1);
    expect(s.headline).toBe("3 ofertas abiertas en 30 días; contrata sobre todo en Ventas (2) y Marketing (1); 1 de perfil directivo.");
  });
  it("no offers → no headline (no invented trend)", () => {
    expect(hiringSignals([]).headline).toBeNull();
  });
});

describe("A+ engagement from posts", () => {
  it("averages own posts only and picks the top one", () => {
    const e = engagement([
      { url: "a", likes: 10, repost: false },
      { url: "b", likes: 30, repost: false },
      { url: "c", likes: 999, repost: true },
    ]);
    expect(e).toEqual({ posts: 2, avgLikes: 20, top: { url: "b", likes: 30 } });
  });
  it("unmeasured likes are unknown, not zero", () => {
    expect(engagement([{ url: "a", likes: null, repost: false }])).toEqual({ posts: 1, avgLikes: null, top: null });
  });
  it("no posts → null average, never zero", () => {
    expect(engagement([]).avgLikes).toBeNull();
  });
});

import { currentRole, roleChange } from "./linkedin-insights";
describe("A+ role changes", () => {
  const raw = [{ experience: [
    { position: "VP Sales", companyName: "Acme Corp", startDate: { text: "Sep 2026" }, endDate: { text: "Present" } },
    { position: "Head of Sales", companyName: "Beta", endDate: { text: "Aug 2026" } },
  ] }];
  it("reads the open experience", () => {
    expect(currentRole(raw)).toEqual({ title: "VP Sales", company: "Acme Corp", since: "Sep 2026" });
  });
  it("detects a company change", () => {
    const r = roleChange({ title: "Head of Sales", company: "Beta" }, currentRole(raw));
    expect(r?.changed).toBe(true);
    expect(r?.companyChanged).toBe(true);
  });
  it("same role (accents/case/legal suffix) is no change", () => {
    expect(roleChange({ title: "vp sales", company: "Acme" }, currentRole(raw))?.changed).toBe(false);
  });
  it("legal suffixes are ignored; similar prefixes are different companies", () => {
    const now = { title: "CEO", company: "Acme Ltd", since: null };
    expect(roleChange({ title: "CEO", company: "Acme Inc" }, now)?.companyChanged).toBe(false);
    expect(roleChange({ title: "CEO", company: "Meta" }, { ...now, company: "Metabase" })?.companyChanged).toBe(true);
  });
  it("empty stored title → title found, not «sin cambios»", () => {
    const r = roleChange({ title: "", company: "Acme" }, currentRole(raw));
    expect(r?.titleMissing).toBe(true);
    expect(r?.changed).toBe(false);
  });
  it("no current role → unknown (null), never «sin cambios»", () => {
    expect(roleChange({ title: "x", company: "y" }, currentRole([{ experience: [] }]))).toBeNull();
  });
});
