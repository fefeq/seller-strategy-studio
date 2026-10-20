import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium cursor-pointer transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-ink-faint [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // solid: la acción que la pantalla defiende. Tinta, no rojo.
        default: "bg-ink text-ink-reverse hover:bg-ink/85 disabled:bg-paper-sunk",
        // alarm: solo destructivas con confirmación.
        destructive: "bg-red text-ink-reverse hover:bg-red/90 disabled:bg-paper-sunk",
        outline: "border border-hairline-firm bg-transparent text-ink hover:bg-paper-sunk disabled:border-hairline",
        secondary: "border border-hairline-firm bg-transparent text-ink hover:bg-paper-sunk disabled:border-hairline",
        ghost: "text-ink hover:bg-paper-sunk",
        // text: lo interactivo es tinta subrayada.
        link: "h-auto px-0 text-ink underline decoration-hairline-firm underline-offset-4 hover:decoration-ink",
      },
      size: {
        default: "h-8 px-4",
        sm: "h-6 px-2.5 text-xs",
        lg: "h-10 px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
