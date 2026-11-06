// NK-0064 (SDD tool-plan-real-connections): the team's tool plan on Conexiones. Fictional rows; supabase, the role and
// the toast are mocked, so nothing here reaches the network. The mock is controllable per test: `h.rows` are the plan
// rows, `h.update` is what the status update returns.
import { fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: string; category: string; name: string; purpose: string; status: string };
const h = vi.hoisted(() => ({
  roles: ["owner"] as string[],
  rows: [] as Row[],
  update: { data: [{ id: "x" }] as unknown, error: null as unknown },
  updates: [] as { status: string }[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (mode: { update?: boolean } = {}): object =>
    new Proxy(
      {},
      {
        get: (_t, p) => {
          if (p === "then") return (f: (v: unknown) => unknown) => Promise.resolve(mode.update ? h.update : { data: h.rows, error: null }).then(f);
          return (...args: unknown[]) => {
            if (p === "update") h.updates.push(args[0] as { status: string });
            return builder({ update: mode.update || p === "update" });
          };
        },
      },
    );
  return { supabase: { from: () => builder() } };
});
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { user: { id: "u1" }, roles: h.roles, currentOrg: { org_id: "o1" } } }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }) }));

import { toast } from "sonner";
import { ToolPlan } from "@/components/integrations/tool-plan";

const row = (name: string, status = "planned", category = "CRM"): Row => ({ id: `id-${name}`, category, name, purpose: `Para qué sirve ${name}`, status });

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToolPlan />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.roles = ["owner"];
  h.rows = [row("Apollo"), row("HubSpot"), row("Gmail"), row("GitHub"), row("Herramienta propia")];
  h.update = { data: [{ id: "x" }], error: null };
  h.updates = [];
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("the status selector (CA-5, regression)", () => {
  it("offers the three statuses on every row and disables none, whatever the connection type", async () => {
    mount();
    const selects = await screen.findAllByRole("combobox");
    expect(selects).toHaveLength(h.rows.length);
    for (const s of selects) {
      const options = within(s).getAllByRole("option") as HTMLOptionElement[];
      expect(options.map((o) => o.textContent)).toEqual(["Pendiente", "Lo estamos montando", "Ya lo usamos"]);
      expect(options.every((o) => !o.disabled)).toBe(true);
      expect((s as HTMLSelectElement).disabled).toBe(false);
    }
  });
  it("lets the owner set «Ya lo usamos» on a tool Nokko does not connect to", async () => {
    mount();
    fireEvent.change(await screen.findByLabelText("Estado de GitHub en el plan"), { target: { value: "connected" } });
    await waitFor(() => expect(h.updates).toEqual([{ status: "connected" }]));
  });
});
