import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-all active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-ink-faint [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // La acción principal de la pantalla: lima con texto tinta.
        default: "bg-lime text-lime-foreground shadow-xs hover:brightness-95 disabled:bg-paper-sunk disabled:shadow-none",
        // Solo destructivas con confirmación.
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-paper-sunk",
        outline: "border border-hairline bg-card text-ink shadow-xs hover:bg-paper-sunk disabled:border-hairline",
        // Secundaria fuerte: tinta.
        secondary: "bg-ink text-ink-reverse hover:bg-ink/85 disabled:bg-paper-sunk",
        ghost: "text-ink hover:bg-paper-sunk",
        link: "h-auto px-0 text-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 md:h-9",
        sm: "h-9 rounded-md px-3 text-xs md:h-7",
        lg: "h-11 px-6",
        icon: "h-10 w-10 md:h-9 md:w-9",
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
