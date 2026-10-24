// From the Finance Dashboard (src/lib/motion.ts): the measuring and staging hooks its charts are built on.
import { useEffect, useRef, useState } from "react";

/** True once `delay` ms have elapsed since mount (the page-load sequence of the charts). */
export function useStage(delay: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

/** Observed width/height of an element, for responsive SVG charts. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [rect, setRect] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setRect({ width: r.width, height: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setRect({ width: r.width, height: r.height });
    return () => ro.disconnect();
  }, []);
  return { ref, ...rect };
}
