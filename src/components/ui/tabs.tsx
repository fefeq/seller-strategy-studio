import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * Tab row. When the tabs don't fit (phones), it scrolls sideways and fades the edge that has
 * more tabs behind it, so it's clear there's more to swipe to.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const inner = React.useRef<HTMLDivElement | null>(null);
  const [more, setMore] = React.useState<{ start: boolean; end: boolean }>({
    start: false,
    end: false,
  });
  React.useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const update = () =>
      setMore({
        start: el.scrollLeft > 2,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, []);
  const fade =
    more.start && more.end
      ? "[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]"
      : more.end
        ? "[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
        : more.start
          ? "[mask-image:linear-gradient(to_right,transparent,black_28px)]"
          : "";
  return (
    <TabsPrimitive.List
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "inline-flex h-[3.25rem] max-w-full items-center justify-start gap-1 overflow-x-auto md:h-10 overflow-y-hidden rounded-lg bg-paper-sunk p-1 text-ink-mid [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        fade,
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-11 shrink-0 md:h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium cursor-pointer transition-all hover:text-ink disabled:pointer-events-none disabled:text-ink-faint disabled:cursor-not-allowed data-[state=active]:bg-card data-[state=active]:text-ink data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-6", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
