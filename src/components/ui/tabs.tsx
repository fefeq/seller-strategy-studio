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
  const [more, setMore] = React.useState<{ start: boolean; end: boolean }>({ start: false, end: false });
  React.useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const update = () => setMore({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", update); ro?.disconnect(); };
  }, []);
  const fade = more.start && more.end
    ? "[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]"
    : more.end ? "[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
    : more.start ? "[mask-image:linear-gradient(to_right,transparent,black_28px)]" : "";
  return (
    <TabsPrimitive.List
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "inline-flex h-10 max-w-full items-end justify-start gap-6 overflow-x-auto overflow-y-hidden bg-transparent p-0 text-ink-mid shadow-[inset_0_-1px_0_var(--color-hairline)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
      "inline-flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-0 pb-2 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.14em] cursor-pointer transition-colors hover:text-ink disabled:pointer-events-none disabled:text-ink-faint disabled:cursor-not-allowed data-[state=active]:border-red data-[state=active]:text-ink",
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
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
