import * as React from "react";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"select">, "size"> & {
  /** `normal` for forms and filters; `compact` for table cells and dense rows. */
  density?: "normal" | "compact";
};

/**
 * The one selection control of the app (SDD-20261031-ux-legibility-contrast): same border, focus and
 * type size everywhere. Pass layout classes only (width, margins); the look comes from `density`.
 * A select without a visible label must carry `aria-label` (checked in `src/lib/ui-select.test.ts`).
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, Props>(
  ({ density = "normal", className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "rounded-md border bg-background px-2 disabled:opacity-60",
        density === "compact"
          ? "h-10 text-sm md:h-8 md:text-xs"
          : "h-10 text-base md:h-9 md:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
NativeSelect.displayName = "NativeSelect";
