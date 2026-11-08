// SDD-20261106-hub-search, U-0 · CA-0: «Conocimiento» extracted from the route keeps behaving as before when nobody searches:
// the list of the section, the count per section, ?doc= opening, «+ Nuevo» and opening a document after an import.
// Fictional data; no network (supabase, router, drive and background jobs are mocked).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  section: string;
  title: string;
  body: string;
  scope: string;
  mandatory: boolean;
  created_by: string | null;
  updated_at: string;
};

const h = vi.hoisted(() => ({
  docs: [] as Record<string, unknown>[],
  gate: null as Promise<void> | null,
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
  importId: "d2",
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
                (h.gate ?? Promise.resolve())
                  .then(() => ({
                    data: table === "knowledge_docs" ? h.docs.slice() : [],
                    error: null,
                  }))
                  .then(f, r)
            : () => chain(table),
      },
    );
  return { supabase: { from: (t: string) => chain(t) } };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1" } } }),
}));
vi.mock("@/components/background", () => ({
  useJob: () => ({ running: false, start: vi.fn(), job: null }),
}));
vi.mock("@/components/drive", () => ({
  DriveImportButton: ({ onImported }: { onImported: (id: string) => void }) => (
    <button onClick={() => onImported(h.importId)}>Importar de Drive</button>
  ),
  SaveToDriveButton: () => <button>Guardar en Drive</button>,
}));
vi.mock("@/components/linkedin", () => ({
  BattlecardFromReviews: () => <button>Battlecard desde reseñas</button>,
}));
vi.mock("@/components/drive-overview", () => ({
  DriveAccountsPanel: () => <div>panel-drive-por-cuenta</div>,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (o: unknown) => o,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useSearch: () => h.search,
  useNavigate: () => h.navigate,
  useRouterState: ({ select }: { select: (r: unknown) => unknown }) =>
    select({ location: { pathname: "/hub" } }),
}));

import { HubScreen } from "./hub-screen";

const row = (id: string, section: string, title: string, body = "Texto de prueba."): Row => ({
  id,
  section,
  title,
  body,
  scope: "team",
  mandatory: false,
  created_by: null,
  updated_at: "2026-11-01T00:00:00Z",
});

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HubScreen />
    </QueryClientProvider>,
  );
}
const sectionButton = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}\\s*\\d+$`) });

beforeEach(() => {
  h.docs = [
    row("d1", "company", "Propuesta de valor"),
    row("d3", "company", "Precios 2026"),
    row("d4", "objections", "Es caro"),
  ];
  h.gate = null;
  h.search = {};
  h.navigate.mockReset();
});
afterEach(cleanup);

describe("HubScreen · sin búsqueda, igual que antes (CA-0)", () => {
  it("lists the documents of the first section and counts every section", async () => {
    mount();
    expect(await screen.findByText("Propuesta de valor")).toBeInTheDocument();
    expect(screen.getByText("Precios 2026")).toBeInTheDocument();
    expect(screen.queryByText("Es caro")).not.toBeInTheDocument();
    expect(within(sectionButton("Empresa")).getByText("2")).toBeInTheDocument();
    expect(within(sectionButton("Objeciones y battlecards")).getByText("1")).toBeInTheDocument();
    expect(within(sectionButton("Reglas")).getByText("0")).toBeInTheDocument();
  });

  it("switches the list when another section is chosen", async () => {
    mount();
    await screen.findByText("Propuesta de valor");
    fireEvent.click(sectionButton("Objeciones y battlecards"));
    expect(screen.getByText("Es caro")).toBeInTheDocument();
    expect(screen.queryByText("Propuesta de valor")).not.toBeInTheDocument();
    expect(screen.getByText("Battlecard desde reseñas")).toBeInTheDocument();
  });

  it("opens the document named by ?doc= in its section", async () => {
    h.search = { doc: "d4" };
    mount();
    expect(await screen.findByDisplayValue("Es caro")).toBeInTheDocument();
    expect(screen.getByText("Battlecard desde reseñas")).toBeInTheDocument();
  });

  it("«+ Nuevo» opens an unsaved draft", async () => {
    mount();
    await screen.findByText("Propuesta de valor");
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo" }));
    expect(screen.getByText(/Documento nuevo · sin guardar/)).toBeInTheDocument();
  });

  it("says so when the section has no documents", async () => {
    mount();
    await screen.findByText("Propuesta de valor");
    fireEvent.click(sectionButton("Reglas"));
    expect(screen.getByText(/Sin documentos todavía/)).toBeInTheDocument();
  });

  it("opens a document right after an import (second read includes it)", async () => {
    mount();
    await screen.findByText("Propuesta de valor");
    h.docs = [...h.docs, row("d2", "company", "Importado de Drive")];
    fireEvent.click(screen.getByRole("button", { name: "Importar de Drive" }));
    expect(await screen.findByDisplayValue("Importado de Drive")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Importado de Drive", { selector: "span" })).toBeInTheDocument(),
    );
  });

  it("the Drive tab shows the per-account panel", async () => {
    mount();
    await screen.findByText("Propuesta de valor");
    fireEvent.click(screen.getByRole("button", { name: "Drive por cuenta" }));
    expect(screen.getByText("panel-drive-por-cuenta")).toBeInTheDocument();
  });
});
