import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-hairline-firm bg-card shadow-xs focus-visible:border-blue px-2 py-2 text-base placeholder:text-ink-faint aria-[invalid=true]:border-state-alarm disabled:cursor-not-allowed disabled:text-ink-faint md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
