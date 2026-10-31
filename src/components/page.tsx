import type { ReactNode } from "react";
import { FlowStrip } from "@/components/flow-strip";

export function Page({ eyebrow, title, titleAside, actions, children }: { eyebrow?: string; title: string; titleAside?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-5 md:px-10 md:py-10">
      <FlowStrip />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-hairline-firm pb-6 md:mb-10">
        <div className="min-w-0">
          {eyebrow && <p className="kicker">{eyebrow}</p>}
          <h1 className="lede-m mt-3 measure-lede break-words [overflow-wrap:anywhere] md:lede-l">{titleAside ? <span className="inline-flex items-center gap-3">{titleAside}<span>{title}</span></span> : title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border-t border-hairline py-8 text-sm text-ink-mid">{children}</div>;
}

// Mark: el estado es una palabra en versalitas con un filete de color debajo.
const TONE: Record<string, string> = {
  green: "border-state-ok text-ink",
  yellow: "border-state-watch text-ink",
  red: "border-state-alarm text-red",
};
export function HealthDot({ value }: { value?: string | null }) {
  const label = value === "red" ? "En riesgo" : value === "yellow" ? "Atención" : "Sano";
  return <span className={`smallcaps border-b-2 pb-0.5 ${TONE[value ?? "green"] ?? TONE.green}`}>{label}</span>;
}
