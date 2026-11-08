import type { ReactNode } from "react";
import { FlowStrip } from "@/components/flow-strip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorText } from "@/lib/errors";

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

const SKELETON_ROWS = { list: 4, cards: 3, table: 5, line: 1 } as const;

/**
 * Loading and error of a screen block (SDD-20261106-ux-core-screens-pattern, U-1). Takes what useQuery gives:
 * while the first answer has not arrived it shows a skeleton (never the content, so no empty text and no number);
 * an error shows errorText() and «Reintentar»; children are drawn only with data.
 */
export function ScreenState({
  isPending,
  error,
  refetch,
  skeleton = "list",
  children,
}: {
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
  skeleton?: keyof typeof SKELETON_ROWS;
  children: ReactNode;
}) {
  if (error) {
    return (
      <div role="alert" className="space-y-3 border-t border-hairline py-8 text-sm text-ink-mid">
        <p>{errorText(error)}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (isPending) {
    const rows = SKELETON_ROWS[skeleton];
    return (
      <div role="status" aria-busy="true" data-skeleton={skeleton} className="space-y-3 py-4">
        <span className="sr-only">Cargando…</span>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={skeleton === "cards" ? "h-24 w-full" : skeleton === "line" ? "h-4 w-56" : "h-10 w-full"} />
        ))}
      </div>
    );
  }
  return <>{children}</>;
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
