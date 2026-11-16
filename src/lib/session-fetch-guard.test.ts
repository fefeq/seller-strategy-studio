import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beginAccountSwitch, resetAccountSwitch } from "@/lib/account-switch";
import { beginSessionEnd, endSessionEnd, SessionEndedError } from "@/lib/session-ending";
import { signOutAndClear } from "@/lib/session-cache";
import { guardFetch, installSessionFetchGuard } from "@/lib/session-fetch-guard";

// NK-0169: while «Cerrar sesión» is in flight (or the tab is changing account) nothing may leave with the
// previous session, whichever screen asks. Synthetic backend and ids only.
const SUPABASE = "https://synthetic-project.supabase.co";
const ORIGIN = "http://localhost:5173";

const ok = () =>
  new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
function stub() {
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return ok();
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

afterEach(() => {
  endSessionEnd();
  resetAccountSwitch();
  vi.useRealTimers();
});

const userScoped = [
  `${SUPABASE}/rest/v1/accounts?select=*&org_id=eq.org-a`,
  `${SUPABASE}/rest/v1/rpc/current_org`,
  `${SUPABASE}/storage/v1/object/list/onboarding`,
  `${SUPABASE}/functions/v1/some-function`,
  `${ORIGIN}/_serverFn/abc123`,
  "/_serverFn/abc123",
];

describe("guardFetch", () => {
  it.each(userScoped)(
    "CA-1 refuses %s without touching the network while signing out",
    async (url) => {
      const s = stub();
      const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
      beginSessionEnd();
      await expect(f(url)).rejects.toBeInstanceOf(SessionEndedError);
      await expect(f(new Request(new URL(url, ORIGIN)))).rejects.toBeInstanceOf(SessionEndedError);
      expect(s.calls).toEqual([]);
    },
  );

  it("CA-1 refuses the same requests while the tab is changing account", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginAccountSwitch();
    for (const url of userScoped) await expect(f(url)).rejects.toBeInstanceOf(SessionEndedError);
    expect(s.calls).toEqual([]);
  });

  it("CA-1 refuses reads by any route while signing out (GET and HEAD, Request objects too)", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginSessionEnd();
    await expect(f(`${SUPABASE}/rest/v1/accounts`, { method: "HEAD" })).rejects.toBeInstanceOf(
      SessionEndedError,
    );
    await expect(
      f(new Request(`${SUPABASE}/rest/v1/accounts`, { method: "GET" })),
    ).rejects.toBeInstanceOf(SessionEndedError);
    expect(s.calls).toEqual([]);
  });

  it("CA-1b lets a write of the person signing out leave (their session is still valid until the logout ends)", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginSessionEnd();
    const writes = [
      [`${SUPABASE}/rest/v1/stages?id=eq.s-1`, "PATCH"],
      [`${SUPABASE}/rest/v1/rpc/save_quarter`, "POST"],
      [`${ORIGIN}/_serverFn/save123`, "POST"],
    ] as const;
    for (const [url, method] of writes) await f(url, { method });
    await f(new Request(`${SUPABASE}/rest/v1/notes`, { method: "DELETE" }));
    expect(s.calls).toHaveLength(4);
  });

  it("CA-1b refuses every method while the tab is changing account (the token may be the other person's)", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginAccountSwitch();
    for (const method of ["POST", "PATCH", "DELETE"])
      await expect(f(`${SUPABASE}/rest/v1/accounts`, { method })).rejects.toBeInstanceOf(
        SessionEndedError,
      );
    await expect(f(`${ORIGIN}/_serverFn/save123`, { method: "POST" })).rejects.toBeInstanceOf(
      SessionEndedError,
    );
    expect(s.calls).toEqual([]);
  });

  it("CA-2 lets the logout, the token refresh and other origins through while signing out", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginSessionEnd();
    const through = [
      `${SUPABASE}/auth/v1/logout?scope=global`,
      `${SUPABASE}/auth/v1/token?grant_type=refresh_token`,
      "https://api.example.test/v1/thing",
      `${ORIGIN}/assets/app.js`,
      "/auth",
    ];
    for (const url of through) await f(url);
    expect(s.calls).toEqual(through);
  });

  it("CA-2 only the logout and the token refresh pass among the auth routes", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginSessionEnd();
    await expect(f(`${SUPABASE}/auth/v1/user`)).rejects.toBeInstanceOf(SessionEndedError);
    expect(s.calls).toEqual([]);
  });

  it("CA-2 does not treat a look-alike host or path as the backend", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginSessionEnd();
    await f("https://synthetic-project.supabase.co.evil.test/rest/v1/accounts");
    await f(`${ORIGIN}/_serverFnx/abc`);
    expect(s.calls).toHaveLength(2);
  });

  it("CA-3 sends everything unchanged when no window is open", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    const init = { method: "POST", body: "{}" };
    for (const url of userScoped) await f(url, init);
    expect(s.calls).toEqual(userScoped);
    expect(vi.mocked(s.fn)).toHaveBeenCalledWith(userScoped[0], init);
  });

  it("CA-3 sends again once the window closes (sign out failed)", async () => {
    const s = stub();
    const f = guardFetch(s.fn, { supabaseUrl: SUPABASE, origin: ORIGIN });
    beginSessionEnd();
    await expect(f(userScoped[0])).rejects.toBeInstanceOf(SessionEndedError);
    endSessionEnd();
    await f(userScoped[0]);
    expect(s.calls).toEqual([userScoped[0]]);
  });
});

describe("installSessionFetchGuard", () => {
  it("CA-4 wraps window.fetch once and never twice", async () => {
    const original = window.fetch;
    const s = stub();
    window.fetch = s.fn;
    try {
      expect(installSessionFetchGuard({ supabaseUrl: SUPABASE })).toBe(true);
      const wrapped = window.fetch;
      expect(wrapped).not.toBe(s.fn);
      expect(installSessionFetchGuard({ supabaseUrl: SUPABASE })).toBe(false);
      expect(window.fetch).toBe(wrapped);
      beginSessionEnd();
      await expect(window.fetch(`${SUPABASE}/rest/v1/accounts`)).rejects.toBeInstanceOf(
        SessionEndedError,
      );
      await expect(window.fetch(`${window.location.origin}/_serverFn/x`)).rejects.toBeInstanceOf(
        SessionEndedError,
      );
      expect(s.calls).toEqual([]);
    } finally {
      window.fetch = original;
    }
  });

  it("CA-4 installs nothing outside the browser", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(installSessionFetchGuard({ supabaseUrl: SUPABASE })).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("CA-4 installs nothing without a backend URL", () => {
    expect(installSessionFetchGuard({ supabaseUrl: undefined })).toBe(false);
  });
});

describe("NK-0169 with a real supabase-js client and signOutAndClear", () => {
  // Built like src/integrations/supabase/client.ts: its fetch resolves the guarded fetch on every request.
  function client(net: typeof fetch) {
    const f = guardFetch(net, { supabaseUrl: SUPABASE, origin: ORIGIN });
    const asked: string[] = []; // every request the client tried to send, refused or not
    const sb = createClient(SUPABASE, "synthetic-publishable-key", {
      global: {
        fetch: (input, init) => {
          asked.push(String(input instanceof Request ? input.url : input));
          return f(input, init);
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { sb, f, asked };
  }

  it("CA-5 the logout leaves and a read started while it is in flight does not", async () => {
    vi.useFakeTimers();
    const s = stub();
    const { sb, f, asked } = client(s.fn);
    const qc = new QueryClient();
    let read: PromiseLike<{ error: unknown }> | null = null;
    let duringLogout: string[] = [];
    let started = false;
    await signOutAndClear(qc, {
      async signOut() {
        // A postgrest builder only sends when awaited: start it now, inside the window.
        read = sb
          .from("accounts")
          .select("*")
          .eq("org_id", "org-a")
          .then((r) => r);
        await vi.advanceTimersByTimeAsync(0);
        started = asked.some((u) => u.includes("/rest/v1/accounts"));
        await f(`${SUPABASE}/auth/v1/logout?scope=global`, { method: "POST" });
        duringLogout = [...s.calls];
      },
    });
    expect(started).toBe(true);
    expect(duringLogout).toEqual([`${SUPABASE}/auth/v1/logout?scope=global`]);
    // supabase-js retries a refused GET after the window (1 s, 2 s, 4 s); by then it carries the session of
    // that moment, never the one being closed. Drain it so nothing outlives the test.
    await vi.advanceTimersByTimeAsync(8000);
    await read;
  });

  it("CA-6 a refused read stays pending (no error) and completes with the same session if the sign out fails", async () => {
    vi.useFakeTimers();
    const s = stub();
    const { sb } = client(s.fn);
    const qc = new QueryClient();
    const observer = new QueryObserver(qc, {
      queryKey: ["accounts", "org-a"],
      queryFn: async () => {
        const { data, error } = await sb.from("accounts").select("*");
        if (error) throw error;
        return data;
      },
    });
    beginSessionEnd();
    const states: string[] = [];
    const unsubscribe = observer.subscribe((r) => states.push(r.status));
    await vi.advanceTimersByTimeAsync(10);
    expect(observer.getCurrentResult().status).toBe("pending");
    expect(s.calls).toEqual([]);
    endSessionEnd(); // the sign out failed: same person, same session
    await vi.advanceTimersByTimeAsync(1500);
    expect(observer.getCurrentResult().status).toBe("success");
    expect(states).not.toContain("error");
    expect(s.calls).toHaveLength(1);
    unsubscribe();
  });
});
