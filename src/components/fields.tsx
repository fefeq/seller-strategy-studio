import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><Label className="eyebrow">{label}</Label>{children}</div>;
}

export function Pick({ value, options, onChange }: { value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <select className="h-10 w-full rounded-md border bg-background px-2 text-base md:h-9 md:text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}
