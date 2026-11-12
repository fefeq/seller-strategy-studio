// NK-0150: the synchronous side of the «session ends» window, read by query functions and retry rules.
import { afterEach, describe, expect, it } from "vitest";
import { beginAccountSwitch, resetAccountSwitch } from "@/lib/account-switch";
import {
  SessionEndedError,
  assertSessionOpen,
  beginSessionEnd,
  endSessionEnd,
  isSessionQuiet,
  retryWhileOpen,
} from "@/lib/session-ending";

afterEach(() => {
  endSessionEnd();
  resetAccountSwitch();
});

describe("session end window (NK-0150)", () => {
  it("is open by default: reads go out and retries are allowed up to the limit", () => {
    expect(isSessionQuiet()).toBe(false);
    expect(() => assertSessionOpen()).not.toThrow();
    const retry = retryWhileOpen(2);
    expect(retry(0, new Error("500"))).toBe(true);
    expect(retry(1, new Error("500"))).toBe(true);
    expect(retry(2, new Error("500"))).toBe(false);
  });

  it("signing out: a read refuses to send and nothing is retried, and both come back if the sign-out fails", () => {
    beginSessionEnd();
    expect(isSessionQuiet()).toBe(true);
    expect(() => assertSessionOpen()).toThrow(SessionEndedError);
    expect(retryWhileOpen(2)(0, new Error("500"))).toBe(false);
    endSessionEnd();
    expect(() => assertSessionOpen()).not.toThrow();
    expect(retryWhileOpen(2)(0, new Error("500"))).toBe(true);
  });

  it("switching account: the same", () => {
    beginAccountSwitch();
    expect(isSessionQuiet()).toBe(true);
    expect(() => assertSessionOpen()).toThrow(SessionEndedError);
    expect(retryWhileOpen(2)(0, new Error("500"))).toBe(false);
  });

  it("a refused read is never retried, even if the window closed meanwhile", () => {
    expect(retryWhileOpen(2)(0, new SessionEndedError())).toBe(false);
  });
});
