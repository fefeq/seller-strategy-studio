import { Button } from "@/components/ui/button";
import { ACTION_LABEL, actionsFor, type Action, type ElementKind } from "@/lib/field-actions";

/**
 * The same four words on every element: Editar, Confirmar, Borrar, Deshacer. An action the role may not do is
 * shown disabled with the reason beside it (never silently missing); one the element does not have is not shown.
 * The screen passes only the handlers it supports.
 */
export function FieldActions({
  kind,
  roles,
  handlers,
  busy = false,
  confirmed = false,
  undoable = false,
  labels = {},
}: {
  kind: ElementKind;
  roles: readonly string[];
  handlers: Partial<Record<Action, () => void>>;
  busy?: boolean;
  /** Hides «Confirmar» once the value is confirmed. */
  confirmed?: boolean;
  /** Shows «Deshacer» only while there is something to undo. */
  undoable?: boolean;
  /** Another word for an action on this element (a source is «Quitar», a finding «Descartar»). */
  labels?: Partial<Record<Action, string>>;
}) {
  const shown = actionsFor(kind, roles).filter(
    (a) =>
      handlers[a.action] &&
      !(a.action === "confirm" && confirmed) &&
      !(a.action === "undo" && !undoable),
  );
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((a) => (
        <Button
          key={a.action}
          size="sm"
          variant="ghost"
          disabled={busy || !a.allowed}
          title={a.reason ?? undefined}
          onClick={handlers[a.action]}
        >
          {labels[a.action] ?? ACTION_LABEL[a.action]}
        </Button>
      ))}
      {shown
        .filter((a) => a.reason)
        .slice(0, 1)
        .map((a) => (
          <span key="why" className="text-xs text-ink-mid">
            {a.reason}
          </span>
        ))}
    </div>
  );
}
