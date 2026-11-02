import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";

/** `why` is the one-line «para qué te lo pido»: say what the data feeds, never more than one sentence. */
export function Field({ label, why, children }: { label: string; why?: string; children: ReactNode }) {
  return <div className="space-y-1"><Label className="eyebrow">{label}</Label>{children}{why && <p className="text-xs text-muted-foreground">{why}</p>}</div>;
}

export function Pick({ value, options, onChange, disabled, "aria-label": ariaLabel }: { value: string; options: Record<string, string>; onChange: (v: string) => void; disabled?: boolean; "aria-label"?: string }) {
  return (
    <NativeSelect aria-label={ariaLabel} disabled={disabled} className="w-full" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </NativeSelect>
  );
}
