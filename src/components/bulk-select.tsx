// D1: multi-select checkbox and the bar that acts on the selection (export CSV, clear). No writes: bulk edits stay per record.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { prune, toCsv, toggle, toggleAll } from "@/lib/selection";

export function useSelection(ids: readonly string[]) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const key = ids.join(",");
  useEffect(() => setSel((s) => (s.size ? prune(s, ids) : s)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    sel,
    has: (id: string) => sel.has(id),
    flip: (id: string) => setSel((s) => toggle(s, id)),
    flipAll: () => setSel((s) => toggleAll(s, ids)),
    all: ids.length > 0 && ids.every((id) => sel.has(id)),
    clear: () => setSel(new Set()),
  };
}

export function SelectBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-4 shrink-0 accent-primary"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** Sticky bar above the mobile bottom navigation while something is selected. */
export function SelectionBar({
  count,
  onClear,
  csv,
  filename,
}: {
  count: number;
  onClear: () => void;
  csv: () => { header: string[]; rows: (string | number | null | undefined)[][] };
  filename: string;
}) {
  if (!count) return null;
  function download() {
    const { header, rows } = csv();
    const blob = new Blob(["\uFEFF" + toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div
      role="region"
      aria-label="Selección"
      className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 shadow-md md:bottom-4"
    >
      <span className="text-sm font-medium">{count} seleccionados</span>
      <span className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={download}>
          Exportar CSV
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Quitar selección
        </Button>
      </span>
    </div>
  );
}
