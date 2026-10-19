import { describe, expect, it } from "vitest";
import { oauthReturnPath } from "./oauth-return-path";

describe("login only returns to pages of this app", () => {
  it("keeps the consent page with its authorization id", () =>
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc")).toBe("/.lovable/oauth/consent?authorization_id=abc"));
  it("rejects other websites", () => {
    expect(oauthReturnPath("https://evil.example/x")).toBe("/");
    expect(oauthReturnPath("//evil.example")).toBe("/");
    expect(oauthReturnPath("/\\evil.example")).toBe("/");
  });
});
