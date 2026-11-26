import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FlowStrip } from "@/components/flow-strip";
import { IconText } from "@/components/icon-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorText } from "@/lib/errors";

export function Page({
  eyebrow,
  title,
  titleAside,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  titleAside?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-5 md:px-10 md:py-10">
      <FlowStrip />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div className="min-w-0">
          {eyebrow && <p className="kicker">{eyebrow}</p>}
          <h1 className="page-title mt-1 max-w-[48ch] text-balance break-words [overflow-wrap:anywhere]">
            {titleAside ? (
              <span className="inline-flex items-center gap-3">
                {titleAside}
                <span>{title}</span>
              </span>
            ) : (
              title
            )}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

/**
 * Empty state. With only `children` it stays the quiet one-line note every screen already uses.
 * Optional: `title` (the clear message), `icon` (discreet, always paired with text through IconText),
 * and `action` / `secondaryAction` (the primary and secondary buttons the caller renders).
 */
export function Empty({
  children,
  title,
  icon,
  action,
  secondaryAction,
}: {
  children?: ReactNode;
  title?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  if (!title && !icon && !action && !secondaryAction) {
    return <div className="border-t border-hairline py-8 text-sm text-ink-mid">{children}</div>;
  }
  // The icon goes with the title; without a title it goes with the message.
  const heading = title ?? (icon ? children : undefined);
  const body = title != null ? children : icon ? undefined : children;
  return (
    <div className="rounded-lg border border-dashed border-hairline-firm px-5 py-8 text-sm">
      {heading != null && (
        <p className="font-medium text-foreground">
          {icon ? (
            <IconText icon={icon} className="[&>svg]:text-ink-faint">
              {heading}
            </IconText>
          ) : (
            heading
          )}
        </p>
      )}
      {body != null && (
        <div className={`measure-body text-ink-mid ${heading != null ? "mt-1" : ""}`}>{body}</div>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
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
  forbidden,
  children,
}: {
  /** «Sin permiso»: the sentence saying which role can do it. Wins over loading and error. */
  forbidden?: string;
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
  skeleton?: keyof typeof SKELETON_ROWS;
  children: ReactNode;
}) {
  if (forbidden) {
    return (
      <div role="note" className="space-y-1 border-t border-hairline py-8 text-sm text-ink-mid">
        <p className="eyebrow">Sin permiso</p>
        <p>{forbidden}</p>
      </div>
    );
  }
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
          <Skeleton
            key={i}
            className={
              skeleton === "cards"
                ? "h-24 w-full"
                : skeleton === "line"
                  ? "h-4 w-56"
                  : "h-10 w-full"
            }
          />
        ))}
      </div>
    );
  }
  return <>{children}</>;
}

// Salud: un punto del color de estado y la palabra. Rojo, ámbar y verde solo significan estado.
const TONE: Record<string, { dot: string; text: string }> = {
  green: { dot: "bg-state-ok", text: "text-ink-mid" },
  yellow: { dot: "bg-state-watch", text: "text-state-watch" },
  red: { dot: "bg-state-alarm", text: "text-state-alarm" },
};
export function HealthDot({ value }: { value?: string | null }) {
  const label = value === "red" ? "En riesgo" : value === "yellow" ? "Atención" : "Sano";
  const tone = TONE[value ?? "green"] ?? TONE.green;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone.text}`}>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${tone.dot}`} />
      {label}
    </span>
  );
}

const KPI_SIZE = {
  hero: { box: "rounded-lg border bg-card p-5", value: "metric mt-1" },
  normal: {
    box: "min-w-0 rounded-lg border bg-card p-4",
    value: "metric mt-1 break-words",
  },
  compact: {
    box: "min-w-0 rounded-lg border bg-card px-4 py-3",
    value: "mt-1 break-words font-display text-xl tabular-nums",
  },
  inline: { box: "", value: "mt-1 font-mono text-lg" },
} as const;

/**
 * The one figure card (SDD-20261031-ux-legibility-contrast). `size` keeps the density each screen had:
 * `hero` (Inicio, Pipeline), `normal` (Métricas, finanzas, self-service), `compact` (Leads, presupuesto),
 * `inline` (no card, inside a panel). `tone` colors the figure: `alarm` (red) for risk, `signal` (indigo)
 * only for a selected or actionable figure; `hintTone` colors the hint the same way.
 */
export function Kpi({
  label,
  value,
  hint,
  size = "normal",
  tone,
  hintTone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  size?: keyof typeof KPI_SIZE;
  tone?: "signal" | "alarm";
  hintTone?: "signal" | "alarm";
}) {
  const k = KPI_SIZE[size];
  const valueColor = tone === "alarm" ? "text-state-alarm" : tone === "signal" ? "text-signal" : "";
  const hintColor =
    hintTone === "signal"
      ? "text-signal"
      : hintTone === "alarm"
        ? "text-state-alarm"
        : "text-muted-foreground";
  return (
    <div className={k.box}>
      <p className="eyebrow">{label}</p>
      <p className={`${k.value} ${valueColor}`}>{value}</p>
      {hint != null && hint !== "" && <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>}
    </div>
  );
}

/** The one titled panel; `action` is the optional link or button at the end of the title row. */
export function Panel({
  title,
  action,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="section-title min-w-0">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
