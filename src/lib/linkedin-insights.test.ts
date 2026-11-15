import { describe, expect, it } from "vitest";
import { engagement, hiringSignals, hiringTeam } from "./linkedin-insights";

describe("A+ hiring signals from job offers", () => {
  it("classifies teams", () => {
    expect(hiringTeam("Senior Account Executive")).toBe("Ventas");
    expect(hiringTeam("Backend Engineer")).toBe("Ingeniería");
    expect(hiringTeam("Recepcionista")).toBe("Otros");
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
  it("no posts → null average, never zero", () => {
    expect(engagement([]).avgLikes).toBeNull();
  });
});
