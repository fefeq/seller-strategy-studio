import type { ReactNode } from "react";

export function Page({ eyebrow, title, actions, children }: { eyebrow?: string; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 text-5xl">{title}</h1>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

const TONE: Record<string, string> = {
  green: "bg-success/15 text-success",
  yellow: "bg-warning/25 text-foreground",
  red: "bg-destructive/15 text-destructive",
};
export function HealthDot({ value }: { value?: string | null }) {
  const label = value === "red" ? "En riesgo" : value === "yellow" ? "Atención" : "Sano";
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${TONE[value ?? "green"] ?? TONE.green}`}>{label}</span>;
}
