// NK-0120 (CA-2): when the tab starts changing account (D-S3-3), what __root mounts next to the outlet
// (askConfirm / askText dialogs, toasts) must not keep showing the previous user's text over «Cambiando de
// cuenta…». Real DialogHost and AccountSwitchGate; fictional texts; no network.
import { act, cleanup, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSwitchGate, HideWhileSwitching } from "@/components/account-switch-gate";
import { askConfirm, askText, askUnsaved, DialogHost } from "@/components/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import {
  accountSwitch,
  beginAccountSwitch,
  resetAccountSwitch,
  useSwitchingAccount,
} from "@/lib/account-switch";

const reload = vi.fn();
const original = accountSwitch.reload;

beforeEach(() => {
  reload.mockReset();
  accountSwitch.reload = reload;
  resetAccountSwitch();
});
afterEach(() => {
  cleanup();
  toast.dismiss();
  resetAccountSwitch();
  accountSwitch.reload = original;
});

function Root() {
  // Same shape as RootComponent: the gate wraps the outlet; host and toaster sit next to it.
  return (
    <>
      <AccountSwitchGate>
        <p>app de X</p>
      </AccountSwitchGate>
      <HideWhileSwitching>
        <Toaster />
      </HideWhileSwitching>
      <DialogHost />
    </>
  );
}

describe("a dialog opened before the account switch (NK-0120)", () => {
  it("askConfirm closes without showing X's text over the switch screen, and resolves as cancelled", async () => {
    render(<Root />);
    let answer: boolean | undefined;
    await act(async () => {
      void askConfirm("¿Borrar la cuenta ACME-X?", { body: "Detalle privado de X" }).then(
        (v) => (answer = v),
      );
    });
    expect(screen.getByText("¿Borrar la cuenta ACME-X?")).toBeTruthy();

    await act(async () => beginAccountSwitch());
    expect(await screen.findByText("Cambiando de cuenta…")).toBeTruthy();
    expect(screen.queryByText("¿Borrar la cuenta ACME-X?")).toBeNull();
    expect(screen.queryByText("Detalle privado de X")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(answer).toBe(false);
  });

  it("no committed frame shows X's text once the switch has begun (not even before the effect runs)", async () => {
    const frames: boolean[] = [];
    function Probe() {
      const switching = useSwitchingAccount();
      // Layout effects run right after each commit: the DOM here is what the person would see.
      useLayoutEffect(() => {
        if (switching)
          frames.push(document.body.textContent?.includes("¿Borrar la cuenta ACME-X?") ?? false);
      });
      return null;
    }
    render(
      <>
        <Root />
        <Probe />
      </>,
    );
    await act(async () => {
      void askConfirm("¿Borrar la cuenta ACME-X?");
    });
    expect(screen.getByText("¿Borrar la cuenta ACME-X?")).toBeTruthy();
    await act(async () => beginAccountSwitch());
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter(Boolean)).toEqual([]);
  });

  it("askText and askUnsaved resolve as cancelled and drop what was typed", async () => {
    render(<Root />);
    const answers: unknown[] = [];
    await act(async () => {
      void askText("Nombre del deal de X", { initial: "texto de X" }).then((v) => answers.push(v));
      void askUnsaved("¿Guardar lo de X?").then((v) => answers.push(v));
    });
    expect(screen.getByDisplayValue("texto de X")).toBeTruthy();

    await act(async () => beginAccountSwitch());
    expect(screen.queryByDisplayValue("texto de X")).toBeNull();
    expect(screen.queryByText("Nombre del deal de X")).toBeNull();
    expect(screen.queryByText("¿Guardar lo de X?")).toBeNull();
    await act(async () => undefined);
    expect(answers).toEqual([null, "stay"]);
  });

  it("a question asked while switching never shows and resolves as cancelled", async () => {
    render(<Root />);
    await act(async () => beginAccountSwitch());
    let answer: boolean | undefined;
    await act(async () => {
      void askConfirm("¿Seguro? (texto de X)").then((v) => (answer = v));
    });
    expect(screen.queryByText("¿Seguro? (texto de X)")).toBeNull();
    expect(answer).toBe(false);
  });

  it("without a switch, dialogs still work as before", async () => {
    render(<Root />);
    await act(async () => {
      void askConfirm("¿Seguro?");
    });
    expect(screen.getByText("¿Seguro?")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("a toast shown before the account switch (NK-0120)", () => {
  it("is not on screen over the switch screen", async () => {
    render(<Root />);
    await act(async () => {
      toast("Deal guardado: ACME-X");
    });
    expect(await screen.findByText("Deal guardado: ACME-X")).toBeTruthy();
    await act(async () => beginAccountSwitch());
    expect(screen.queryByText("Deal guardado: ACME-X")).toBeNull();
    expect(screen.getByText("Cambiando de cuenta…")).toBeTruthy();
  });
});

describe("source guard (NK-0120)", () => {
  it("__root keeps the toaster behind HideWhileSwitching and mounts DialogHost", () => {
    const src = readFileSync(path.resolve(__dirname, "../routes/__root.tsx"), "utf8");
    expect(src).toMatch(/<HideWhileSwitching>\s*<Toaster \/>\s*<\/HideWhileSwitching>/);
    expect(src).toMatch(/<DialogHost \/>/);
  });
});
