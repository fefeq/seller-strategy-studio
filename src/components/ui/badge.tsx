import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-none border-0 border-b-2 bg-transparent px-0 pb-0.5 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.14em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-ink text-ink",
        secondary: "border-hairline-firm text-ink-mid",
        destructive: "border-state-alarm text-red",
        outline: "border-hairline-firm text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
