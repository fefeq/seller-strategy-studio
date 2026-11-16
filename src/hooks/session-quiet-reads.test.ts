import { describe, expect, it, vi } from "vitest";

const calls: string[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: new Proxy(
    {},
    {
      get: (_t, k) => {
        calls.push(String(k));
        throw new Error("network touched");
      },
    },
  ),
}));
vi.mock("@/lib/session", () => ({
  validatedUser: async () => {
    calls.push("validatedUser");
    return null;
  },
}));

import {
  beginSessionEnd,
  endSessionEnd,
  SessionEndedError,
  retryWhileOpen,
} from "@/lib/session-ending";
import { homeQuery } from "./screen-queries";

// NK-0169: while «Cerrar sesión» is in flight, the account and Inicio reads never leave with the previous user's ids.
describe("reads during sign-out", () => {
  it("Inicio refuse to send and do not retry", async () => {
    beginSessionEnd();
    try {
      const ctx = {} as never;
      await expect(homeQuery.queryFn!(ctx)).rejects.toBeInstanceOf(SessionEndedError);
      expect(calls).toEqual([]);
      expect(retryWhileOpen(3)(0, new Error("x"))).toBe(false);
    } finally {
      endSessionEnd();
    }
  });
});
