import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-none border-0 border-b border-hairline-firm bg-paper-sunk px-2 py-2 text-base placeholder:text-ink-faint aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-red disabled:cursor-not-allowed disabled:text-ink-faint md:text-sm",
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
