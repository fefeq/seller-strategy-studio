// SDD-20261110-play-teams U-3 (CA-7, CA-8, CA-9): the «Equipos de plays» view. Fictional data; no network (supabase, the server
// function, the play states and the toast are mocked, as in plays-panel.test.tsx).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rows: [] as { play_id: string; enabled: boolean }[],
  toggle: vi.fn(),
}));

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
vi.mock("@/lib/plays.functions", () => ({ setPlayEnabled: h.toggle }));
vi.mock("@/components/plays/use-play-states", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/plays/use-play-states")>()),
  usePlayStates: () => ({ data: h.rows }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(
    vi.fn(() => "t"),
    { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
  ),
}));

import { PlayTeamsPanel } from "./play-teams-panel";
import { PLAY_STATES_KEY } from "./use-play-states";
import { CATALOG } from "@/lib/plays/catalog";
import { checkToggle } from "@/lib/plays/status";
import { PLAY_TEAMS, TEAMS_INTRO, summaryWord, teamPlan } from "@/lib/plays/teams";

const title = (id: string) => CATALOG.find((p) => p.id === id)!.title;
const SIGNALS = "signals-in-crm-with-decay";
const PAIN = CATALOG.find((p) => p.id === "pain-qualified-segments")!;

function mount(roles: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <PlayTeamsPanel roles={roles} />
    </QueryClientProvider>,
  );
  return { invalidate };
}
const section = (teamTitle: string) =>
  within(screen.getByRole("heading", { level: 2, name: teamTitle }).closest("section")!);
const card = (teamTitle: string, playTitle: string) =>
  within(section(teamTitle).getByText(playTitle).closest("li")!);

beforeEach(() => {
  h.rows = [];
  h.toggle.mockReset();
});
afterEach(cleanup);

describe("PlayTeamsPanel draws the six teams (CA-7, G-1)", () => {
  it("shows the intro and the teams in the order of PLAY_TEAMS, each with title, task and summary in words", () => {
    mount(["owner"]);
    expect(screen.getByText(TEAMS_INTRO)).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 }).map((x) => x.textContent)).toEqual(
      PLAY_TEAMS.map((t) => t.title),
    );
    for (const t of PLAY_TEAMS) {
      const s = section(t.title);
      expect(s.getByText(t.task)).toBeTruthy();
      expect(s.getByText(summaryWord(teamPlan(t).summary))).toBeTruthy();
    }
  });

  it("numbers the steps «Paso 1», «Paso 2»… in the expected order", () => {
    mount(["owner"]);
    const s = section("Reuniones");
    const items = s.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Paso 1")).toBeTruthy();
    expect(within(items[0]!).getByText(title("meeting-form-orchestration"))).toBeTruthy();
    expect(within(items[1]!).getByText("Paso 2")).toBeTruthy();
    expect(within(items[1]!).getByText(title("meeting-prep-and-follow-up"))).toBeTruthy();
    expect(
      within(section("Entrantes y producto").getAllByRole("listitem")[2]!).getByText("Paso 3"),
    ).toBeTruthy();
  });

  it("puts what is not available after the steps, with «No disponible: <motivo>»", () => {
    mount(["owner"]);
    const items = section("Aprender de llamadas").getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Paso 1")).toBeTruthy();
    expect(within(items[1]!).queryByText(/^Paso \d/)).toBeNull();
    expect(within(items[1]!).getByText(PAIN.title)).toBeTruthy();
    expect(within(items[1]!).getByText("No disponible: todavía no está construido")).toBeTruthy();
    expect(screen.getAllByText(/^No disponible:/)).toHaveLength(1);
  });
});

describe("a play in two teams is activated once and counts in both (CA-8, G-1, G-3)", () => {
  beforeEach(() => {
    h.rows = [{ play_id: SIGNALS, enabled: true }];
  });
  it("shows it Activado in both teams, each pointing at the other", () => {
    mount(["owner"]);
    const a = card("Reactivar perdidos", title(SIGNALS));
    const b = card("Señales de cuenta", title(SIGNALS));
    expect(a.getByText("Activado")).toBeTruthy();
    expect(b.getByText("Activado")).toBeTruthy();
    expect(a.getByText("También en: Señales de cuenta")).toBeTruthy();
    expect(b.getByText("También en: Reactivar perdidos")).toBeTruthy();
  });
  it("owner: Pausar calls setPlayEnabled once and refreshes the play states", async () => {
    h.toggle.mockResolvedValue({ mensaje: "Pausado" });
    const { invalidate } = mount(["owner"]);
    fireEvent.click(
      card("Reactivar perdidos", title(SIGNALS)).getByRole("button", { name: "Pausar" }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: PLAY_STATES_KEY }));
    expect(h.toggle).toHaveBeenCalledTimes(1);
    expect(h.toggle).toHaveBeenCalledWith({ data: { play_id: SIGNALS, enabled: false } });
  });
  it("ae: the button is disabled and the reason is visible", () => {
    mount(["ae"]);
    const a = card("Señales de cuenta", title(SIGNALS));
    expect((a.getByRole("button", { name: "Pausar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      a.getByText("Solo el Owner o el Sales Leader pueden activar o pausar plays."),
    ).toBeTruthy();
    fireEvent.click(a.getByRole("button", { name: "Pausar" }));
    expect(h.toggle).not.toHaveBeenCalled();
  });
  it("the summary of both teams counts the shared play", () => {
    mount(["owner"]);
    for (const t of ["Reactivar perdidos", "Señales de cuenta"]) {
      const team = PLAY_TEAMS.find((x) => x.title === t)!;
      const sum = teamPlan(team, CATALOG, new Map([[SIGNALS, { enabled: true }]])).summary;
      expect(sum.enabled).toBeGreaterThanOrEqual(1);
      expect(section(t).getByText(summaryWord(sum))).toBeTruthy();
    }
  });
});

describe("it does not activate what cannot be (CA-9, G-3)", () => {
  it("owner: the planned play has its button disabled with the checkToggle text", () => {
    mount(["owner"]);
    const c = card("Aprender de llamadas", PAIN.title);
    expect((c.getByRole("button", { name: "Activar" }) as HTMLButtonElement).disabled).toBe(true);
    const r = checkToggle({ play: PAIN, roles: ["owner"], enable: true });
    expect(r.ok).toBe(false);
    const text = r.ok ? "" : r.error;
    expect(text).toMatch(/^No puedes activar este play todavía: /);
    expect(c.getByText(text)).toBeTruthy();
    fireEvent.click(c.getByRole("button", { name: "Activar" }));
    expect(h.toggle).not.toHaveBeenCalled();
  });
});

describe("one activity open at a time (shared card behaviour)", () => {
  it("opening the activity of the same play in the other team closes the first", () => {
    mount(["owner"]);
    const a = card("Reactivar perdidos", title(SIGNALS));
    const b = card("Señales de cuenta", title(SIGNALS));
    fireEvent.click(a.getByRole("button", { name: "Ver actividad" }));
    fireEvent.click(b.getByRole("button", { name: "Ver actividad" }));
    expect(screen.getAllByRole("button", { name: "Ocultar actividad" })).toHaveLength(1);
    expect(b.getByRole("button", { name: "Ocultar actividad" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });
});
