// SDD-20261106-ux-metrics-data-state · U-1 · CA-3: in Theory U the method texts of «Escucha» (X-9, without the hint),
// «Clínica de casos» (X-10) and «Prototipos» (X-11) are folded behind «Más sobre esto» and appear unchanged when
// opened; the hint of «Escucha» (link to /accounts) stays in view; the journey empty text (X-12) is never folded.
// Fictional data, no network.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const chain = (): object =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === "then"
            ? (f: (v: unknown) => unknown) =>
                Promise.resolve({ data: [], count: 0, error: null }).then(f)
            : () => chain(),
      },
    );
  return { supabase: { from: () => chain() } };
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
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

import { Listening } from "@/components/theory-u/listening";
import { CaseClinics } from "@/components/theory-u/case-clinic";
import { Prototypes } from "@/components/theory-u/prototypes";
import { UJourney } from "@/components/theory-u/journey";

afterEach(cleanup);
const mount = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );
const text = (c: HTMLElement) => (c.textContent ?? "").replace(/\s+/g, " ");
const BUTTON = "Más sobre esto";

function expectFolded(c: HTMLElement, start: string, full: string) {
  expect(text(c), `«${start}» hidden`).not.toContain(start);
  const button = within(c).getByRole("button", { name: BUTTON });
  expect(button.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(button.textContent).toBe("Ocultar");
  expect(text(c)).toContain(full);
}

describe("Theory U method texts are folded (CA-3)", () => {
  it("X-9 Escucha: Scharmer folds, the hint with its link to /accounts stays", () => {
    const { container } = mount(<Listening />);
    const link = within(container).getByRole("link", { name: "cada cuenta" });
    expect(link.getAttribute("href")).toBe("/accounts");
    expect(text(link.parentElement as HTMLElement)).toContain(
      "Valora tu nivel después de cada reunión",
    );
    expectFolded(
      container,
      "Según Scharmer",
      "Según Scharmer, la calidad de los resultados depende de la calidad de la atención. En ventas, pasar de la descarga a la escucha empática o generativa es lo que convierte un pitch en una conversación que el cliente recuerda.",
    );
    expect(link.isConnected).toBe(true);
  });

  it("X-10 Clínica de casos", () => {
    const { container } = mount(<CaseClinics />);
    expectFolded(
      container,
      "Coaching entre pares",
      "Coaching entre pares de Theory U (~45 min). Un vendedor (case giver) trae un deal atascado o un reto propio; 3–4 compañeros escuchan, guardan silencio y devuelven espejos antes de dialogar. No se dan consejos de manual: se buscan nuevas formas de ver la situación.",
    );
  });

  it("X-11 Prototipos", () => {
    const { container } = mount(<Prototypes />);
    expectFolded(
      container,
      "Co-crear en Theory U",
      "Co-crear en Theory U es explorar el futuro haciendo: prototipos pequeños, feedback temprano y aprender rápido en vez de planificar de más. Lo que funciona pasa a los playbooks y a la estrategia.",
    );
  });

  it("X-12 the journey empty text is not folded", async () => {
    const { container } = mount(<UJourney />);
    expect(await screen.findByText(/Un recorrido U guía al equipo por 5 movimientos/)).toBeTruthy();
    expect(within(container).queryByRole("button", { name: BUTTON })).toBeNull();
  });
});
