import { describe, it, expect, vi, beforeEach } from "vitest";
const calls: string[] = [];
vi.mock("@/lib/session", () => ({ validatedUser: async () => ({ id: "user-x" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "user-x" } } } }) },
    rpc: async (n: string) => {
      calls.push(n);
      return { data: null, error: null };
    },
    from: (t: string) => {
      calls.push(t);
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: null }),
        then: (r: (v: unknown) => void) => r({ data: [] }),
      };
      return q;
    },
  },
}));
import { meQuery } from "./use-me";
import { beginSessionEnd, endSessionEnd } from "@/lib/session-ending";
const run = () => (meQuery.queryFn as unknown as () => Promise<unknown>)();

describe("meQuery during sign-out (NK-0169 / F4)", () => {
  beforeEach(() => {
    calls.length = 0;
    endSessionEnd();
  });
  it("returns null and never calls accept_invites, profiles or org_members", async () => {
    beginSessionEnd();
    expect(await run()).toBeNull();
    expect(calls).toEqual([]);
    endSessionEnd();
  });
  it("outside the window it reads normally", async () => {
    await run();
    expect(calls).toEqual(["accept_invites", "profiles", "org_members"]);
  });
});
