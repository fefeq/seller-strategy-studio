// SDD-20261106-hub-search, U-0 · CA-0 (first describe) and U-3 · CA-3 to CA-7, CA-9 (second): «Conocimiento» extracted from the route keeps behaving as before when nobody searches:
// the list of the section, the count per section, ?doc= opening, «+ Nuevo» and opening a document after an import.
// Fictional data; no network (supabase, router, drive and background jobs are mocked).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  truncated: false,
  // SDD-20261106-ux-core-screens-pattern, U-2: a read error to return, and how many times the documents were read.
  error: null as { message: string } | null,
  reads: 0,
  // SDD-20261109-rules-write-permissions (NK-0095), CA-8: the signed-in person per test (undefined = role not loaded yet),
  // and what the screen sends to knowledge_docs.
  me: undefined as unknown,
  writes: [] as { table: string; op: string; payload: unknown }[],
}));
const OWNER = { user: { id: "u1" }, roles: ["owner"], currentOrg: { org_id: "o1" } };

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
                (h.gate ?? Promise.resolve())
                  .then(() => {
                    if (table === "knowledge_docs") h.reads += 1;
                    return {
                      data: table === "knowledge_docs" && !h.error ? h.docs.slice() : [],
                      error: table === "knowledge_docs" ? h.error : null,
                    };
                  })
                  .then(f, r)
            : (...a: unknown[]) => {
                if (p === "update" || p === "insert")
                  h.writes.push({ table, op: p, payload: a[0] });
                return chain(table);
              },
      },
    );
  return { supabase: { from: (t: string) => chain(t) } };
});
// Real fetchAll (so the supabase mock above still controls the read); only «truncated» can be forced.
vi.mock("@/lib/fetch-all", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/fetch-all")>();
  return {
    ...real,
    fetchAll: async (...a: Parameters<typeof real.fetchAll>) => {
      const r = await real.fetchAll(...a);
      return h.truncated ? { ...r, truncated: true } : r;
    },
  };
});
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: h.me }),
}));
vi.mock("@/components/background", () => ({
  useJob: () => ({ running: false, start: vi.fn(), job: null }),
}));
vi.mock("@/components/drive", () => ({
  DriveImportButton: ({
    onImported,
    disabled,
    reason,
  }: {
    onImported: (id: string) => void;
    disabled?: boolean;
    reason?: string;
  }) => (
    <button disabled={disabled} title={reason} onClick={() => onImported(h.importId)}>
      Importar de Drive
    </button>
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
import { errorText } from "@/lib/errors";
import { HUB_SECTIONS } from "@/lib/screen-sections";

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
  h.truncated = false;
  h.error = null;
  h.reads = 0;
  h.me = OWNER;
  h.writes = [];
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

// The search box reads and writes ?q= through useNavigate's search function; this applies it to the current URL search.
const lastSearch = (prev: Record<string, unknown>) => {
  const call = h.navigate.mock.calls.at(-1)?.[0] as {
    search: (p: Record<string, unknown>) => unknown;
    replace?: boolean;
  };
  return { next: call.search(prev), replace: call.replace };
};
const box = () => screen.getByLabelText("Buscar en Conocimiento") as HTMLInputElement;
const type = (v: string) => fireEvent.change(box(), { target: { value: v } });
const count = (label: string) => sectionButton(label).querySelector("span")?.textContent;

describe("HubScreen · búsqueda", () => {
  beforeEach(() => {
    h.docs = [
      row("d1", "company", "Decisión de compra"),
      row("d3", "company", "Precios 2026"),
      row(
        "d4",
        "objections",
        "Es caro",
        "Cuando dicen que es caro, la DECISION se retrasa. Pregunta quién decide.",
      ),
      row("d5", "rules", "Sin relación", "nada"),
    ];
  });

  it("finds across sections without accents or case and names the section of each result (CA-1, CA-3)", async () => {
    mount();
    await screen.findByText("Precios 2026");
    expect(screen.getByPlaceholderText("Buscar en Conocimiento")).toBeInTheDocument();
    type("decision");
    const list = screen.getByTestId("hub-results");
    const items = within(list).getAllByRole("button");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Decisión de compra");
    expect(items[0]).toHaveTextContent("Empresa");
    expect(items[1]).toHaveTextContent("Es caro");
    expect(items[1]).toHaveTextContent("Objeciones y battlecards");
    expect(items[1]).toHaveTextContent(/DECISION se retrasa/);
    expect(within(list).queryByText("Precios 2026")).not.toBeInTheDocument();
  });

  it("every section shows its matches while searching and its total again after clearing (CA-4)", async () => {
    mount();
    await screen.findByText("Precios 2026");
    expect(count("Empresa")).toBe("2");
    expect(count("Objeciones y battlecards")).toBe("1");
    type("decision");
    expect(count("Empresa")).toBe("1");
    expect(count("Objeciones y battlecards")).toBe("1");
    expect(count("Reglas")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(count("Empresa")).toBe("2");
    expect(count("Reglas")).toBe("1");
  });

  it("reflects the text in ?q= keeping the other parameters (CA-6) (debounced)", async () => {
    h.search = { doc: "d1" };
    mount();
    await screen.findByText("Precios 2026");
    h.navigate.mockClear();
    vi.useFakeTimers();
    try {
      type("precio ");
      expect(box().value).toBe("precio ");
      act(() => {
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }
    const { next, replace } = lastSearch({ doc: "d1" });
    expect(next).toEqual({ doc: "d1", q: "precio " });
    expect(replace).toBe(true);
  });

  // NK-0067: typing must not navigate per key (every navigation re-checks the session).
  it("typing 13 characters navigates once after the pause, with the final q (CA-6, NK-0067)", async () => {
    mount();
    await screen.findByText("Precios 2026");
    h.navigate.mockClear();
    vi.useFakeTimers();
    try {
      const word = "descuento max";
      for (let i = 1; i <= word.length; i++) {
        type(word.slice(0, i));
        act(() => {
          vi.advanceTimersByTime(50);
        });
      }
      expect(box().value).toBe(word);
      expect(h.navigate).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(h.navigate).toHaveBeenCalledTimes(1);
      expect(lastSearch({ doc: "d1", seccion: "rules" }).next).toEqual({
        doc: "d1",
        seccion: "rules",
        q: word,
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(h.navigate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Escape writes right away and cancels the pending write (CA-7, NK-0067)", async () => {
    h.search = { doc: "d1", q: "decision" };
    mount();
    await screen.findByText("Es caro");
    h.navigate.mockClear();
    vi.useFakeTimers();
    try {
      type("prec");
      fireEvent.keyDown(box(), { key: "Escape" });
      expect(h.navigate).toHaveBeenCalledTimes(1);
      expect(lastSearch({ doc: "d1", q: "decision" }).next).toEqual({ doc: "d1" });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(h.navigate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a pending write is flushed when changing section and when unmounting (NK-0067)", async () => {
    mount();
    await screen.findByText("Precios 2026");
    h.navigate.mockClear();
    vi.useFakeTimers();
    try {
      type("precio");
      fireEvent.click(sectionButton("Playbooks"));
      expect(h.navigate).toHaveBeenCalledTimes(1);
      expect(lastSearch({}).next).toEqual({ q: "precio", seccion: "playbooks" });
      h.navigate.mockClear();
      type("otra");
      cleanup();
      expect(h.navigate).toHaveBeenCalledTimes(1);
      expect(lastSearch({}).next).toEqual({ q: "otra" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens with the search already applied from ?q= (CA-6)", async () => {
    h.search = { q: "decision" };
    mount();
    expect(await screen.findByText("Es caro")).toBeInTheDocument();
    expect(box().value).toBe("decision");
    expect(count("Empresa")).toBe("1");
  });

  it("Escape and «Borrar búsqueda» empty the box and remove q without touching doc (CA-7)", async () => {
    h.search = { doc: "d1", q: "decision" };
    mount();
    await screen.findByText("Es caro");
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(box().value).toBe("");
    expect(lastSearch({ doc: "d1", q: "decision" }).next).toEqual({ doc: "d1" });
    type("precio");
    h.navigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(box().value).toBe("");
    expect(lastSearch({ doc: "d1", q: "precio" }).next).toEqual({ doc: "d1" });
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).not.toBeInTheDocument();
  });

  it("never says «Nada coincide» while the documents have not answered; says it after (CA-5)", async () => {
    let release: () => void = () => {};
    h.gate = new Promise<void>((r) => {
      release = r;
    });
    h.search = { q: "zzz" };
    mount();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/Nada coincide/)).not.toBeInTheDocument();
    release();
    expect(
      await screen.findByText(
        "Nada coincide con «zzz». Prueba con otra palabra o crea un documento con «+ Nuevo».",
      ),
    ).toBeInTheDocument();
  });

  it("warns when the read was cut and says how many are shown (CA-9)", async () => {
    h.truncated = true;
    mount();
    expect(
      await screen.findByText(
        "Se muestran los primeros 4 documentos; la búsqueda no incluye el resto.",
      ),
    ).toBeInTheDocument();
  });

  it("no warning when the read was complete (CA-9)", async () => {
    mount();
    await screen.findByText("Precios 2026");
    expect(screen.queryByText(/la búsqueda no incluye el resto/)).not.toBeInTheDocument();
  });

  it("the box is hidden on the Drive tab and q stays in the URL (spec §8) (C1 CA-3: writes seccion, keeps q)", async () => {
    h.search = { q: "decision" };
    mount();
    await screen.findByText("Es caro");
    fireEvent.click(screen.getByRole("button", { name: "Drive por cuenta" }));
    expect(screen.queryByLabelText("Buscar en Conocimiento")).not.toBeInTheDocument();
    expect(screen.getByText("panel-drive-por-cuenta")).toBeInTheDocument();
    // B's version asserted «navigate never called»; that was the behaviour before C1 CA-3. The protected property (q stays) holds.
    expect(h.navigate).toHaveBeenCalledTimes(1);
    const { next, replace } = lastSearch({ q: "decision" });
    expect(replace).toBe(true);
    expect(next).toEqual({ q: "decision", seccion: "drive" });
    fireEvent.click(sectionButton("Empresa"));
    expect(box().value).toBe("decision");
  });

  it("«+ Nuevo» and import stay visible while searching and act on the marked section", async () => {
    mount();
    await screen.findByText("Precios 2026");
    fireEvent.click(sectionButton("Objeciones y battlecards"));
    type("decision");
    expect(screen.getByRole("button", { name: "+ Nuevo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar de Drive" })).toBeInTheDocument();
    expect(screen.getByText("Battlecard desde reseñas")).toBeInTheDocument();
    expect(sectionButton("Objeciones y battlecards").className).toContain("bg-primary");
  });

  it("opens a result, and the editor stays open when the text stops matching", async () => {
    mount();
    await screen.findByText("Precios 2026");
    type("decision");
    fireEvent.click(within(screen.getByTestId("hub-results")).getByText("Es caro"));
    expect(screen.getByDisplayValue("Es caro")).toBeInTheDocument();
    type("zzz");
    expect(screen.getByDisplayValue("Es caro")).toBeInTheDocument();
  });

  it("opens a document after an import with the new cache shape (CA-9)", async () => {
    mount();
    await screen.findByText("Precios 2026");
    h.docs = [...h.docs, row("d2", "company", "Importado de Drive")];
    fireEvent.click(screen.getByRole("button", { name: "Importar de Drive" }));
    expect(await screen.findByDisplayValue("Importado de Drive")).toBeInTheDocument();
  });
});

// SDD-20261106-ux-core-screens-pattern, U-2 · CA-1, CA-2, CA-4 on «Conocimiento».
const sectionLabels = [
  "Empresa",
  "Objeciones y battlecards",
  "Playbooks",
  "Metodología",
  "Campañas",
  "Skills",
  "Reglas",
  "Voz",
];
const sectionButtons = () =>
  sectionLabels.map((l) => screen.getByRole("button", { name: new RegExp(`^${l}`) }));

describe("HubScreen · carga, error y vacío (CA-1, CA-2, CA-4)", () => {
  it("while the documents have not answered: loading, no empty text and no number in the counters (CA-1)", async () => {
    let release: () => void = () => {};
    h.gate = new Promise<void>((r) => {
      release = r;
    });
    mount();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.queryByText(/Sin documentos todavía/)).not.toBeInTheDocument();
    for (const b of sectionButtons()) expect(b.textContent).not.toMatch(/\d/);
    release();
    await screen.findByText("Propuesta de valor");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("answered with no documents: the empty text and 0 in every counter (CA-1, CA-4)", async () => {
    h.docs = [];
    mount();
    expect(
      await screen.findByText("Sin documentos todavía. Crea el primero con «+ Nuevo»."),
    ).toBeInTheDocument();
    for (const b of sectionButtons()) expect(b.textContent).toMatch(/0$/);
  });

  it("answered with no match: the search empty text of the search spec, inside the state (CA-4)", async () => {
    h.docs = [];
    h.search = { q: "zzz" };
    mount();
    expect(
      await screen.findByText(
        "Nada coincide con «zzz». Prueba con otra palabra o crea un documento con «+ Nuevo».",
      ),
    ).toBeInTheDocument();
  });

  it("with an error: errorText and «Reintentar», never the empty text nor numbers; retry reads again (CA-2)", async () => {
    h.error = { message: "Failed to fetch" };
    h.search = { q: "zzz" };
    mount();
    expect(await screen.findByText(errorText(new Error("Failed to fetch")))).toBeInTheDocument();
    expect(screen.queryByText(/Sin documentos todavía/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nada coincide/)).not.toBeInTheDocument();
    for (const b of sectionButtons()) expect(b.textContent).not.toMatch(/\d/);
    const before = h.reads;
    h.error = null;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/Nada coincide con «zzz»/)).toBeInTheDocument();
    expect(h.reads).toBeGreaterThan(before);
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("the Drive tab keeps its own panel when the documents fail", async () => {
    h.error = { message: "Failed to fetch" };
    mount();
    await screen.findByRole("button", { name: "Reintentar" });
    fireEvent.click(screen.getByRole("button", { name: "Drive por cuenta" }));
    expect(screen.getByText("panel-drive-por-cuenta")).toBeInTheDocument();
  });
});

// SDD-20261106-ux-core-screens-pattern, U-4 · CA-3: ?seccion= on «Conocimiento».
type Applied = { next: Record<string, unknown>; replace?: boolean };
const applyLast = (prev: Record<string, unknown>): Applied => {
  const call = h.navigate.mock.calls.at(-1)?.[0] as {
    search: (p: Record<string, unknown>) => Record<string, unknown>;
    replace?: boolean;
  };
  return { next: call.search(prev), replace: call.replace };
};
const selected = () =>
  sectionLabels.concat("Drive por cuenta").filter((l) => {
    const b = screen.getByRole("button", { name: new RegExp(`^${l}`) });
    return b.className.includes("bg-primary");
  });

describe("HubScreen · ?seccion= (CA-3)", () => {
  it("every section of the screen has its id in screen-sections", () => {
    expect([...HUB_SECTIONS]).toEqual([
      "company",
      "objections",
      "playbooks",
      "methodology",
      "campaigns",
      "skills",
      "rules",
      "voice",
      "drive",
    ]);
  });

  it("opens the section named by seccion", async () => {
    h.search = { seccion: "objections" };
    mount();
    expect(await screen.findByText("Es caro")).toBeInTheDocument();
    expect(screen.queryByText("Propuesta de valor")).not.toBeInTheDocument();
    expect(selected()).toEqual(["Objeciones y battlecards"]);
  });

  it("opens Drive por cuenta with seccion=drive", async () => {
    h.search = { seccion: "drive" };
    mount();
    expect(await screen.findByText("panel-drive-por-cuenta")).toBeInTheDocument();
  });

  it("an unknown id or none opens Empresa", async () => {
    h.search = { seccion: "nope" };
    mount();
    expect(await screen.findByText("Propuesta de valor")).toBeInTheDocument();
    expect(selected()).toEqual(["Empresa"]);
  });

  it("?doc= of another section rewrites seccion, keeping doc, with replace", async () => {
    h.search = { doc: "d4", seccion: "company" };
    mount();
    expect(await screen.findByDisplayValue("Es caro")).toBeInTheDocument();
    expect(selected()).toEqual(["Objeciones y battlecards"]);
    const { next, replace } = applyLast({ doc: "d4", seccion: "company" });
    expect(next).toEqual({ doc: "d4", seccion: "objections" });
    expect(replace).toBe(true);
  });

  it("?doc= of a document that is not in the list is ignored and seccion rules", async () => {
    h.search = { doc: "borrado", seccion: "rules" };
    mount();
    await screen.findByText(/Sin documentos todavía/);
    expect(selected()).toEqual(["Reglas"]);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("?doc= in the section already shown does not touch the URL", async () => {
    h.search = { doc: "d1" };
    mount();
    expect(await screen.findByDisplayValue("Propuesta de valor")).toBeInTheDocument();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("changing section by hand: replace, doc out, q kept, seccion set", async () => {
    h.search = { doc: "d1", q: "caro", seccion: "objections" };
    mount();
    await screen.findByText("Es caro");
    h.navigate.mockClear();
    fireEvent.click(sectionButton("Playbooks"));
    const a = applyLast({ doc: "d1", q: "caro", seccion: "objections" });
    expect(a.replace).toBe(true);
    expect(a.next).toEqual({ q: "caro", seccion: "playbooks" });
    fireEvent.click(sectionButton("Empresa"));
    expect(applyLast({ doc: "d1", q: "caro", seccion: "playbooks" }).next).toEqual({
      q: "caro",
    });
    fireEvent.click(screen.getByRole("button", { name: "Drive por cuenta" }));
    expect(applyLast({ q: "caro" }).next).toEqual({ q: "caro", seccion: "drive" });
  });

  it("after ?doc= opens a document and the person changes section, the URL keeps the chosen section and no doc", async () => {
    h.search = { doc: "d4" };
    mount();
    await screen.findByDisplayValue("Es caro");
    h.navigate.mockClear();
    fireEvent.click(sectionButton("Reglas"));
    expect(selected()).toEqual(["Reglas"]);
    expect(applyLast({ doc: "d4", seccion: "objections" }).next).toEqual({ seccion: "rules" });
  });
});

// SDD-20261106-agent-rules-reader (NK-0069), U-4 · CA-6 (pantalla): Conocimiento › Reglas says the agent reads the rules and
// how many enter complete, counted from data.rows with the reader's own function; the «obligatorio» box names the agent.
describe("HubScreen · Reglas que lee el agente (CA-6)", () => {
  const LEE =
    "El agente lee estas reglas en cada conversación y al redactar seguimientos y briefs de reunión.";
  const BOX =
    "El agente lo lee en cada conversación y al redactar seguimientos y preparaciones de reunión, y el Ciclo GTM en sus documentos.";
  const rules = (n: number) =>
    Array.from({ length: n }, (_, i) => row(`r${i + 1}`, "rules", `Regla ${i + 1}`));

  it("the Reglas section says the agent reads them, and no warning when every rule enters", async () => {
    h.search = { seccion: "rules" };
    h.docs = rules(3);
    mount();
    await screen.findByText("Regla 1");
    expect(screen.getByText(new RegExp(LEE.replace(/[.()]/g, "\\$&")))).toBeInTheDocument();
    expect(screen.queryByText(/El agente lee \d+ de \d+/)).not.toBeInTheDocument();
  });

  it("L < N: counts only team rules with text, marked ones of other sections included", async () => {
    h.search = { seccion: "rules" };
    h.docs = [
      ...rules(13),
      { ...row("m1", "company", "Marcada"), mandatory: true },
      { ...row("p1", "rules", "Personal"), scope: "personal" },
      row("e1", "rules", "Vacía", "   "),
    ];
    mount();
    expect(
      await screen.findByText(
        "El agente lee 12 de 14 reglas completas (las más recientes). Junta o acorta las que puedas.",
      ),
    ).toBeInTheDocument();
  });

  it("a rule cut by the character limit does not count as read", async () => {
    h.search = { seccion: "rules" };
    h.docs = [row("r1", "rules", "Corta"), row("r2", "rules", "Larga", "x".repeat(13_000))];
    mount();
    expect(
      await screen.findByText(
        "El agente lee 1 de 2 reglas completas (las más recientes). Junta o acorta las que puedas.",
      ),
    ).toBeInTheDocument();
  });

  it("truncated: no «L de N», says more rules may exist", async () => {
    h.search = { seccion: "rules" };
    h.docs = rules(14);
    h.truncated = true;
    mount();
    expect(
      await screen.findByText("Puede haber más reglas de las que se han cargado."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/El agente lee \d+ de \d+/)).not.toBeInTheDocument();
  });

  it("no count before the documents answer", async () => {
    let release: () => void = () => {};
    h.gate = new Promise<void>((r) => {
      release = r;
    });
    h.search = { seccion: "rules" };
    h.docs = rules(14);
    mount();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/El agente lee \d+ de \d+/)).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(/El agente lee 12 de 14/)).toBeInTheDocument();
  });

  it("the «De obligado cumplimiento» box names the agent, in both branches, within 135 characters", async () => {
    expect(BOX.length).toBeLessThanOrEqual(135);
    h.docs = [row("d1", "company", "Propuesta de valor"), row("r1", "rules", "Regla 1")];
    h.search = { doc: "d1" };
    mount();
    await screen.findByDisplayValue("Propuesta de valor");
    expect(screen.getByText(BOX)).toBeInTheDocument();
    cleanup();
    h.search = { doc: "r1" };
    mount();
    await screen.findByDisplayValue("Regla 1");
    expect(
      screen.getByText(
        "Todo lo de Reglas lo es: el agente lo lee en cada conversación y al redactar seguimientos y preparaciones de reunión, y el Ciclo GTM en sus documentos.",
      ),
    ).toBeInTheDocument();
  });
});

// SDD-20261109-rules-write-permissions (NK-0095) U-5 · CA-8: only the Owner or a Sales Leader write Reglas and mark documents as
// mandatory; the rest see the actions disabled with the reason, never hidden.
describe("HubScreen · quién escribe reglas y obligatorios (NK-0095, CA-8)", () => {
  const SECTION_RO = "Solo el Owner o un Sales Leader pueden escribir reglas.";
  const DOC_RO =
    "Solo lectura: las reglas y los documentos obligatorios los escriben el Owner o un Sales Leader.";
  const MARK = "Solo el Owner o un Sales Leader pueden marcarlo como obligatorio.";
  const as = (role: string | null) => {
    h.me = role ? { ...OWNER, roles: [role] } : undefined;
  };
  const docs = () => [
    row("d1", "company", "Propuesta de valor"),
    { ...row("m1", "company", "Precios obligatorios"), mandatory: true },
    row("r1", "rules", "Regla 1"),
  ];
  const newButton = () => screen.getByRole("button", { name: "+ Nuevo" });
  const importButton = () => screen.getByRole("button", { name: "Importar de Drive" });
  const save = () => screen.getByRole("button", { name: "Guardar" });
  const box = () => screen.getByRole("checkbox");
  const openDoc = async (id: string, title: string) => {
    h.docs = docs();
    h.search = { doc: id };
    mount();
    await screen.findByDisplayValue(title);
  };

  it("ae in Reglas: «+ Nuevo» and «Importar de Drive» disabled, with the reason below the description", async () => {
    as("ae");
    h.docs = docs();
    h.search = { seccion: "rules" };
    mount();
    await screen.findByText("Regla 1");
    expect(newButton()).toBeDisabled();
    expect(importButton()).toBeDisabled();
    expect(importButton()).toHaveAttribute("title", SECTION_RO);
    expect(screen.getByText(SECTION_RO)).toBeInTheDocument();
  });

  it.each([
    ["a team rule", "r1", "Regla 1"],
    ["a team document marked mandatory", "m1", "Precios obligatorios"],
  ])(
    "ae opening %s: title and text read-only, «Guardar» disabled, reason shown",
    async (_n, id, title) => {
      as("ae");
      await openDoc(id, title);
      expect(screen.getByDisplayValue(title)).toHaveAttribute("readonly");
      expect(screen.getByDisplayValue("Texto de prueba.")).toHaveAttribute("readonly");
      expect(save()).toBeDisabled();
      expect(screen.getByText(DOC_RO)).toBeInTheDocument();
      expect(box()).toBeDisabled();
    },
  );

  it("ae on a team document that is not binding: edits, the box is disabled with its own reason, and saves mandatory: false", async () => {
    as("ae");
    await openDoc("d1", "Propuesta de valor");
    expect(box()).toBeDisabled();
    expect(screen.getByText(MARK)).toBeInTheDocument();
    expect(screen.queryByText(DOC_RO)).not.toBeInTheDocument();
    const body = screen.getByDisplayValue("Texto de prueba.");
    expect(body).not.toHaveAttribute("readonly");
    fireEvent.change(body, { target: { value: "Texto cambiado." } });
    expect(save()).toBeEnabled();
    fireEvent.click(save());
    await waitFor(() => expect(h.writes.length).toBe(1));
    expect(h.writes[0]).toMatchObject({
      table: "knowledge_docs",
      op: "update",
      payload: { body: "Texto cambiado.", mandatory: false },
    });
  });

  it.each(["owner", "sales_leader"])("%s: everything active as before", async (role) => {
    as(role);
    h.docs = docs();
    h.search = { seccion: "rules" };
    mount();
    await screen.findByText("Regla 1");
    expect(newButton()).toBeEnabled();
    expect(importButton()).toBeEnabled();
    expect(importButton()).not.toHaveAttribute("title");
    expect(screen.queryByText(SECTION_RO)).not.toBeInTheDocument();
    cleanup();
    await openDoc("r1", "Regla 1");
    expect(screen.getByDisplayValue("Regla 1")).not.toHaveAttribute("readonly");
    expect(save()).toBeEnabled();
    expect(screen.queryByText(DOC_RO)).not.toBeInTheDocument();
    cleanup();
    await openDoc("d1", "Propuesta de valor");
    expect(box()).toBeEnabled();
    expect(screen.queryByText(MARK)).not.toBeInTheDocument();
    fireEvent.click(box());
    fireEvent.click(save());
    await waitFor(() => expect(h.writes.length).toBe(1));
    expect(h.writes[0]!.payload).toMatchObject({ mandatory: true });
  });

  it("while the role has not loaded, everything binding is disabled", async () => {
    as(null);
    h.docs = docs();
    h.search = { seccion: "rules" };
    mount();
    await screen.findByText("Regla 1");
    expect(newButton()).toBeDisabled();
    expect(importButton()).toBeDisabled();
    cleanup();
    await openDoc("r1", "Regla 1");
    expect(screen.getByDisplayValue("Regla 1")).toHaveAttribute("readonly");
    expect(save()).toBeDisabled();
    cleanup();
    await openDoc("d1", "Propuesta de valor");
    expect(box()).toBeDisabled();
  });

  it("other sections stay open to every role", async () => {
    as("ae");
    h.docs = docs();
    mount();
    await screen.findByText("Propuesta de valor");
    expect(newButton()).toBeEnabled();
    expect(importButton()).toBeEnabled();
  });
});

// NK-0101: «+ Nuevo» and «Importar de Drive» are not offered while the documents failed to load.
describe("HubScreen · sin crear ni importar con el error de lectura (NK-0101, CA-3)", () => {
  const newBtn = () => screen.queryByRole("button", { name: "+ Nuevo" });
  const importBtn = () => screen.queryByRole("button", { name: "Importar de Drive" });

  it("with an error: neither button, in any role; «Reintentar» stays", async () => {
    for (const roles of [["owner"], ["ae"]]) {
      h.me = { ...OWNER, roles };
      h.error = { message: "Failed to fetch" };
      mount();
      await screen.findByRole("button", { name: "Reintentar" });
      expect(newBtn()).not.toBeInTheDocument();
      expect(importBtn()).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("with the error in Reglas the buttons are gone too, and they return after a retry", async () => {
    h.error = { message: "Failed to fetch" };
    h.search = { seccion: "rules" };
    mount();
    await screen.findByRole("button", { name: "Reintentar" });
    expect(newBtn()).not.toBeInTheDocument();
    expect(importBtn()).not.toBeInTheDocument();
    h.error = null;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "+ Nuevo" })).toBeInTheDocument();
    expect(importBtn()).toBeInTheDocument();
  });

  it("while loading and with data they are shown as before", async () => {
    let release: () => void = () => {};
    h.gate = new Promise<void>((r) => {
      release = r;
    });
    mount();
    await screen.findByRole("status");
    expect(newBtn()).toBeInTheDocument();
    expect(importBtn()).toBeInTheDocument();
    release();
    await screen.findByText("Propuesta de valor");
    expect(newBtn()).toBeInTheDocument();
    expect(importBtn()).toBeInTheDocument();
  });
});

// NK-0100 walkthrough: a blank search never stays in the box (no spaces, no «Borrar búsqueda»).
describe("HubScreen · buscador en blanco (NK-0100)", () => {
  it("opens with an empty box when the URL q is only spaces", async () => {
    h.search = { q: "   " };
    mount();
    await screen.findByText("Propuesta de valor");
    expect(box().value).toBe("");
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).not.toBeInTheDocument();
  });

  it("empties the box once typed spaces are written (cleaned) to the URL", async () => {
    mount();
    await screen.findByText("Propuesta de valor");
    vi.useFakeTimers();
    try {
      type("   ");
      act(() => {
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(box().value).toBe("");
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).not.toBeInTheDocument();
  });
});

// SDD-20261110-company-voice-and-escalation-rules (NK-0128) U-1 · CA-1, CA-2: the «Voz» section. Only the Owner or a Sales
// Leader write it; a voice document is never mandatory, so the box is not offered there. Fictional texts.
describe("HubScreen · sección Voz (NK-0128, CA-1, CA-2)", () => {
  const HINT =
    "Pega tres mensajes reales que hayáis escrito y que representen cómo habláis. Quita nombres y datos de personas antes de pegar.";
  const VOICE_RO =
    "Solo el Owner o un Sales Leader pueden escribir la voz de la empresa. Pídeselo a uno de ellos.";
  const as = (role: string | null) => {
    h.me = role ? { ...OWNER, roles: [role] } : undefined;
  };
  const voiceDocs = () => [
    row("v1", "voice", "Mensaje de ejemplo 1", "Hola, gracias por tu tiempo."),
    { ...row("v2", "voice", "Marcado por error"), mandatory: true },
  ];
  const newButton = () => screen.getByRole("button", { name: "+ Nuevo" });
  const save = () => screen.getByRole("button", { name: "Guardar" });

  it("the section exists, is named Voz and shows the privacy hint", async () => {
    h.docs = voiceDocs();
    h.search = { seccion: "voice" };
    mount();
    await screen.findByText("Mensaje de ejemplo 1");
    expect(selected()).toEqual(["Voz"]);
    expect(screen.getByText(HINT)).toBeInTheDocument();
    expect(within(sectionButton("Voz")).getByText("2")).toBeInTheDocument();
  });

  it("a voice document does not show the «obligatorio» badge, even when marked", async () => {
    h.docs = voiceDocs();
    h.search = { seccion: "voice" };
    mount();
    await screen.findByText("Marcado por error");
    expect(screen.queryByText("obligatorio")).not.toBeInTheDocument();
  });

  it("ae: «+ Nuevo» disabled with the reason in words, no Drive import offered", async () => {
    as("ae");
    h.docs = voiceDocs();
    h.search = { seccion: "voice" };
    mount();
    await screen.findByText("Mensaje de ejemplo 1");
    expect(newButton()).toBeDisabled();
    expect(screen.getByText(VOICE_RO)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar de Drive" })).not.toBeInTheDocument();
  });

  it("ae opening a voice document: read-only, «Guardar» disabled, reason shown, no mandatory box", async () => {
    as("ae");
    h.docs = voiceDocs();
    h.search = { doc: "v1" };
    mount();
    await screen.findByDisplayValue("Mensaje de ejemplo 1");
    expect(screen.getByDisplayValue("Mensaje de ejemplo 1")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("Hola, gracias por tu tiempo.")).toHaveAttribute("readonly");
    expect(save()).toBeDisabled();
    expect(screen.getAllByText(VOICE_RO).length).toBeGreaterThan(0);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it.each(["owner", "sales_leader"])(
    "%s: creates and edits voice, no mandatory box, and saves mandatory: false even if it came marked",
    async (role) => {
      as(role);
      h.docs = voiceDocs();
      h.search = { doc: "v2" };
      mount();
      await screen.findByDisplayValue("Marcado por error");
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.queryByText(VOICE_RO)).not.toBeInTheDocument();
      const body = screen.getByDisplayValue("Texto de prueba.");
      expect(body).not.toHaveAttribute("readonly");
      fireEvent.change(body, { target: { value: "Otro texto ficticio." } });
      fireEvent.click(save());
      await waitFor(() => expect(h.writes.length).toBe(1));
      expect(h.writes[0]!.payload).toMatchObject({
        body: "Otro texto ficticio.",
        mandatory: false,
      });
      cleanup();
      h.writes = [];
      h.search = { seccion: "voice" };
      mount();
      await screen.findByText("Mensaje de ejemplo 1");
      expect(newButton()).toBeEnabled();
    },
  );

  it("while the role has not loaded, a voice document is read-only and «+ Nuevo» disabled", async () => {
    as(null);
    h.docs = voiceDocs();
    h.search = { seccion: "voice" };
    mount();
    await screen.findByText("Mensaje de ejemplo 1");
    expect(newButton()).toBeDisabled();
  });
});
