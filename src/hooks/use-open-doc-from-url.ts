import { useEffect, useRef } from "react";

/**
 * Opens the document named by the URL once per parameter value, as soon as it is in the list.
 * Later changes to the list (create, delete, import) never move a selection the person made.
 */
export function useOpenDocFromUrl<T extends { id: string }>(
  docId: string | undefined,
  docs: T[],
  onOpen: (doc: T) => void,
) {
  const opened = useRef<string | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  useEffect(() => {
    if (!docId) {
      opened.current = null;
      return;
    }
    if (opened.current === docId) return;
    const doc = docs.find((d) => d.id === docId);
    if (!doc) return;
    opened.current = docId;
    onOpenRef.current(doc);
  }, [docId, docs]);
}
