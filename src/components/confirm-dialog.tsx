import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isSwitchingAccount, useSwitchingAccount } from "@/lib/account-switch";

/**
 * Nokko-styled replacements for the browser's own dialogs, which are never used.
 * Call askConfirm / askText from any event handler; <DialogHost /> (mounted once in __root) renders them.
 * Without a mounted host they resolve the safe answer (false, null, "stay"): nothing is confirmed by accident.
 */
type ConfirmRequest = {
  kind: "confirm";
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (v: boolean) => void;
};
type TextRequest = {
  kind: "text";
  title: string;
  body?: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  multiline?: boolean;
  maxLength?: number;
  resolve: (v: string | null) => void;
};
type UnsavedRequest = {
  kind: "unsaved";
  title: string;
  body?: string;
  saveLabel?: string;
  discardLabel?: string;
  stayLabel?: string;
  resolve: (v: "save" | "discard" | "stay") => void;
};
type Request = ConfirmRequest | TextRequest | UnsavedRequest;

let push: ((r: Request) => void) | null = null;

/** What each kind of question answers when it is dismissed. */
function cancel(r: Request) {
  if (r.kind === "confirm") r.resolve(false);
  else if (r.kind === "unsaved") r.resolve("stay");
  else r.resolve(null);
}

export type ConfirmOptions = { body?: string; confirmLabel?: string; cancelLabel?: string };
/** multiline: a tall text area for pasted documents; maxLength: shows a counter and blocks sending above it. */
export type TextOptions = {
  body?: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  multiline?: boolean;
  maxLength?: number;
};

/** Resolves true only when the user confirms; false if dismissed or if the host is not mounted. */
export function askConfirm(title: string, opts: ConfirmOptions = {}): Promise<boolean> {
  if (!push) return Promise.resolve(false);
  return new Promise((resolve) => push!({ kind: "confirm", title, ...opts, resolve }));
}

/** Unsaved changes on leaving: «save», «discard» or «stay» (also when the dialog is dismissed). */
export function askUnsaved(
  title: string,
  opts: { body?: string; saveLabel?: string; discardLabel?: string; stayLabel?: string } = {},
): Promise<"save" | "discard" | "stay"> {
  if (!push) return Promise.resolve("stay");
  return new Promise((resolve) => push!({ kind: "unsaved", title, ...opts, resolve }));
}

/** Resolves the trimmed text, or null when cancelled, empty or if the host is not mounted. */
export function askText(title: string, opts: TextOptions = {}): Promise<string | null> {
  if (!push) return Promise.resolve(null);
  return new Promise((resolve) => push!({ kind: "text", title, ...opts, resolve }));
}

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // NK-0120: while the tab changes account nothing of the previous user may stay on screen.
  const switching = useSwitchingAccount();
  const current = switching ? undefined : queue[0];

  useEffect(() => {
    if (!switching || queue.length === 0) return;
    queue.forEach(cancel);
    setQueue([]);
  }, [switching, queue]);

  useEffect(() => {
    push = (r) => {
      if (isSwitchingAccount()) cancel(r);
      else setQueue((q) => [...q, r]);
    };
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (current?.kind === "text") {
      setText(current.initial ?? "");
      setTimeout(() => (current.multiline ? areaRef.current : inputRef.current)?.focus(), 0);
    }
  }, [current]);

  const max = current?.kind === "text" ? current.maxLength : undefined;
  const len = text.trim().length;
  const tooLong = max != null && len > max;
  const canSend = current?.kind !== "text" || (len > 0 && !tooLong);

  const close = (ok: boolean) => {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(ok);
    else if (current.kind === "unsaved") current.resolve(ok ? "save" : "stay");
    else current.resolve(ok ? text.trim() || null : null);
    setQueue((q) => q.slice(1));
  };
  const discard = () => {
    if (current?.kind !== "unsaved") return;
    current.resolve("discard");
    setQueue((q) => q.slice(1));
  };

  return (
    <AlertDialog open={!!current} onOpenChange={(open) => !open && close(false)}>
      {current && (
        <AlertDialogContent
          className={current.kind === "text" && current.multiline ? "sm:max-w-2xl" : undefined}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{current.title}</AlertDialogTitle>
            {current.body && <AlertDialogDescription>{current.body}</AlertDialogDescription>}
          </AlertDialogHeader>
          {current.kind === "text" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canSend) close(true);
              }}
            >
              {current.multiline ? (
                <Textarea
                  ref={areaRef}
                  value={text}
                  rows={10}
                  placeholder={current.placeholder}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
                      e.preventDefault();
                      close(true);
                    }
                  }}
                  aria-label={current.title}
                  aria-invalid={tooLong || undefined}
                  className="max-h-[50vh] min-h-[10rem] resize-y"
                />
              ) : (
                <Input
                  ref={inputRef}
                  value={text}
                  placeholder={current.placeholder}
                  onChange={(e) => setText(e.target.value)}
                  aria-label={current.title}
                  aria-invalid={tooLong || undefined}
                />
              )}
              {max != null && (
                <p
                  className={`mt-1.5 text-xs ${tooLong ? "text-state-alarm" : "text-ink-mid"}`}
                  aria-live="polite"
                >
                  {tooLong
                    ? `Te sobran ${(len - max).toLocaleString("es-ES")} caracteres: recórtalo para poder enviarlo.`
                    : `${len.toLocaleString("es-ES")} / ${max.toLocaleString("es-ES")} caracteres`}
                </p>
              )}
            </form>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {current.kind === "confirm"
                ? (current.cancelLabel ?? "Cancelar")
                : current.kind === "unsaved"
                  ? (current.stayLabel ?? "Seguir editando")
                  : "Cancelar"}
            </AlertDialogCancel>
            {current.kind === "unsaved" && (
              <Button type="button" variant="outline" onClick={discard}>
                {current.discardLabel ?? "Descartar"}
              </Button>
            )}
            <AlertDialogAction
              disabled={!canSend}
              onClick={(e) => {
                e.preventDefault();
                close(true);
              }}
            >
              {current.kind === "unsaved"
                ? (current.saveLabel ?? "Guardar")
                : (current.confirmLabel ?? (current.kind === "confirm" ? "Seguir" : "Guardar"))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
