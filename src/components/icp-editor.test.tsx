// NK-0024: what the AI proposes in the ICP editor is saved with its real origin (ia, not confirmed), and becomes
// «persona» + confirmed only when a person edits it. Trigger 0058 stamps «persona» on any tracked change that
// arrives without field_sources, so the editor must send the marks itself. Fictional data; supabase and the
// server function are mocked.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  proposal: {} as Record<string, unknown>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string, mode: { update?: boolean; one?: boolean } = {}): object =>
    new Proxy(
      {},
      {
        get: (_t, p) => {
          if (p === "then")
            return (f: (v: unknown) => unknown) =>
              Promise.resolve({
                data:
                  table !== "icp_profiles"
                    ? []
                    : mode.update
                      ? [{ id: h.row.id }]
                      : mode.one
                        ? h.row
                        : [h.row],
                error: null,
              }).then(f);
          return (...args: unknown[]) => {
            if (p === "update") h.updates.push(args[0] as Record<string, unknown>);
            return builder(table, {
              ...mode,
              update: mode.update || p === "update",
              one: mode.one || p === "single",
            });
          };
        },
      },
    );
  return { supabase: { from: (t: string) => builder(t) } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1" } } }),
}));
vi.mock("@/hooks/use-unsaved-guard", () => ({ useUnsavedGuard: () => undefined }));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (f: unknown) => f,
}));
vi.mock("@/lib/ai.functions", () => ({ structureIcp: async () => h.proposal }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }),
}));

import { IcpEditor } from "@/components/icp-editor";

const PROPOSAL = { countries: ["ES", "MX"], min_employees: 51, max_employees: 200 };

async function open() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <IcpEditor />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByText("ICP de prueba"));
  await screen.findByText("Guardar ICP");
}
const propose = async () => {
  fireEvent.click(screen.getByText("Proponer criterios de búsqueda"));
  await waitFor(() => expect(screen.getByDisplayValue("ES, MX")).toBeTruthy());
};
const save = async () => {
  fireEvent.click(screen.getByText("Guardar ICP"));
  await waitFor(() => expect(h.updates.length).toBeGreaterThan(0));
  return h.updates[h.updates.length - 1]!;
};
const marks = (u: Record<string, unknown>) =>
  (u.field_sources ?? {}) as Record<string, { kind?: string; confirmed?: boolean }>;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  h.updates = [];
  h.proposal = PROPOSAL;
  h.row = {
    id: "i1",
    name: "ICP de prueba",
    segment_id: null,
    search_keywords: [],
    countries: [],
    target_titles: [],
    seniorities: [],
    min_employees: null,
    max_employees: null,
    field_sources: {},
  };
});

describe("icp-editor origin of AI proposals (NK-0024)", () => {
  it("saves countries and employee range proposed by the AI as ia, not confirmed", async () => {
    await open();
    await propose();
    const m = marks(await save());
    for (const f of ["countries", "min_employees", "max_employees"]) {
      expect(m[f]?.kind, f).toBe("ia");
      expect(m[f]?.confirmed, f).toBe(false);
    }
  });

  it("marks a proposed value as persona and confirmed once the person edits it", async () => {
    await open();
    await propose();
    fireEvent.change(screen.getByDisplayValue("ES, MX"), { target: { value: "es, co" } });
    fireEvent.change(screen.getByDisplayValue("51"), { target: { value: "60" } });
    const u = await save();
    const m = marks(u);
    expect(m.countries).toMatchObject({ kind: "persona", confirmed: true });
    expect(m.min_employees).toMatchObject({ kind: "persona", confirmed: true });
    expect(m.max_employees).toMatchObject({ kind: "ia", confirmed: false });
  });

  it("keeps the mark of a field the person wrote when the AI proposes the others", async () => {
    h.proposal = { countries: ["ES"] };
    await open();
    fireEvent.change(screen.getByText("Empleados hasta").parentElement!.querySelector("input")!, {
      target: { value: "300" },
    });
    await propose2();
    const m = marks(await save());
    expect(m.countries).toMatchObject({ kind: "ia", confirmed: false });
    expect(m.max_employees).toMatchObject({ kind: "persona", confirmed: true });
  });

  it("guard: a value written by a person without AI is never marked ia", async () => {
    await open();
    fireEvent.change(screen.getByPlaceholderText("ES, MX, CO"), { target: { value: "ar" } });
    const m = marks(await save());
    // Either it sends the persona mark itself or leaves it to trigger 0058; never an AI origin.
    expect(m.countries === undefined || m.countries.kind === "persona").toBe(true);
    expect(m.countries?.confirmed ?? true).toBe(true);
  });
});

async function propose2() {
  fireEvent.click(screen.getByText("Proponer criterios de búsqueda"));
  await waitFor(() => expect(screen.getByDisplayValue("ES")).toBeTruthy());
}
