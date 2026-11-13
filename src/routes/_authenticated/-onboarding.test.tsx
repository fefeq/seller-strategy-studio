// NK-0009 CA-4: the /onboarding route reaches «Diagnóstico» without a proposal and never starts a reading to do it.
// useMe and useOnboarding are replaced; the real route component and steps are rendered. The name starts with «-» so the router ignores it.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  save: vi.fn(async (_p: Record<string, unknown>) => true),
  start: vi.fn(),
  session: null as Record<string, unknown> | null,
}));

vi.mock("@/hooks/use-me", () => ({
  useMe: () => ({
    data: { roles: ["owner"], user: { id: "user-ana" }, currentOrg: { website: "" } },
  }),
  useCurrency: () => ({ money: (n: number) => String(n), symbol: "EUR" }),
}));
vi.mock("@/hooks/use-onboarding", () => ({
  useOnboarding: () => ({ data: state.session, save: state.save }),
  asJson: (v: unknown) => v,
}));
vi.mock("@tanstack/react-start", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-start")>()),
  useServerFn: (f: unknown) => f,
}));
vi.mock("@/components/onboarding/blocks", () => ({ BlocksStep: () => null }));
vi.mock("@/lib/background.functions", () => ({
  startBackgroundJob: (...a: unknown[]) => state.start(...a),
}));
vi.mock("@/components/drive", () => ({ DriveSetupButton: () => null, DriveRefButton: () => null }));
vi.mock("@/components/page", () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

import { Route } from "./onboarding";

const Onboarding = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  state.save.mockClear();
  state.start.mockClear();
});
afterEach(cleanup);

describe("the /onboarding route without a proposal (NK-0009 CA-4)", () => {
  it("«4. Diagnóstico» is enabled, saves the step and starts no reading", () => {
    state.session = {
      step: "sources",
      depth: "express",
      proposal: null,
      read_job_id: null,
      diagnosis: null,
    };
    render(<Onboarding />);
    const bar = screen.getByRole("button", { name: "4. Diagnóstico" }) as HTMLButtonElement;
    expect(bar.disabled).toBe(false);
    fireEvent.click(bar);
    expect(state.save).toHaveBeenCalledWith({ step: "diagnosis" });
    expect(state.start).not.toHaveBeenCalled();
  });

  it("«5. Aprobar» stays disabled without a proposal", () => {
    state.session = {
      step: "sources",
      depth: "express",
      proposal: null,
      read_job_id: null,
      diagnosis: null,
    };
    render(<Onboarding />);
    expect((screen.getByRole("button", { name: "5. Aprobar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("«Hacer solo el diagnóstico» in «Tus fuentes» saves step diagnosis and starts no reading", () => {
    state.session = {
      step: "sources",
      depth: "express",
      proposal: null,
      read_job_id: null,
      diagnosis: null,
    };
    render(<Onboarding />);
    fireEvent.click(screen.getByRole("button", { name: "Hacer solo el diagnóstico" }));
    expect(state.save).toHaveBeenCalledWith({ step: "diagnosis" });
    expect(state.start).not.toHaveBeenCalled();
  });

  it("using the diagnosis without a proposal saves {input, result} and step roadmap (CA-5)", () => {
    state.session = {
      step: "diagnosis",
      depth: "express",
      proposal: null,
      read_job_id: null,
      diagnosis: null,
    };
    render(<Onboarding />);
    fireEvent.click(screen.getByRole("button", { name: "Usar este diagnóstico" }));
    expect(state.save).toHaveBeenCalledTimes(1);
    const patch = state.save.mock.calls[0]![0] as {
      step: string;
      diagnosis: { input: unknown; result: unknown };
    };
    expect(patch.step).toBe("roadmap");
    expect(patch.diagnosis.input).toBeTruthy();
    expect(patch.diagnosis.result).toBeTruthy();
  });
});
