// SDD-20261106-ux-core-screens-pattern, U-1 · CA-1, CA-2 (component): ScreenState shows a loading skeleton (never the content, never a number),
// the errorText() message with «Reintentar», and the content only when the query has data. Fictional data; no network.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenState } from "@/components/page";
import { errorText } from "@/lib/errors";

afterEach(cleanup);

const body = <p>contenido de prueba</p>;

describe("ScreenState", () => {
  it("while pending: busy region with accessible «Cargando…», no content", () => {
    render(
      <ScreenState isPending error={null} refetch={vi.fn()}>
        {body}
      </ScreenState>,
    );
    expect(screen.queryByText("contenido de prueba")).not.toBeInTheDocument();
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Cargando…");
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("draws a skeleton per kind of block", () => {
    for (const kind of ["list", "cards", "table", "line"] as const) {
      const { container, unmount } = render(
        <ScreenState isPending error={null} refetch={vi.fn()} skeleton={kind}>
          {body}
        </ScreenState>,
      );
      expect(container.querySelector(`[data-skeleton="${kind}"]`)).not.toBeNull();
      unmount();
    }
  });

  it("with an error: errorText() and «Reintentar», never the content; the button calls refetch", () => {
    const err = new Error("Failed to fetch");
    const refetch = vi.fn();
    render(
      <ScreenState isPending={false} error={err} refetch={refetch}>
        {body}
      </ScreenState>,
    );
    expect(screen.getByText(errorText(err))).toBeInTheDocument();
    expect(screen.queryByText("contenido de prueba")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("with data: only the content", () => {
    render(
      <ScreenState isPending={false} error={null} refetch={vi.fn()}>
        {body}
      </ScreenState>,
    );
    expect(screen.getByText("contenido de prueba")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
});
