// SDD-20261027 strategic-suggestions-engine, F0 · CA-1, CA-3, CA-7 on the screens: the board (list and team view) and the deck
// show a strategic suggestion with level, sample size and expandable evidence with links, say Aceptar / Más tarde / Descartar and
// never show more than 7 open strategic suggestions. Fictional data; no network (supabase and the server function are mocked).
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStrategySuggestion } from "@/lib/strategy-suggestions";

const hoisted = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], decide: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (data: unknown): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(f)
            : () => chain(data),
      },
    );
  return { supabase: { from: (t: string) => chain(t === "suggestions" ? hoisted.rows : []) } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1" } } }),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (f: unknown) => f,
}));
vi.mock("@/lib/agent.functions", () => ({ decideSuggestion: hoisted.decide }));
vi.mock("@/components/suggestions", () => ({ useSuggestions: () => ({}) }));
vi.mock("@/components/agent", () => ({ useAgent: () => ({ open: vi.fn() }) }));
vi.mock("sonner", () => ({
  toast: Object.assign(
    vi.fn(() => "t"),
    { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...p
  }: { to: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={to} aria-label={p["aria-label"] as string | undefined}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { SuggestionBoard } from "@/components/suggestion-board";
import { SuggestionDeck } from "@/components/suggestion-deck";

const ev = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    table: "deals",
    id: `d${i + 1}`,
    label: `Deal ${i + 1}`,
  }));
const strategic = (
  id: string,
  over: { priority?: 1 | 2 | 3; evidence?: number; sample?: number; created?: string } = {},
) => {
  const b = buildStrategySuggestion({
    element: "icp",
    kind: "create",
    action_type: "strategy_change",
    cause: id,
    priority: over.priority ?? 2,
    title: `Estratégica ${id}`,
    body: "texto",
    evidence: ev(over.evidence ?? 5),
    sample_size: over.sample,
  });
  return {
    id,
    title: b.title,
    body: b.body,
    priority: b.priority,
    link: null,
    action: null,
    status: "pending",
    user_id: null,
    created_at: over.created ?? "2026-10-20T00:00:00Z",
    updated_at: over.created ?? "2026-10-20T00:00:00Z",
    snoozed_until: null,
    detector: b.detector,
    dedupe_key: b.dedupe_key,
    strategy: b.strategy,
  };
};
const operational = (id: string) => ({
  id,
  title: `Operativa ${id}`,
  body: "",
  priority: 2,
  link: null,
  action: null,
  status: "pending",
  user_id: null,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
  snoozed_until: null,
  detector: "meddpicc_gaps",
  dedupe_key: `m:${id}`,
  strategy: null,
});

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );
beforeEach(() => {
  hoisted.rows = [];
  hoisted.decide.mockReset();
  hoisted.decide.mockResolvedValue({ message: "ok" });
});

describe("board: list and team view (desktop table and phone cards)", () => {
  it("a strategic suggestion shows level, sample size and a collapsible evidence list with a link per record", async () => {
    hoisted.rows = [strategic("a", { evidence: 3, sample: 12 })];
    wrap(<SuggestionBoard />);
    expect((await screen.findAllByText("Estratégica a")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alta").length).toBeGreaterThan(0); // 12 records: high
    expect(screen.getAllByText(/Muestra: 12 registros/).length).toBeGreaterThan(0);
    const details = document.querySelector("details")!;
    expect(within(details).getByText("Ver evidencia")).toBeInTheDocument();
    const link = within(details).getByRole("link", { name: "Deal 1" });
    expect(link).toHaveAttribute("href", "/deals");
    expect(within(details).getByText("y 9 más en la muestra")).toBeInTheDocument();
  });
  it("says Aceptar, Más tarde and Descartar for a strategic one, and keeps the operational wording for the others", async () => {
    hoisted.rows = [strategic("a"), operational("o")];
    wrap(<SuggestionBoard />);
    await screen.findAllByText("Estratégica a");
    expect(screen.getAllByRole("button", { name: "Aceptar" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Más tarde" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Descartar" }).length).toBe(4); // two renderings (table, cards) of each row
    expect(screen.getAllByRole("button", { name: "Marcar como hecha" }).length).toBeGreaterThan(0); // only the operational one
    expect(screen.getAllByRole("button", { name: "Posponer 3 días" }).length).toBeGreaterThan(0);
    expect(document.querySelectorAll("details")).toHaveLength(2); // evidence only on the strategic row (table + cards)
  });
  it("Aceptar sends the decision for that suggestion", async () => {
    hoisted.rows = [strategic("a")];
    wrap(<SuggestionBoard />);
    await screen.findAllByText("Estratégica a");
    fireEvent.click(screen.getAllByRole("button", { name: "Aceptar" })[0]!);
    await waitFor(() =>
      expect(hoisted.decide).toHaveBeenCalledWith({ data: { id: "a", decision: "approve" } }),
    );
  });
  it("the optional reason typed on a strategic row travels with the decision; operational rows have no reason field", async () => {
    hoisted.rows = [strategic("a"), operational("o")];
    wrap(<SuggestionBoard />);
    await screen.findAllByText("Estratégica a");
    const fields = screen.getAllByLabelText("Motivo de tu decisión (opcional)");
    expect(fields).toHaveLength(2); // the strategic row, in the table and in the phone cards
    fireEvent.change(fields[0]!, { target: { value: "  Tras la reunión  " } });
    fireEvent.click(screen.getAllByRole("button", { name: "Descartar" })[0]!);
    await waitFor(() =>
      expect(hoisted.decide).toHaveBeenCalledWith({
        data: { id: "a", decision: "dismiss", reason: "Tras la reunión" },
      }),
    );
  });
  it("CA-7: of 10 open strategic suggestions only 7 are listed, and every operational one stays", async () => {
    hoisted.rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        strategic(`s${i}`, {
          priority: ((i % 3) + 1) as 1 | 2 | 3,
          created: `2026-10-${String(10 + i).padStart(2, "0")}T00:00:00Z`,
        }),
      ),
      operational("o1"),
      operational("o2"),
    ];
    wrap(<SuggestionBoard />);
    await screen.findAllByText("Operativa o1");
    const titles = new Set(screen.getAllByText(/^Estratégica s\d$/).map((e) => e.textContent));
    expect(titles.size).toBe(7);
    expect(screen.getAllByText(/^Operativa o\d$/)).toHaveLength(4);
    // 4 urgent + 3 important fill the 7 slots; every "when you can" one (s2, s5, s8) is past the cap
    for (const gone of ["s2", "s5", "s8"])
      expect(screen.queryAllByText(`Estratégica ${gone}`)).toHaveLength(0);
    expect(screen.getAllByText("Estratégica s1").length).toBeGreaterThan(0);
  });
});

describe("deck (Inicio and card view of Sugerencias)", () => {
  type Items = React.ComponentProps<typeof SuggestionDeck>["items"];
  it("a strategic card shows level, sample size and the evidence list with links, and labels Aceptar / Más tarde / Descartar", () => {
    const s = strategic("a", { evidence: 4, sample: 4 });
    wrap(<SuggestionDeck items={[s] as unknown as Items} keyboard={false} />);
    expect(screen.getByText("Estratégica a")).toBeInTheDocument();
    expect(screen.getByText("Baja")).toBeInTheDocument();
    expect(screen.getByText(/Muestra: 4 registros/)).toBeInTheDocument();
    expect(within(document.querySelector("details")!).getAllByRole("link")).toHaveLength(4);
    for (const name of ["Aceptar", "Más tarde", "Descartar"])
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hacer/ })).toBeNull();
  });
  it("CA-7: the deck holds 7 strategic cards out of 10", () => {
    const items = Array.from({ length: 10 }, (_, i) => strategic(`s${i}`));
    wrap(<SuggestionDeck items={items as unknown as Items} keyboard={false} />);
    expect(screen.getByText(/1 de 7/)).toBeInTheDocument();
  });
  it("the optional reason typed on a strategic card is sent when the swipe commits; an operational card sends none", async () => {
    vi.useFakeTimers();
    try {
      wrap(<SuggestionDeck items={[strategic("a")] as unknown as Items} keyboard={false} />);
      fireEvent.change(screen.getByLabelText("Motivo de tu decisión (opcional)"), {
        target: { value: " No aplica " },
      });
      fireEvent.click(screen.getByRole("button", { name: /Descartar/ }));
      await vi.advanceTimersByTimeAsync(5100);
      expect(hoisted.decide).toHaveBeenCalledWith({
        data: { id: "a", decision: "dismiss", reason: "No aplica" },
      });
    } finally {
      vi.useRealTimers();
    }
  });
  it("an operational card keeps «Hacer» and has no evidence block", () => {
    wrap(<SuggestionDeck items={[operational("o")] as unknown as Items} keyboard={false} />);
    expect(screen.getByRole("button", { name: /Hacer/ })).toBeInTheDocument();
    expect(document.querySelector("details")).toBeNull();
    expect(screen.queryByLabelText("Motivo de tu decisión (opcional)")).toBeNull();
  });
});
