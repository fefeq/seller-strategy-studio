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
          if (p === "then")
            return (f: (v: unknown) => unknown) =>
              Promise.resolve(mode.update ? h.update : { data: h.rows, error: null }).then(f);
          return (...args: unknown[]) => {
            if (p === "update") h.updates.push(args[0] as { status: string });
            return builder({ update: mode.update || p === "update" });
          };
        },
      },
    );
  return { supabase: { from: () => builder() } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "u1" }, roles: h.roles, currentOrg: { org_id: "o1" } } }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }),
}));

import { toast } from "sonner";
import { ToolPlan } from "@/components/integrations/tool-plan";

const row = (name: string, status = "planned", category = "CRM"): Row => ({
  id: `id-${name}`,
  category,
  name,
  purpose: `Para qué sirve ${name}`,
  status,
});

function mount() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
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
      expect(options.map((o) => o.textContent)).toEqual([
        "Pendiente",
        "Lo estamos montando",
        "Ya lo usamos",
      ]);
      expect(options.every((o) => !o.disabled)).toBe(true);
      expect((s as HTMLSelectElement).disabled).toBe(false);
    }
  });
  it("lets the owner set «Ya lo usamos» on a tool Nokko does not connect to", async () => {
    mount();
    fireEvent.change(await screen.findByLabelText("Estado de GitHub en el plan"), {
      target: { value: "connected" },
    });
    await waitFor(() => expect(h.updates).toEqual([{ status: "connected" }]));
  });
});

const card = (name: string) => screen.getByText(name).closest(".rounded-lg") as HTMLElement;

describe("the connection label on each row (CA-3)", () => {
  it("shows one of four distinct labels according to what Nokko does with the tool", async () => {
    mount();
    await screen.findByText("Apollo");
    expect(within(card("Apollo")).getByText("Conexión disponible")).toBeInTheDocument();
    expect(within(card("HubSpot")).getByText("Entra por webhook")).toBeInTheDocument();
    expect(within(card("Gmail")).getByText("Sin conexión nativa todavía")).toBeInTheDocument();
    expect(within(card("GitHub")).getByText("Sin conexión conocida")).toBeInTheDocument();
    expect(
      within(card("Herramienta propia")).getByText("Sin conexión conocida"),
    ).toBeInTheDocument();
  });
});

describe("the section text (CA-3b)", () => {
  it("speaks to the reader as «tú» and no longer says «vosotros»", async () => {
    mount();
    await screen.findByText("Apollo");
    expect(
      screen.getByText(
        "Un tablero para que el equipo apunte qué herramientas usa o quiere usar. El estado lo marca el Owner y no significa que Nokko esté conectado; la etiqueta de conexión indica lo que Nokko conoce hoy de esa herramienta.",
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/vosotros/i);
  });
});

const NOTE = {
  webhook: "El equipo la usa; Nokko recibe sus datos solo si montas el flujo por webhook.",
  not_yet: "El equipo la usa, pero Nokko no tiene conexión con ella hoy.",
  none: "El equipo la usa, pero no consta ninguna conexión de Nokko con ella.",
};

describe("the warning under «Ya lo usamos» (CA-4)", () => {
  it("warns according to the connection type, and not for a native connection", async () => {
    h.rows = [
      row("Apollo", "connected"),
      row("HubSpot", "connected"),
      row("Gmail", "connected"),
      row("GitHub", "connected"),
    ];
    mount();
    await screen.findByText("Apollo");
    expect(within(card("Apollo")).queryByText(/El equipo la usa/)).toBeNull();
    expect(within(card("HubSpot")).getByText(NOTE.webhook)).toBeInTheDocument();
    expect(within(card("Gmail")).getByText(NOTE.not_yet)).toBeInTheDocument();
    expect(within(card("GitHub")).getByText(NOTE.none)).toBeInTheDocument();
  });
  it("shows no warning while the tool is «Pendiente» or «Lo estamos montando»", async () => {
    h.rows = [row("HubSpot", "planned"), row("Gmail", "in_progress"), row("GitHub", "planned")];
    mount();
    await screen.findByText("HubSpot");
    expect(screen.queryByText(/El equipo la usa/)).toBeNull();
  });
});

const OWNER_ONLY =
  "No se ha guardado. Solo el Owner puede cambiar el plan de herramientas; si ya lo eres, recarga la página y vuelve a intentarlo.";

describe("a change the server does not accept (CA-6)", () => {
  it("says only the Owner can change the plan when nothing was written", async () => {
    h.update = { data: [], error: null };
    mount();
    fireEvent.change(await screen.findByLabelText("Estado de GitHub en el plan"), {
      target: { value: "connected" },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(OWNER_ONLY));
  });
  it("says the same when the server answers with a permission error (42501)", async () => {
    h.update = {
      data: null,
      error: { code: "42501", message: "new row violates row-level security policy" },
    };
    mount();
    fireEvent.change(await screen.findByLabelText("Estado de GitHub en el plan"), {
      target: { value: "connected" },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(OWNER_ONLY));
  });
  it("keeps the generic message for any other error", async () => {
    h.update = { data: null, error: { code: "08006", message: "connection failure" } };
    mount();
    fireEvent.change(await screen.findByLabelText("Estado de GitHub en el plan"), {
      target: { value: "connected" },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalledWith(OWNER_ONLY);
  });
});

describe("a member who is not the Owner (CA-6b)", () => {
  it("sees the rows and their connection labels but no status selector", async () => {
    h.roles = ["ae"];
    mount();
    await screen.findByText("Apollo");
    expect(within(card("Apollo")).getByText("Conexión disponible")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
