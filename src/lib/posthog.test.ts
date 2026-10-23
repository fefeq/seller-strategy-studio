import { describe, expect, it } from "vitest";
import { isUnmeasuredPath, posthogConfig } from "./posthog";
import { eventPayload, isGtmEvent } from "./analytics";

describe("posthogConfig", () => {
  it("uses the EU host unless the region is us, and needs a project token", () => {
    expect(posthogConfig({ key: "phc_abc", region: "eu" })).toEqual({ key: "phc_abc", host: "https://eu.i.posthog.com" });
    expect(posthogConfig({ key: "phc_abc" })?.host).toBe("https://eu.i.posthog.com");
    expect(posthogConfig({ key: "phc_abc", region: "us" })?.host).toBe("https://us.i.posthog.com");
    expect(posthogConfig({ key: "phx_personal" })).toBeNull();
    expect(posthogConfig({})).toBeNull();
  });
  it("never measures the assistant consent screens", () => {
    expect(isUnmeasuredPath("/.lovable/oauth/consent")).toBe(true);
    expect(isUnmeasuredPath("/home")).toBe(false);
  });
});

describe("event routing", () => {
  it("sends only the GTM events to Google; product events stay in PostHog", () => {
    expect(isGtmEvent("sign_up")).toBe(true);
    expect(isGtmEvent("org_created")).toBe(true);
    expect(isGtmEvent("lead_created")).toBe(false);
    expect(isGtmEvent("agent_message")).toBe(false);
    expect(eventPayload("login", { method: "google" })).toEqual({ event: "login", method: "google", location: undefined });
  });
});
