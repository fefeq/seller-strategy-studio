import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// SDD-20261118-ux-legibilidad-pantallas-diarias · U-4 · CA-7d: a sideways scroller that fades its right edge while
// there is more to the right (like the tab rows do) and, on mount, centres the element marked `data-current`
// (the current quarter) when the content overflows. It never scrolls the page itself.
export function ScrollFade({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
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
