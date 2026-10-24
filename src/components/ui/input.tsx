import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, ...props }, ref) => {
    return (
      <input
        type={type}
        // A number field selects its value on focus, so typing replaces it instead of
        // concatenating (80 → «9780» when you meant 97).
        onFocus={(e) => {
          if (type === "number") e.currentTarget.select();
          onFocus?.(e);
        }}
        className={cn(
          "flex h-10 w-full md:h-9 rounded-lg border border-hairline-firm bg-card shadow-xs focus-visible:border-blue px-3 py-1 text-base tabular-nums transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-faint aria-[invalid=true]:border-state-alarm disabled:cursor-not-allowed disabled:text-ink-faint md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
