// NK-0079: «Ver actividad» said «Cargando…» for ever when the read of play_runs failed.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ fail: true, reads: 0 }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, k: string) => {
      if (k === "then")
        return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
          h.reads++;
          return Promise.resolve(
            h.fail
              ? { data: null, error: { message: 'relation "play_runs" does not exist' } }
              : { data: [], error: null },
          ).then(res, rej);
        };
      return () => chain;
    },
  });
  return { supabase: { from: () => chain } };
});

import { Activity } from "@/components/plays/play-card";

afterEach(cleanup);

it("a failed read says so, hides the database wording and retries on demand", async () => {
  h.fail = true;
  h.reads = 0;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Activity playId="synthetic-play" />
    </QueryClientProvider>,
  );
  await screen.findByText(/No he podido cargar la actividad de este play/);
  expect(screen.queryByText("Cargando…")).toBeNull();
  expect(document.body.textContent).not.toContain("play_runs");

  h.fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Aún no hay pasos ni descartes registrados para este play");
  await waitFor(() => expect(h.reads).toBe(2));
});
