// SDD-20261106-ux-core-screens-pattern, U-3 · CA-1, CA-2, CA-4, CA-5 (and U-4 · CA-3 in the second describe): the five tabs of Theory U
// show loading (no empty text, no number), the errorText() with «Reintentar» when the read fails (also u_counts), the empty texts of §9
// only after the answer, and the hints as links to /accounts. Fictional data; no network (supabase, router and server functions are mocked).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorText } from "@/lib/errors";

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string }>,
  reads: {} as Record<string, number>,
  gate: null as Promise<void> | null,
  // Holds one read (by key) while the rest answer.
  hold: {} as Record<string, Promise<void>>,
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

// «table» reads rows; «table#count» is the head count query (u_counts), so each can fail on its own.
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string, head: boolean): object =>
    new Proxy(
      {},
      {
        get: (_t, p) => {
          if (p === "then")
            return (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
              (h.hold[head ? `${table}#count` : table] ?? h.gate ?? Promise.resolve())
                .then(() => {
                  const key = head ? `${table}#count` : table;
                  h.reads[key] = (h.reads[key] ?? 0) + 1;
                  const error = h.errors[key] ?? null;
                  const rows = h.tables[table] ?? [];
                  return {
                    data: error || head ? null : rows.slice(),
                    count: head ? rows.length : null,
                    error,
                  };
                })
                .then(f, r);
          if (p === "select")
            return (_c?: string, o?: { head?: boolean }) => chain(table, !!o?.head);
          return () => chain(table, head);
        },
      },
    );
  return { supabase: { from: (t: string) => chain(t, false) } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1" } } }),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (f: unknown) => f,
}));
vi.mock("@/lib/ai.functions", () => ({ synthesizeJourney: vi.fn(), sensingPatterns: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (o: unknown) => o,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useSearch: () => h.search,
  useNavigate: () => h.navigate,
  useRouterState: ({ select }: { select: (r: unknown) => unknown }) =>
    select({ location: { pathname: "/theory-u" } }),
}));

import { TheoryUScreen } from "./theory-u-screen";

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TheoryUScreen />
    </QueryClientProvider>,
  );
}
// Radix Tabs activates on mousedown (no user-event in the project).
const openTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
const wait = () => new Promise((r) => setTimeout(r, 30));
const hold = () => {
  let release: () => void = () => {};
  h.gate = new Promise<void>((r) => {
    release = r;
  });
  return () => release();
};
const NETWORK = { message: "Failed to fetch" };
const networkText = errorText(new Error("Failed to fetch"));

beforeEach(() => {
  h.tables = {};
  h.errors = {};
  h.reads = {};
  h.gate = null;
  h.hold = {};
  h.search = {};
  h.navigate.mockReset();
});
afterEach(cleanup);

const journeyRow = (phase = "co_initiating") => ({
  id: "j1",
  title: "Recorrido de prueba",
  intention: "",
  phase,
  answers: {},
  ai_synthesis: null,
  created_at: "2026-11-01T00:00:00Z",
});

describe("Theory U · Recorrido U", () => {
  const EMPTY = /Un recorrido U guía al equipo/;

  it("loading: no empty text; after an empty answer, the text (CA-1, CA-4)", async () => {
    const release = hold();
    mount();
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
  });

  it("error on the list: errorText and «Reintentar», never the empty text; retry reads again (CA-2)", async () => {
    h.errors.u_journeys = NETWORK;
    mount();
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    delete h.errors.u_journeys;
    const before = h.reads.u_journeys ?? 0;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(h.reads.u_journeys).toBeGreaterThan(before);
  });

  it("the sensing counter has no number until u_counts answers, then shows it (CA-1)", async () => {
    h.tables.u_journeys = [journeyRow("co_sensing")];
    h.tables.sensing_notes = [{ id: "n1" }, { id: "n2" }, { id: "n3" }];
    let release: () => void = () => {};
    h.hold["sensing_notes#count"] = new Promise<void>((r) => {
      release = r;
    });
    mount();
    await screen.findByDisplayValue("Recorrido de prueba");
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(/notas de sensing vinculadas/)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(/^3 notas de sensing vinculadas/)).toBeInTheDocument();
  });

  it("u_counts failing shows errorText and «Reintentar», never 0 notes or 0 experiments (CA-2)", async () => {
    h.tables.u_journeys = [journeyRow("co_sensing")];
    h.errors["sensing_notes#count"] = NETWORK;
    mount();
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(/^0 notas de sensing/)).not.toBeInTheDocument();
    delete h.errors["sensing_notes#count"];
    h.tables.sensing_notes = [{ id: "n1" }];
    const before = h.reads["sensing_notes#count"] ?? 0;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/^1 notas de sensing vinculadas/)).toBeInTheDocument();
    expect(h.reads["sensing_notes#count"]).toBeGreaterThan(before);
  });

  it("a failing experiments count is not hidden either (CA-2)", async () => {
    h.tables.u_journeys = [journeyRow("co_creating")];
    h.errors["gtm_experiments#count"] = NETWORK;
    mount();
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(/^0 prototipos vinculados/)).not.toBeInTheDocument();
  });
});

describe("Theory U · Sensing", () => {
  const EMPTY = "Sin notas todavía. Habla con clientes, observa y anota.";

  it("loading: no empty text and no «n notas»; after an empty answer, both (CA-1, CA-4)", async () => {
    const release = hold();
    mount();
    openTab("Sensing");
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ notas$/)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.getByText("0 notas")).toBeInTheDocument();
  });

  it("error (also from the accounts or journeys read): errorText and «Reintentar», no empty text, no number (CA-2)", async () => {
    h.errors.accounts = NETWORK;
    mount();
    openTab("Sensing");
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ notas$/)).not.toBeInTheDocument();
    delete h.errors.accounts;
    const before = h.reads.sensing_notes ?? 0;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(h.reads.sensing_notes).toBeGreaterThan(before);
  });
});

describe("Theory U · Escucha", () => {
  const EMPTY = /Aún no hay reuniones con nivel de escucha/;

  it("loading: no empty text, no counters; after an empty answer, 0 and the dashes (CA-1, CA-4)", async () => {
    const release = hold();
    mount();
    openTab("Escucha");
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText("Conversaciones valoradas")).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.getByText("Conversaciones valoradas").nextElementSibling).toHaveTextContent("0");
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("error: errorText and «Reintentar», no empty text, no counters (CA-2)", async () => {
    h.errors.sensing_notes = NETWORK;
    mount();
    openTab("Escucha");
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText("Conversaciones valoradas")).not.toBeInTheDocument();
    delete h.errors.sensing_notes;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
  });

  it("the empty text names «una cuenta» as a link to /accounts (CA-4, CA-5)", async () => {
    mount();
    openTab("Escucha");
    const p = (await screen.findByText(EMPTY)).closest("div") as HTMLElement;
    expect(p.textContent).toBe(
      "Aún no hay reuniones con nivel de escucha. Ábrelas desde una cuenta, en su pestaña «Planificador de reuniones».",
    );
    expect(screen.getByRole("link", { name: "una cuenta" })).toHaveAttribute("href", "/accounts");
  });

  it("the hint is its own line, always visible, with «cada cuenta» linking to /accounts, outside the Scharmer paragraph (CA-5) (C2 CA-3: opens the fold first)", async () => {
    const release = hold();
    mount();
    openTab("Escucha");
    await wait();
    const link = screen.getByRole("link", { name: "cada cuenta" });
    expect(link).toHaveAttribute("href", "/accounts");
    expect(link.parentElement?.textContent).toBe(
      "Valora tu nivel después de cada reunión en el planificador de reuniones de cada cuenta.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Más sobre esto" }));
    const scharmer = screen.getByText(/Según Scharmer/);
    expect(scharmer.textContent).not.toMatch(/Valora tu nivel/);
    expect(scharmer.contains(link)).toBe(false);
    release();
  });
});

describe("Theory U · Clínica de casos", () => {
  const EMPTY = "Aún no hay clínicas de casos. Crea la primera con «+ Nueva clínica de casos».";

  it("loading: no empty text; after an empty answer, the new text; with a clinic, no empty text (CA-1, CA-4)", async () => {
    const release = hold();
    mount();
    openTab("Clínica de casos");
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.getByText("Selecciona o crea una clínica de casos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Nueva clínica de casos" })).toBeInTheDocument();
  });

  it("with a clinic the list shows it and not the empty text (CA-4)", async () => {
    h.tables.case_clinics = [
      { id: "c1", title: "Clínica A", held_on: "2026-11-01", status: "open", deals: null },
    ];
    mount();
    openTab("Clínica de casos");
    expect(await screen.findByText("Clínica A")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
  });

  it("error: errorText and «Reintentar», no empty text (CA-2)", async () => {
    h.errors.deals = NETWORK;
    mount();
    openTab("Clínica de casos");
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    delete h.errors.deals;
    const before = h.reads.case_clinics ?? 0;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(h.reads.case_clinics).toBeGreaterThan(before);
  });
});

describe("Theory U · Prototipos", () => {
  const EMPTY = "Aún no hay prototipos GTM. Crea el primero.";

  it("loading: no empty text and no «(0)» per column; after an empty answer, both (CA-1, CA-4)", async () => {
    const release = hold();
    mount();
    openTab("Prototipos");
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText("(0)")).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.getAllByText("(0)")).toHaveLength(5);
  });

  it("error: errorText and «Reintentar», no empty text, no counters (CA-2)", async () => {
    h.errors.gtm_experiments = NETWORK;
    mount();
    openTab("Prototipos");
    expect(await screen.findByText(networkText)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText("(0)")).not.toBeInTheDocument();
    delete h.errors.gtm_experiments;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("(0)")).toHaveLength(5));
  });
});

// SDD-20261106-ux-core-screens-pattern, U-4 · CA-3: ?seccion= on Theory U.
describe("Theory U · ?seccion= (CA-3)", () => {
  const selectedTab = () =>
    screen.getAllByRole("tab").filter((t) => t.getAttribute("aria-selected") === "true");

  it("opens the tab named by seccion", async () => {
    h.search = { seccion: "listening" };
    mount();
    await screen.findByText(/Aún no hay reuniones con nivel de escucha/);
    expect(selectedTab().map((t) => t.textContent)).toEqual(["Escucha"]);
  });

  it("an unknown id or none opens Recorrido U", async () => {
    h.search = { seccion: "nope" };
    mount();
    await screen.findByText(/Un recorrido U guía al equipo/);
    expect(selectedTab().map((t) => t.textContent)).toEqual(["Recorrido U"]);
  });

  it("changing tab navigates with replace and the new seccion, and removes it for Recorrido U", async () => {
    h.search = { seccion: "listening" };
    mount();
    await screen.findByText(/Aún no hay reuniones con nivel de escucha/);
    openTab("Clínica de casos");
    const call = h.navigate.mock.calls.at(-1)?.[0] as {
      search: (p: Record<string, unknown>) => unknown;
      replace?: boolean;
    };
    expect(call.replace).toBe(true);
    expect(call.search({ seccion: "listening" })).toEqual({ seccion: "clinic" });
    expect(selectedTab().map((t) => t.textContent)).toEqual(["Clínica de casos"]);
    openTab("Recorrido U");
    const back = h.navigate.mock.calls.at(-1)?.[0] as {
      search: (p: Record<string, unknown>) => unknown;
    };
    expect(back.search({ seccion: "clinic" })).toEqual({});
  });
});
