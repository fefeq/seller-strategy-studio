// SDD-20261118-ux-legibilidad-pantallas-diarias · U-6 · CA-10 (gate round 3): the «Avisos» trigger of the top bar
// uses noticeLabels. Below sm it shows the short label (number capped at «9+»), from sm up the full one with the real
// number, and the aria-label always keeps the real count. Fictional data, no network.
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) =>
                Promise.resolve({ data: db.tables[table] ?? [], error: null }).then(f)
            : () => chain(table),
      },
    );
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: { from: (t: string) => chain(t), channel: () => channel, removeChannel: vi.fn() },
  };
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/background.functions", () => ({
  cancelBackgroundJob: vi.fn(),
  retryBackgroundJob: vi.fn(),
}));

import { NotificationCenter } from "@/components/notification-center";

const notice = (i: number) => ({
  id: `n${i}`,
  kind: "done",
  title: `Aviso ${i}`,
  body: null,
  link: null,
  read_at: null,
  created_at: "2026-11-18T10:00:00Z",
  job_id: null,
});
const job = (i: number) => ({
  id: `j${i}`,
  label: `Trabajo ${i}`,
  step: null,
  status: "running",
  created_at: "2026-11-18T10:00:00Z",
  cancel_requested: false,
});

async function trigger(unread: number, running: number) {
  db.tables = {
    notifications: Array.from({ length: unread }, (_, i) => notice(i)),
    background_jobs: Array.from({ length: running }, (_, i) => job(i)),
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationCenter userId="u1" />
    </QueryClientProvider>,
  );
  const wanted = `Avisos, ${unread} sin leer${running ? `, ${running} en marcha` : ""}`;
  const btn = await screen.findByRole("button", { name: wanted });
  await waitFor(() => expect(btn.getAttribute("aria-label")).toBe(wanted));
  const spans = [...btn.querySelectorAll("span")];
  const short = spans.find((s) => s.classList.contains("sm:hidden"))?.textContent;
  const long = spans.find((s) => s.classList.contains("sm:inline"))?.textContent;
  return { btn, short, long };
}

describe("the «Avisos» trigger", () => {
  it("14 unread: «Avisos · 9+» below sm, «Avisos · 14» from sm, and «14 sin leer» for a screen reader", async () => {
    const { short, long } = await trigger(14, 0);
    expect(short).toBe("Avisos · 9+");
    expect(long).toBe("Avisos · 14");
  });

  it("3 unread: the number as is in both labels", async () => {
    const { short, long } = await trigger(3, 0);
    expect(short).toBe("Avisos · 3");
    expect(long).toBe("Avisos · 3");
  });

  it("2 running with 14 unread: running wins, «en marcha» only in the long label, real counts in the aria-label", async () => {
    const { short, long } = await trigger(14, 2);
    expect(short).toBe("Avisos · 2");
    expect(long).toBe("Avisos · 2 en marcha");
  });

  it("nothing pending: «Avisos»", async () => {
    const { short, long } = await trigger(0, 0);
    expect(short).toBe("Avisos");
    expect(long).toBe("Avisos");
  });
});
