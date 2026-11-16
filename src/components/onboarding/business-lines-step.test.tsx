// NK-0167 SDD 2 U-2: permissions and catalogue on the business-lines step (fictitious data).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const lines = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock("@/hooks/use-business-lines", () => ({
  useBusinessLines: () => ({
    data: lines.data,
    isLoading: false,
    error: null,
    ports: {},
    refresh: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-me", () => ({
  useCurrency: () => ({ money: (n: number) => `${n} €`, symbol: "€" }),
}));
vi.mock("@/components/confirm-dialog", () => ({ askConfirm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BusinessLinesStep } from "./business-lines-step";

const line = (id: string, primary: boolean, position: number) => ({
  id,
  model: "b2b",
  acv: 12000,
  friction: "committee",
  stage: "early",
  name: `Línea ${id}`,
  is_primary: primary,
  position,
});
const initial = {
  model: "b2b" as const,
  acv: 0,
  friction: "self_serve" as const,
  stage: "early" as const,
};
const show = (roles: string[]) =>
  render(
    <BusinessLinesStep
      orgId="org-f"
      roles={roles}
      initial={initial}
      saveDiagnosis={vi.fn()}
      onNext={vi.fn()}
    />,
  );

afterEach(cleanup);

describe("BusinessLinesStep", () => {
  it("only the Owner sees «Quitar»; the Sales Leader sees why", () => {
    lines.data = [line("a", true, 0), line("b", false, 1)];
    show(["owner"]);
    expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(2);
    cleanup();
    show(["sales_leader"]);
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
    expect(screen.getByText("Solo el Owner puede quitar líneas.")).toBeTruthy();
  });
  it("never offers to remove the last line", () => {
    lines.data = [line("a", true, 0)];
    show(["owner"]);
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
  });
  it("caps the catalogue at four lines", () => {
    lines.data = [
      line("a", true, 0),
      line("b", false, 1),
      line("c", false, 2),
      line("d", false, 3),
    ];
    show(["owner"]);
    expect(screen.queryByRole("button", { name: "Añadir otra línea" })).toBeNull();
  });
  it("cannot continue without a primary line", () => {
    lines.data = [];
    show(["owner"]);
    expect(
      (screen.getByRole("button", { name: "Continuar con estas líneas" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
