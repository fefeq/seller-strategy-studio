// NK-0098 round 2: after sign-out of X and sign-in as Y, nothing of X is ever served to Y.
// Fake Supabase client, fictional ids, no network. Behavioural: real QueryClient, real meQuery observers.
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Sess = { access_token: string; user: { id: string } };
const h = vi.hoisted(() => ({
  session: null as Sess | null,
  listeners: [] as ((e: string, s: Sess | null) => void)[],
  getUser: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: null }),
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (_c: string, id: string) => {
        q.id = id;
        return q;
      };
      q.maybeSingle = async () => ({
        data: { id: q.id, current_org_id: `org-of-${String(q.id)}` },
      });
      q.then = (r: (v: unknown) => unknown) =>
        r({
          data:
            t === "org_members"
              ? [
                  {
                    org_id: `org-of-${String(q.id)}`,
                    role: "owner",
                    organizations: {
                      name: `Co ${String(q.id)}`,
                      currency: "EUR",
                      website: null,
                      archived_at: null,
                    },
                  },
                ]
              : null,
        });
      return q;
    },
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      getUser: async (jwt?: string) => {
        h.getUser++;
        await Promise.resolve();
        return { data: { user: { id: String(jwt).split(":")[0] } }, error: null };
      },
      onAuthStateChange: (cb: (e: string, s: Sess | null) => void) => {
        h.listeners.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));

const x: Sess = { access_token: "user-x:1", user: { id: "user-x" } };
const y: Sess = { access_token: "user-y:1", user: { id: "user-y" } };

let meQuery: typeof import("@/hooks/use-me").meQuery;
let handleAuthEvent: typeof import("./session-cache").handleAuthEvent;
let isSignedIn: typeof import("./session").isSignedIn;

beforeEach(async () => {
  vi.resetModules();
  h.listeners.length = 0;
  h.getUser = 0;
  h.session = x;
  ({ meQuery } = await import("@/hooks/use-me"));
  ({ handleAuthEvent } = await import("./session-cache"));
  ({ isSignedIn } = await import("./session"));
});

function emit(qc: QueryClient, event: string, s: Sess | null) {
  h.session = s;
  h.listeners.forEach((l) => l(event, s));
  return handleAuthEvent(qc, event, s);
}

describe("sign-out of X then sign-in as Y (NK-0098 round 2)", () => {
  it("no meQuery consumer or loader ever receives X after SIGNED_OUT", async () => {
    const qc = new QueryClient();
    expect(await isSignedIn()).toBe(true);
    const seen: (string | undefined)[] = [];
    const obs = new QueryObserver(qc, meQuery);
    const unsub = obs.subscribe((r) => seen.push(r.data?.user.id));
    await qc.fetchQuery(meQuery);
    expect((await qc.ensureQueryData(meQuery))?.user.id).toBe("user-x");

    seen.length = 0;
    emit(qc, "SIGNED_OUT", null);
    // A loader running between sign-out and sign-in gets nothing, not X.
    expect(await qc.ensureQueryData(meQuery)).toBeNull();
    expect(await isSignedIn()).toBe(false);

    emit(qc, "SIGNED_IN", y);
    expect(await isSignedIn()).toBe(true);
    const me = await qc.ensureQueryData(meQuery);
    expect(me?.user.id).toBe("user-y");
    expect(me?.currentOrg?.org_id).toBe("org-of-user-y");
    unsub();
    expect(seen.filter((id) => id === "user-x")).toEqual([]);
  });

  it("SIGNED_IN as another user drops X even without a SIGNED_OUT before (other tab)", async () => {
    const qc = new QueryClient();
    await qc.fetchQuery(meQuery);
    qc.setQueryData(["leads", "org-of-user-x"], ["lead of X"]);
    emit(qc, "SIGNED_IN", y);
    expect(qc.getQueryData(["leads", "org-of-user-x"])).toBeUndefined();
    expect(qc.getQueryData(["me"])).toBeUndefined();
    expect((await qc.ensureQueryData(meQuery))?.user.id).toBe("user-y");
  });

  it("SIGNED_IN for the same user (tab focus) keeps the cache and just refreshes it", async () => {
    const qc = new QueryClient();
    await qc.fetchQuery(meQuery);
    qc.setQueryData(["leads", "org-of-user-x"], ["lead of X"]);
    expect(emit(qc, "SIGNED_IN", x)).toBe(true);
    expect(qc.getQueryData(["leads", "org-of-user-x"])).toEqual(["lead of X"]);
  });

  it("a me fetch still in flight for X when the session ends is not stored", async () => {
    const qc = new QueryClient();
    const pending = qc.fetchQuery(meQuery).catch(() => "cancelled");
    emit(qc, "SIGNED_OUT", null);
    await pending;
    await new Promise((r) => setTimeout(r, 0));
    expect(qc.getQueryData(["me"])).toBeUndefined();
  });
});

describe("page load (NK-0098 round 2)", () => {
  it("INITIAL_SESSION with nothing cached does not cancel in-flight loader queries", async () => {
    const { QueryClient: QC } = await import("@tanstack/react-query");
    const qc = new QC();
    const loading = qc.fetchQuery(meQuery);
    emit(qc, "INITIAL_SESSION", x);
    expect((await loading)?.user.id).toBe("user-x");
  });
});

describe("loader with nothing observing (NK-0098 round 2)", () => {
  it("ensureQueryData right after SIGNED_OUT never returns the previous user's me", async () => {
    const qc = new QueryClient();
    await qc.fetchQuery(meQuery); // X cached, no observer mounted
    emit(qc, "SIGNED_OUT", null);
    expect(qc.getQueryData(["me"])).toBeUndefined();
    expect(await qc.ensureQueryData(meQuery)).toBeNull();
  });
});

describe("other user without «me» in cache (NK-0111)", () => {
  const leads = ["leads", "org-of-user-x"];
  const seeded = () => {
    const qc = new QueryClient();
    qc.setQueryData(leads, ["lead of X"]);
    return qc;
  };

  it("SIGNED_IN of Y while X was the validated user removes X's queries (not just invalidates)", async () => {
    const qc = seeded();
    expect(qc.getQueryData(["me"])).toBeUndefined();
    expect(handleAuthEvent(qc, "SIGNED_IN", y, "user-x")).toBe(true);
    expect(qc.getQueryCache().find({ queryKey: leads })).toBeUndefined();
    const served = await qc.ensureQueryData({
      queryKey: leads,
      queryFn: async () => ["lead of Y"],
    });
    expect(served).toEqual(["lead of Y"]);

    // The same X signing in again (tab focus) removes nothing.
    const again = seeded();
    handleAuthEvent(again, "SIGNED_IN", x, "user-x");
    expect(again.getQueryData(leads)).toEqual(["lead of X"]);
  });

  it("with no validated user yet it is not another user; with one it is, whatever the event", async () => {
    const qc = new QueryClient();
    const loading = qc.fetchQuery({
      queryKey: leads,
      queryFn: async () => {
        await new Promise((r) => setTimeout(r, 0));
        return ["lead of X"];
      },
    });
    handleAuthEvent(qc, "INITIAL_SESSION", x, null);
    expect(await loading).toEqual(["lead of X"]);

    handleAuthEvent(qc, "INITIAL_SESSION", y, "user-x");
    expect(qc.getQueryCache().find({ queryKey: leads })).toBeUndefined();
  });
});

describe("the root listener gives handleAuthEvent the last validated user (source guard, NK-0111)", () => {
  it("passes lastValidatedUserId() as the fourth argument", () => {
    const src = readFileSync(path.resolve(__dirname, "../routes/__root.tsx"), "utf8");
    expect(src).toMatch(
      /handleAuthEvent\(\s*queryClient,\s*event,\s*session,\s*lastValidatedUserId\(\)\s*\)/,
    );
  });
});
