// SDD-20261031-ux-move-without-drag CA-4, CA-10, CA-12: the menu and the keyboard drag, on a small fictional board.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BoardDnd, DragCard, DropColumn } from "@/components/board-dnd";
import { MoveMenu } from "@/components/move-menu";
import { dealMoveOptions } from "@/lib/board-move";
import { DEFAULT_STAGES } from "@/lib/stages";

afterEach(cleanup);

describe("CA-4 «Mover a…» menu", () => {
  it("opens with the keyboard, lists every stage and disables the current one", async () => {
    const onMove = vi.fn();
    const opts = dealMoveOptions(DEFAULT_STAGES, "qualified");
    render(<MoveMenu itemLabel="Deal Demo" options={opts} onMove={onMove} />);
    const trigger = screen.getByRole("button", { name: "Mover Deal Demo a otra etapa" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent?.replace(" · actual", ""))).toEqual(opts.map((o) => o.label));
    const current = items.find((i) => i.textContent?.includes("· actual"))!;
    expect(current.getAttribute("aria-disabled") ?? current.getAttribute("data-disabled")).not.toBeNull();
    fireEvent.click(items.find((i) => i.textContent === "Ganado")!);
    expect(onMove).toHaveBeenCalledWith("won");
  });
});

const COLS = ["a", "b", "c"] as const;
const NAMES: Record<string, string> = { a: "Uno", b: "Dos", c: "Tres" };
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;

function Board({ onMove }: { onMove: (id: string, to: string) => void }) {
  return (
    <BoardDnd cardLabel={() => "Acme"} columnLabel={(id) => NAMES[id] ?? id} onMove={onMove}>
      {COLS.map((id) => (
        <DropColumn key={id} id={id}>
          <h3>{NAMES[id]}</h3>
          {id === "a" && <DragCard id="card1" column="a">{(p) => <button {...p}>Acme</button>}</DragCard>}
        </DropColumn>
      ))}
    </BoardDnd>
  );
}

describe("CA-10 / CA-12 keyboard drag", () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const col = this.getAttribute?.("data-column");
      if (col) return rect(COLS.indexOf(col as never) * 100, 0, 100, 300);
      if (this.tagName === "BUTTON") return rect(10, 10, 80, 30);
      return rect(0, 0, 0, 0);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("Space lifts, an arrow changes stage, Space drops; the live region says what happens", async () => {
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    const card = screen.getByRole("button", { name: /Acme/ });
    card.focus();
    fireEvent.keyDown(card, { code: "Space", key: " " });
    await waitFor(() => expect(document.body.textContent).toContain("Has levantado «Acme», que está en Uno"));
    fireEvent.keyDown(document, { code: "ArrowRight", key: "ArrowRight" });
    await waitFor(() => expect(document.body.textContent).toContain("«Acme» está sobre Dos"));
    fireEvent.keyDown(document, { code: "Space", key: " " });
    await waitFor(() => expect(onMove).toHaveBeenCalledWith("card1", "b"));
    expect(document.body.textContent).toContain("Has soltado «Acme» en Dos");
  });

  it("Escape cancels and nothing moves", async () => {
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    const card = screen.getByRole("button", { name: /Acme/ });
    card.focus();
    fireEvent.keyDown(card, { code: "Space", key: " " });
    await waitFor(() => expect(document.body.textContent).toContain("Has levantado"));
    fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
    await waitFor(() => expect(document.body.textContent).toContain("Cancelado"));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("CA-13 dropping on its own stage does not call onMove", async () => {
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    const card = screen.getByRole("button", { name: /Acme/ });
    card.focus();
    fireEvent.keyDown(card, { code: "Space", key: " " });
    await waitFor(() => expect(document.body.textContent).toContain("Has levantado"));
    fireEvent.keyDown(document, { code: "Space", key: " " });
    await waitFor(() => expect(document.body.textContent).toContain("no cambia nada"));
    expect(onMove).not.toHaveBeenCalled();
  });
});
