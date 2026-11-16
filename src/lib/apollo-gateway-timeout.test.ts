import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findPeople } from "@/lib/apollo-gateway";
import type { ToolCtx } from "@/lib/agent/tool-kit";

const context = {
  db: {},
  orgId: "synthetic-org",
  userId: "synthetic-user",
  roles: ["ae"],
  currency: "EUR",
} as unknown as ToolCtx;
const search = () =>
  findPeople(context, {
    accountId: "synthetic-account",
    company: { name: "Synthetic", domain: "example.invalid" },
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("APOLLO_API_KEY", "synthetic-key");
  vi.stubEnv("LOVABLE_API_KEY", "synthetic-key");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("bounds Apollo to exactly 15000 ms without replaying an uncertain request", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    setTimeout(() => controller.abort(new DOMException("expired", "TimeoutError")), ms);
    return controller.signal;
  });
  const fetcher = vi.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const pending = search();
  const rejected = expect(pending).rejects.toMatchObject({ code: "APOLLO_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(14999);
  expect(controller.signal.aborted).toBe(false);
  expect(timeout).toHaveBeenCalledWith(15000);
  await vi.advanceTimersByTimeAsync(1);
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("also bounds response-body reading without replaying the request", async () => {
  const controller = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  const fetcher = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: () =>
      new Promise((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), {
          once: true,
        });
      }),
  }));
  vi.stubGlobal("fetch", fetcher);
  const pending = search();
  const rejected = expect(pending).rejects.toMatchObject({ code: "APOLLO_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort(new DOMException("expired", "TimeoutError"));
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(1);
});
