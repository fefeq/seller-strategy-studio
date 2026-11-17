import { QueryObserver, type QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

// NK-0099: the app's query client. Only the router factory is under test: the route tree and the router itself are
// stubbed, so no screen is loaded.
vi.mock("@/routeTree.gen", () => ({ routeTree: {} }));
vi.mock("@tanstack/react-router", () => ({
  createRouter: (options: { context: { queryClient: QueryClient } }) => ({ options }),
}));

async function appQueryClient() {
  const { getRouter } = await import("@/router");
  return (getRouter() as unknown as { options: { context: { queryClient: QueryClient } } }).options
    .context.queryClient;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function counted() {
  let calls = 0;
  const options = {
    queryKey: ["nk-0099"],
    queryFn: async () => ++calls,
  };
  return { options, calls: () => calls };
}

afterEach(() => vi.useRealTimers());

describe("app query client (NK-0099)", () => {
  it("a screen mounted right after its route loader read the data does not ask for it again", async () => {
    const qc = await appQueryClient();
    const q = counted();
    await qc.ensureQueryData(q.options); // route loader
    const unsubscribe = new QueryObserver(qc, q.options).subscribe(() => {}); // the screen mounts
    await flush();
    unsubscribe();
    expect(q.calls()).toBe(1);
  });

  it("a second component subscribing to the same data a moment later does not ask for it again", async () => {
    const qc = await appQueryClient();
    const q = counted();
    const first = new QueryObserver(qc, q.options).subscribe(() => {});
    await vi.waitFor(() => expect(qc.getQueryData(["nk-0099"])).toBe(1)); // loaded, not just asked
    const second = new QueryObserver(qc, q.options).subscribe(() => {}); // e.g. the setup guide, 400 ms later
    await flush();
    first();
    second();
    expect(q.calls()).toBe(1);
  });

  it("an invalidation after a change still reloads at once", async () => {
    const qc = await appQueryClient();
    const q = counted();
    const unsubscribe = new QueryObserver(qc, q.options).subscribe(() => {});
    await vi.waitFor(() => expect(qc.getQueryData(["nk-0099"])).toBe(1)); // loaded, not just asked
    await qc.invalidateQueries({ queryKey: ["nk-0099"] });
    unsubscribe();
    expect(q.calls()).toBe(2);
  });

  it("coming back to a screen later reloads it: the data is only reused for a few seconds", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const qc = await appQueryClient();
    const q = counted();
    await qc.ensureQueryData(q.options);
    vi.setSystemTime(Date.now() + 10_000); // «a few seconds»: a staleTime of a minute would fail here
    const unsubscribe = new QueryObserver(qc, q.options).subscribe(() => {});
    await vi.waitFor(() => expect(q.calls()).toBe(2));
    unsubscribe();
  });
});
