import { describe, expect, it } from "vitest";
import { keyDirection, swipeDirection } from "./swipe";

describe("swipeDirection", () => {
  it("commits right/left past 110 px", () => {
    expect(swipeDirection(120, 10)).toBe("right");
    expect(swipeDirection(-120, 10)).toBe("left");
  });
  it("springs back on a short drag", () => expect(swipeDirection(60, 5)).toBeNull());
  it("a fast flick commits even when short", () => expect(swipeDirection(40, 0, 900)).toBe("right"));
  it("up postpones, down never decides", () => {
    expect(swipeDirection(5, -130)).toBe("up");
    expect(swipeDirection(5, 200)).toBeNull();
  });
  it("maps arrow keys", () => {
    expect(keyDirection("ArrowLeft")).toBe("left");
    expect(keyDirection("ArrowDown")).toBeNull();
  });
});
