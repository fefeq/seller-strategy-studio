import { useBlocker } from "@tanstack/react-router";
import { askConfirm, askUnsaved } from "@/components/confirm-dialog";
import { blocksLeaving } from "@/lib/field-actions";

/**
 * CA-3: while there are unsaved changes, leaving the screen (a link, the back button, closing the tab) asks to
 * save or discard. onSave returns false when the save failed: the person stays with their draft. Without onSave
 * there is nothing to save from here, so the question is only whether to leave and lose the changes.
 */
export function useUnsavedGuard(dirty: boolean, onSave?: () => Promise<boolean>) {
  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: () => dirty,
    shouldBlockFn: async () => {
      if (!onSave) {
        const leave = await askConfirm("Tienes cambios sin guardar", { body: "Si sales ahora, pierdes lo que has editado. Para conservarlo, guárdalo antes.", confirmLabel: "Salir y descartar", cancelLabel: "Seguir editando" });
        return !leave;
      }
      const choice = await askUnsaved("Tienes cambios sin guardar", { body: "Si sales ahora, los pierdes.", saveLabel: "Guardar y salir" });
      const saved = choice === "save" ? await onSave() : null;
      return blocksLeaving(choice, saved);
    },
  });
}
