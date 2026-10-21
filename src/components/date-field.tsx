import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatSpanishDate, parseSpanishDate } from "@/lib/dates";

/**
 * A date typed as día/mes/año whatever the browser's language. value and onChange use ISO
 * (AAAA-MM-DD, or null when empty), like the native field it replaces; an invalid entry is
 * flagged and never passed on.
 */
export function DateField({
  value,
  onChange,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(formatSpanishDate(value));
  const [error, setError] = useState<string | null>(null);
  // Follow the value when it changes from outside (another record opened, a refresh).
  useEffect(() => {
    setText(formatSpanishDate(value));
    setError(null);
  }, [value]);
  function commit(raw: string) {
    const r = parseSpanishDate(raw);
    if (!r.ok) return setError(r.error);
    setError(null);
    setText(formatSpanishDate(r.iso));
    if (r.iso !== (value || null)) onChange(r.iso);
  }
  return (
    <div>
      <Input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        className={className}
        aria-invalid={!!error}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
        }}
      />
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
