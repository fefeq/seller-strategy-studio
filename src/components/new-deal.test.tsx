// SDD-20261109-new-deal-source U-3 (NK-0123) CA-5: «Nuevo deal» of Pipeline asks for «Fuente» and always sends `source` to
// create_deal (null for «Sin origen»). Fictional data; supabase, the server function and the hooks around it are mocked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ apply: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(f)
            : () => chain(),
      },
    );
  return { supabase: { from: () => chain() } };
});
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (f: unknown) => f,
}));
vi.mock("@/lib/agent.functions", () => ({ applySetupItems: hoisted.apply }));
vi.mock("@/components/stage-settings", () => ({
  useStages: () => ({
    stages: [
      { key: "discovery", label: "Discovery", probability: 10, kind: "open", position: 1 },
      { key: "won", label: "Ganado", probability: 100, kind: "won", position: 2 },
    ],
  }),
}));
vi.mock("@/components/deal-lines", () => ({ useProducts: () => ({ data: [] }) }));
vi.mock("@/hooks/use-me", () => ({
  useCurrency: () => ({ symbol: "€", money: (n: number) => `${n} €` }),
}));
vi.mock("@/components/entity-combobox", () => ({
  EntityCombobox: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (t: string, a: null) => void;
  }) => (
    <input aria-label="Cuenta" value={value} onChange={(e) => onChange(e.target.value, null)} />
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { NewDealButton } from "@/components/new-deal";

function renderButton() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NewDealButton />
    </QueryClientProvider>,
  );
}
const open = () => fireEvent.click(screen.getByRole("button", { name: "+ Nuevo deal" }));
const source = () => screen.getByRole("combobox", { name: "Fuente" }) as HTMLSelectElement;
const create = async (name: string) => {
  // The Field label is not tied to its input, so the name is the first text box of the dialog.
  fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Crear deal" }));
  await waitFor(() => expect(hoisted.apply).toHaveBeenCalledTimes(1));
  return hoisted.apply.mock.calls[0]![0].data.items[0] as {
    tool: string;
    args: Record<string, unknown>;
  };
};

beforeEach(() => {
  hoisted.apply.mockReset();
  hoisted.apply.mockResolvedValue([{ ok: true }]);
});
afterEach(cleanup);

describe("NewDealButton «Fuente»", () => {
  it("shows «Sin origen» and sends source null when nobody touches it", async () => {
    renderButton();
    open();
    expect(source().selectedOptions[0]!.textContent).toBe("Sin origen");
    const item = await create("Acme renovación");
    expect(item.tool).toBe("create_deal");
    expect(item.args).toHaveProperty("source", null);
  });
  it("sends the chosen source", async () => {
    renderButton();
    open();
    fireEvent.change(source(), { target: { value: "inbound" } });
    const item = await create("Acme renovación");
    expect(item.args.source).toBe("inbound");
  });
  it("goes back to «Sin origen» after creating", async () => {
    renderButton();
    open();
    fireEvent.change(source(), { target: { value: "inbound" } });
    await create("Acme renovación");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Fuente" })).toBeNull());
    open();
    expect(source().selectedOptions[0]!.textContent).toBe("Sin origen");
  });
});
