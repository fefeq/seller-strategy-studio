import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** `why` is the one-line «para qué te lo pido»: say what the data feeds, never more than one sentence. */
export function Field({
  label,
  why,
  children,
}: {
  label: string;
  why?: string;
  children: ReactNode;
}) {
  const auto = useId();
  // The label is tied to its control (htmlFor/id) so it is its accessible name. Only a lone Input or Textarea is
  // wired: other children (comboboxes, groups, switches) keep their own naming. A child that brings its own id keeps it.
  const child = isValidElement(children) ? (children as ReactElement<{ id?: string }>) : null;
  const wired = child && (child.type === Input || child.type === Textarea) ? child : null;
  const id = wired ? (wired.props.id ?? auto) : undefined;
  return (
    <div className="space-y-1">
      <Label className="eyebrow" htmlFor={id}>
        {label}
      </Label>
      {wired ? cloneElement(wired, { id }) : children}
      {why && <p className="text-xs text-muted-foreground">{why}</p>}
    </div>
  );
}

export function Pick({
  value,
  options,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  options: Record<string, string>;
  onChange: (v: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <NativeSelect
      aria-label={ariaLabel}
      disabled={disabled}
      className="w-full"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </NativeSelect>
  );
}
