import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><Label className="eyebrow">{label}</Label>{children}</div>;
}

export function Pick({ value, options, onChange, disabled, "aria-label": ariaLabel }: { value: string; options: Record<string, string>; onChange: (v: string) => void; disabled?: boolean; "aria-label"?: string }) {
  return (
    <select aria-label={ariaLabel} disabled={disabled} className="h-10 w-full rounded-md border bg-background px-2 text-base disabled:opacity-60 md:h-9 md:text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}
