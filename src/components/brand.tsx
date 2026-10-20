import { cn } from "@/lib/utils";

/**
 * La llave de Nokko: tres líneas entran, una llave roja las recoge, una línea sale.
 * Las líneas toman el color del texto (tinta) y la llave usa el rojo del tema.
 */
export function Brace({ className, title = "Nokko" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={cn("h-6 w-auto", className)} role="img" aria-label={title} fill="none">
      <path d="M0 6h16M0 16h16M0 26h16" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="M20 3c4 0 5 1.5 5 5v4c0 2.5 1.2 4 4 4-2.8 0-4 1.5-4 4v4c0 3.5-1 5-5 5"
        stroke="var(--color-red)"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      <path d="M31 16h17" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

/** Lockup: la llave y «Nokko» en Bodoni Moda 400. La marca se escribe así, nunca en mayúsculas. */
export function Lockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <Brace className="h-6" />
      <span className="font-display text-[28px] leading-none tracking-normal">Nokko</span>
    </span>
  );
}
