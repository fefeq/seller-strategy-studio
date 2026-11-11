// SDD-20261110-play-teams U-2 (CA-10): regression guard for the Plays GTM catalogue screen. It is written and green on the code from
// before PlayCard and usePlayToggle were extracted, and must stay green after. Not fail-first: it already passes today.
// Fictional data; no network (supabase, the server function and the toast are mocked).
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

import { toast } from "sonner";
import { PlaysPanel } from "./plays-panel";
import { PLAY_STATES_KEY } from "./use-play-states";
import { errorText } from "@/lib/errors";
import { CATALOG } from "@/lib/plays/catalog";
import { checkToggle, describePlay } from "@/lib/plays/status";
import { CHANNEL_LABEL, MOTION_LABEL, STATUS_WORD } from "@/lib/plays/view";

const OWNER = ["owner"];
const PARCIAL = CATALOG.find((p) => p.id === "closed-lost-revival")!;
const BLOCKED = CATALOG.find((p) => p.status === "bloqueado")!;
const SECOND = CATALOG.find((p) => p.id === "crm-hygiene")!;

function mount(roles: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <PlaysPanel roles={roles} />
    </QueryClientProvider>,
  );
  return { invalidate };
}
const card = (title: string) => screen.getByText(title).closest("li")!;

beforeEach(() => {
  h.rows = [];
  h.toggle.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(cleanup);

describe("PlaysPanel keeps its catalogue behaviour (CA-10, G-3)", () => {
  it("picks the plays the guard relies on", () => {
    expect(PARCIAL.status).toBe("parcial");
    expect(PARCIAL.defaultEnabled).toBe(false);
    expect(BLOCKED).toBeTruthy();
    expect(CATALOG).toHaveLength(28);
  });

  it("shows the 28 plays and the three filters", () => {
    mount(OWNER);
    expect(document.querySelectorAll("li")).toHaveLength(28);
    for (const p of CATALOG) expect(screen.getAllByText(p.title).length, p.id).toBeGreaterThan(0);
    for (const l of ["Filtrar por motion", "Filtrar por estado", "Filtrar por fase"])
      expect(screen.getByLabelText(l), l).toBeTruthy();
  });

  it("draws a partial and a blocked play with title, state, motion, channels, label, phase, level and needs", () => {
    mount(OWNER);
    for (const play of [PARCIAL, BLOCKED]) {
      const d = describePlay(play, undefined);
      const li = within(card(play.title));
      expect(li.getByText(play.title)).toBeTruthy();
      expect(
        li.getByText(
          `${STATUS_WORD[d.status]} · ${d.motion.map((m) => MOTION_LABEL[m]).join(", ")} · ${d.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}`,
        ),
      ).toBeTruthy();
      expect(li.getByText(d.label)).toBeTruthy();
      expect(li.getByText(`${d.phaseLabel} · ${d.approvalLabel}`)).toBeTruthy();
      expect(li.getByText(`Necesita: ${d.needs.join("; ")}.`)).toBeTruthy();
    }
    expect(
      within(card(BLOCKED.title)).getByText(
        `No se puede activar todavía: ${describePlay(BLOCKED, undefined).reason}.`,
      ),
    ).toBeTruthy();
  });

  it("owner: Activar calls setPlayEnabled once, is disabled while it runs, then invalidates the play states (a)", async () => {
    let done: (v: { mensaje: string }) => void = () => undefined;
    h.toggle.mockImplementation(() => new Promise((r) => (done = r)));
    const { invalidate } = mount(OWNER);
    const btn = within(card(PARCIAL.title)).getByRole("button", { name: "Activar" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(btn);
    expect(h.toggle).toHaveBeenCalledTimes(1);
    expect(h.toggle).toHaveBeenCalledWith({ data: { play_id: PARCIAL.id, enabled: true } });
    expect(invalidate).not.toHaveBeenCalled();
    done({ mensaje: "Activado" });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: PLAY_STATES_KEY }));
    expect(toast.success).toHaveBeenCalledWith("Activado");
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
  });

  it("owner: a failing setPlayEnabled shows errorText of the error and does not invalidate (b)", async () => {
    const err = new Error("Failed to fetch");
    h.toggle.mockRejectedValue(err);
    const { invalidate } = mount(OWNER);
    fireEvent.click(within(card(PARCIAL.title)).getByRole("button", { name: "Activar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(errorText(err)));
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("ae: the button is disabled and the reason is visible (c)", () => {
    mount(["ae"]);
    const li = within(card(PARCIAL.title));
    expect((li.getByRole("button", { name: "Activar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      li.getByText("Solo el Owner o el Sales Leader pueden activar o pausar plays."),
    ).toBeTruthy();
    fireEvent.click(li.getByRole("button", { name: "Activar" }));
    expect(h.toggle).not.toHaveBeenCalled();
  });

  it("owner: a blocked play cannot be activated and shows the checkToggle error (d)", () => {
    mount(OWNER);
    const li = within(card(BLOCKED.title));
    expect((li.getByRole("button", { name: "Activar" }) as HTMLButtonElement).disabled).toBe(true);
    const r = checkToggle({ play: BLOCKED, roles: OWNER, enable: true });
    expect(r.ok).toBe(false);
    expect(li.getByText(r.ok ? "" : r.error)).toBeTruthy();
  });

  it("an enabled play offers Pausar and sends enabled false", async () => {
    h.rows = [{ play_id: PARCIAL.id, enabled: true }];
    h.toggle.mockResolvedValue({ mensaje: "Pausado" });
    mount(OWNER);
    fireEvent.click(within(card(PARCIAL.title)).getByRole("button", { name: "Pausar" }));
    await waitFor(() => expect(h.toggle).toHaveBeenCalledTimes(1));
    expect(h.toggle).toHaveBeenCalledWith({ data: { play_id: PARCIAL.id, enabled: false } });
  });

  it("Ver actividad expands one play at a time (e)", () => {
    mount(OWNER);
    const first = within(card(PARCIAL.title));
    const open = first.getByRole("button", { name: "Ver actividad" });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(open);
    const shown = first.getByRole("button", { name: "Ocultar actividad" });
    expect(shown.getAttribute("aria-expanded")).toBe("true");
    const second = within(card(SECOND.title));
    fireEvent.click(second.getByRole("button", { name: "Ver actividad" }));
    expect(
      second.getByRole("button", { name: "Ocultar actividad" }).getAttribute("aria-expanded"),
    ).toBe("true");
    const reopened = first.getByRole("button", { name: "Ver actividad" });
    expect(reopened.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByRole("button", { name: "Ocultar actividad" })).toHaveLength(1);
    fireEvent.click(second.getByRole("button", { name: "Ocultar actividad" }));
    expect(screen.queryAllByRole("button", { name: "Ocultar actividad" })).toHaveLength(0);
  });
});
