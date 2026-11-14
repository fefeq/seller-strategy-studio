// Ola 0.4: ScreenState has its own «sin permiso» state that says which role can do it, without Reintentar.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenState } from "@/components/page";

afterEach(cleanup);

describe("ScreenState forbidden", () => {
  it("shows who can do it and hides the content", () => {
    render(
      <ScreenState
        isPending={false}
        error={null}
        refetch={vi.fn()}
        forbidden="Solo el Owner y el Sales Leader pueden usar el Asesor GTM."
      >
        <p>contenido</p>
      </ScreenState>,
    );
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
    const box = screen.getByRole("note");
    expect(box).toHaveTextContent("Sin permiso");
    expect(box).toHaveTextContent("Owner y el Sales Leader");
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
  it("forbidden wins over loading", () => {
    render(
      <ScreenState isPending error={null} refetch={vi.fn()} forbidden="Solo el Owner.">
        <p>x</p>
      </ScreenState>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Solo el Owner.");
  });
});
