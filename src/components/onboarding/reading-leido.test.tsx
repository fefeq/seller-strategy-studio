// NK-0156 CA-1 to CA-4 and CA-7 to CA-11: what the reading screen says about its state and each source. The real step
// with a fictitious job and fictitious findings; the database is replaced.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "@/lib/onboarding";

const state = vi.hoisted(() => ({
  job: { status: "done", step: null, error: null } as {
    status: string;
    step: string | null;
    error: string | null;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.job }) }) }),
    }),
  },
}));
vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({ data: { roles: ["owner"], user: { id: "user-ana" } } }),
}));
vi.mock("@/components/confirm-dialog", () => ({
  askConfirm: vi.fn(),
  askText: vi.fn(),
  askUnsaved: vi.fn(),
}));

import { askUnsaved } from "@/components/confirm-dialog";
import { ReadingStep } from "./reading";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const AT = "2026-11-12T10:00:00Z";
const finding = (text: string, source: string | null, extra: Partial<Finding> = {}): Finding => ({
  at: AT,
  text,
  source,
  ...extra,
});

function showWith(
  findings: Finding[],
  sources: string[],
  status: string,
  opts: { step?: string | null; error?: string | null } = {},
) {
  state.job = { status, step: opts.step ?? null, error: opts.error ?? null };
  const client = new QueryClient();
  const ui = (fs: Finding[]) => (
    <QueryClientProvider client={client}>
      <ReadingStep
        jobId="job-1"
        findings={fs}
        sources={sources}
        onNext={() => {}}
        onBack={() => {}}
        onSkip={() => {}}
        onChange={async () => {}}
      />
    </QueryClientProvider>
  );
  const r = render(ui(findings));
  return { ...r, update: (fs: Finding[]) => r.rerender(ui(fs)) };
}

// Waits for the job to load using elements that exist in every version of the screen.
const whenDone = () => screen.findByRole("button", { name: "Seguir a tu diagnóstico" });
const whenEnded = () => screen.findByRole("button", { name: "Volver a tus fuentes" });
const headline = () => screen.getByTestId("reading-headline");
const sourceList = () => screen.getByRole("list", { name: "Fuentes" });
const rows = () => within(sourceList()).getAllByRole("listitem");
const statuses = () => within(sourceList()).getAllByTestId("source-status");
const findingsList = () => document.querySelector("ol") as HTMLElement;
const HELP =
  "Cada línea es algo que encontré; si sale de una fuente, la verás al final. Confírmalo, edítalo o descártalo.";
const NO_OWN = "No atribuí ningún hallazgo a esta fuente por separado.";
const WEB_HINT = "No cuento por separado los hallazgos de una web; búscalos en la lista.";

describe("ReadingStep: the state in words (NK-0156)", () => {
  it("the header says what happened when done", async () => {
    showWith(
      [finding("Leído: plan.md", "plan.md"), finding("Categoría: CRM", "a.md")],
      ["plan.md", "a.md", "Web · https://ejemplo.test"],
      "done",
    );
    await whenDone();
    expect(headline().textContent).toBe("Lectura terminada");
    expect(headline().textContent).not.toMatch(/leído/i);
    for (const s of statuses()) expect(s.textContent).not.toMatch(/leído/i);
    expect(within(findingsList()).getByText("Leído: plan.md")).toBeTruthy();
  });

  it("failed and cancelled headers; no claim of access", async () => {
    const findings = [finding("Sin acceso a la web: ejemplo.test", null)];
    const sources = ["a.md", "Web · https://ejemplo.test"];
    for (const [status, text] of [
      ["failed", "No pude terminar la lectura"],
      ["cancelled", "Se canceló la lectura"],
    ] as const) {
      showWith(findings, sources, status, { error: status === "failed" ? "x" : null });
      await whenEnded();
      expect(headline().textContent).toBe(text);
      for (const s of statuses()) {
        expect(s.textContent).toBe("Sin terminar");
        expect(s.textContent).not.toMatch(/sin acceso/i);
      }
      expect(headline().textContent).not.toMatch(/sin acceso/i);
      expect(within(findingsList()).getByText("Sin acceso a la web: ejemplo.test")).toBeTruthy();
      cleanup();
    }
    // cancelled, error null: the header once, no fallback paragraph
    showWith([], sources, "cancelled");
    await whenEnded();
    expect(screen.getAllByText("Se canceló la lectura")).toHaveLength(1);
    expect(screen.queryByText("La lectura se canceló.")).toBeNull();
    cleanup();
    // failed, error null: no fallback paragraph at all
    const { container } = showWith([], sources, "failed");
    await whenEnded();
    expect(screen.queryByText("La lectura se canceló.")).toBeNull();
    expect(container.querySelector(".text-destructive")).toBeNull();
    cleanup();
    // failed with an error: that text is shown
    showWith([], sources, "failed", { error: "La web no responde." });
    await whenEnded();
    expect(screen.getByText("La web no responde.")).toBeTruthy();
  });

  it("running header with and without step", async () => {
    for (const step of [
      "Mercado y competidores",
      "Proponiendo tu estrategia",
      "Debate de los C-Levels",
    ]) {
      showWith([], ["a.md"], "running", { step });
      expect((await screen.findByText(`Estoy leyendo · ${step}`)).getAttribute("data-testid")).toBe(
        "reading-headline",
      );
      cleanup();
    }
    for (const step of ["Leyendo tu web", "leí tu web"]) {
      showWith([], ["a.md"], "running", { step });
      expect((await screen.findByText("Estoy leyendo")).getAttribute("data-testid")).toBe(
        "reading-headline",
      );
      expect(headline().textContent).not.toMatch(/tu web/i);
      cleanup();
    }
    showWith([], ["a.md"], "running", { step: null });
    expect(
      (await screen.findByText("Estoy leyendo · esperando turno")).getAttribute("data-testid"),
    ).toBe("reading-headline");
  });

  it("help sentence, no strategy claim", async () => {
    showWith([finding("Uno", "a.md")], ["a.md"], "done");
    await whenDone();
    const help = screen.getByText(HELP);
    expect(help.textContent).not.toMatch(/estrategia/i);
    expect(help.textContent).not.toMatch(/todas/i);
    expect(help.textContent).not.toMatch(/leíd|leyó|leí\b/i);
    cleanup();
    for (const status of ["failed", "cancelled"]) {
      showWith([finding("Uno", "a.md")], ["a.md"], status);
      await whenEnded();
      expect(screen.queryByText(HELP)).toBeNull();
      cleanup();
    }
    showWith([finding("Uno", "a.md")], ["a.md"], "running", { step: "Mercado y competidores" });
    await screen.findByText("Estoy leyendo · Mercado y competidores");
    expect(screen.queryByText(HELP)).toBeNull();
  });
});

describe("ReadingStep: counts per source (NK-0156)", () => {
  const sources = [
    "a.md",
    "plan.md",
    "vacio.md",
    "Web · https://acme.test",
    "Web · https://acme.test/precios",
    "Web · https://www.linkedin.com/company/ejemplo",
  ];
  const findings = [
    finding("Uno", "a.md"),
    finding("Dos", "a.md"),
    finding("Tres", "plan.md"),
    finding("Cuatro", "Web · acme.test"),
    finding("Cinco", "Tus fuentes"),
  ];

  it("per-source count wording; web has no count", async () => {
    showWith(findings, sources, "done");
    await whenDone();
    const s = statuses();
    expect(s.map((x) => x.textContent)).toEqual([
      "2 hallazgos",
      "1 hallazgo",
      "Sin hallazgos propios",
      "Sin recuento para webs",
      "Sin recuento para webs",
      "Sin recuento para webs",
    ]);
    for (const x of s) expect(x.textContent).not.toMatch(/\b0 hallazgos/);
    for (const x of s.slice(3)) expect(x.textContent).not.toMatch(/\d|propios/);
    const hints = rows().map((r) => within(r).queryByTestId("source-hint")?.textContent ?? null);
    expect(hints).toEqual([null, null, NO_OWN, WEB_HINT, WEB_HINT, WEB_HINT]);
  });

  it("count matches the remove dialog and follows discards", async () => {
    vi.mocked(askUnsaved).mockResolvedValue("stay");
    const two = [finding("Uno", "a.md"), finding("Dos", "a.md")];
    const view = showWith(two, ["a.md"], "done");
    await whenDone();
    expect(within(statuses()[0]!).getByText("2 hallazgos")).toBeTruthy();
    fireEvent.click(within(rows()[0]!).getByRole("button", { name: "Quitar" }));
    expect(askUnsaved).toHaveBeenCalledTimes(1);
    const opts = vi.mocked(askUnsaved).mock.calls[0]![1] as { body: string };
    expect(opts.body.startsWith("2 hallazgos vienen")).toBe(true);
    view.update([finding("Uno", "a.md", { discardedAt: AT }), finding("Dos", "a.md")]);
    expect(within(statuses()[0]!).getByText("1 hallazgo")).toBeTruthy();
  });

  it("expanding a source lists only its live findings", async () => {
    showWith(
      [
        finding("Uno", "a.md"),
        finding("Dos", "a.md"),
        finding("Tres", "plan.md"),
        finding("Cuatro", "a.md", { discardedAt: AT }),
      ],
      ["a.md", "plan.md", "vacio.md", "Web · https://acme.test"],
      "done",
    );
    await whenDone();
    const row = () => rows()[0]!;
    const button = () => within(row()).getByRole("button", { name: "2 hallazgos · a.md" });
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(within(row()).queryByTestId("source-findings")).toBeNull();
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    const panel = within(row()).getByTestId("source-findings");
    expect(within(panel).getByText("Uno")).toBeTruthy();
    expect(within(panel).getByText("Dos")).toBeTruthy();
    expect(within(panel).queryByText("Tres")).toBeNull();
    expect(within(panel).queryByText("Cuatro")).toBeNull();
    expect(panel.id).toBeTruthy();
    expect(button().getAttribute("aria-controls")).toBe(panel.id);
    expect(button().id).toBeTruthy();
    expect(button().classList.contains("min-h-11")).toBe(true);
    expect(button().classList.contains("min-w-11")).toBe(true);
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(within(row()).queryByTestId("source-findings")).toBeNull();
    // no button when there is no count to open
    for (const i of [2, 3]) {
      expect(within(rows()[i]!).queryByRole("button", { name: /hallazgo/ })).toBeNull();
    }
  });

  it("expanded list follows the live findings", async () => {
    const view = showWith([finding("Uno", "a.md"), finding("Dos", "a.md")], ["a.md"], "done");
    await whenDone();
    fireEvent.click(within(rows()[0]!).getByRole("button", { name: "2 hallazgos · a.md" }));
    const panel = () => within(rows()[0]!).getByTestId("source-findings");
    view.update([finding("Uno editado", "a.md", { edited: true }), finding("Dos", "a.md")]);
    expect(within(panel()).getByText("Uno editado")).toBeTruthy();
    expect(within(panel()).queryByText("Uno")).toBeNull();
    expect(within(findingsList()).getByText("Uno editado")).toBeTruthy();
    view.update([
      finding("Uno editado", "a.md", { edited: true }),
      finding("Dos", "a.md", { discardedAt: AT }),
    ]);
    expect(within(panel()).queryByText("Dos")).toBeNull();
    expect(within(panel()).getByText("Uno editado")).toBeTruthy();
  });

  it("no counts while running or failed; done shows them", async () => {
    const data = [finding("Uno", "a.md")];
    showWith(data, ["a.md"], "done");
    await whenDone();
    expect(within(statuses()[0]!).getByText("1 hallazgo")).toBeTruthy();
    cleanup();
    showWith(data, ["a.md"], "running", { step: "Mercado y competidores" });
    await screen.findByText("Estoy leyendo · Mercado y competidores");
    expect(statuses()[0]!.textContent).toBe("leyendo");
    expect(screen.queryByText(/\d+ hallazgos?\b/)).toBeNull();
    expect(screen.queryByRole("button", { name: /hallazgo/ })).toBeNull();
    cleanup();
    showWith(data, ["a.md"], "failed", { error: "La web no responde." });
    await whenEnded();
    expect(statuses()[0]!.textContent).toBe("Sin terminar");
    expect(screen.queryByText(/\d+ hallazgos?\b/)).toBeNull();
    expect(screen.queryByRole("button", { name: /hallazgo/ })).toBeNull();
  });
});
