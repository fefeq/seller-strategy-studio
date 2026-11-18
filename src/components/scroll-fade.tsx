import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// SDD-20261118-ux-legibilidad-pantallas-diarias · U-4 · CA-7d: a sideways scroller that, on mount, centres the
// element marked `data-current` (the current quarter) when the content overflows. It never scrolls the page itself.
// Content hidden to the right fades the right edge (like the tab rows do). Content hidden to the left sets
// `data-start="true"`: a fade there would also wash out a sticky first column, so the sticky cells draw a thin edge
// shadow from that attribute instead (`[[data-start=true]_&]:…`).
export function ScrollFade({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  const [start, setStart] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
      setStart(el.scrollLeft > 2);
    };
    if (el.scrollWidth > el.clientWidth) {
      const cur = el.querySelector<HTMLElement>("[data-current]");
      if (cur) el.scrollLeft = cur.offsetLeft - el.clientWidth / 2 + cur.offsetWidth / 2;
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      data-slot="scroll-fade"
      data-start={start ? "true" : undefined}
      className={cn(
        "overflow-x-auto",
        more && "[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
