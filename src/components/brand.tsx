import { cn } from "@/lib/utils";

// Marca de Nokko, copiada del design system «Nokko — Edición» (assets/Marca). No redibujar.
// Las líneas toman el color del texto (tinta) y la llave el rojo del tema.

const LINES = ["M3 16 H23", "M3 32 H23", "M3 48 H23", "M47 32 H61"];
const CURVE = "M29 9 C 36 9, 33.5 27, 43 32 C 33.5 37, 36 55, 29 55";
// «Nokko» en Jost 500, en contornos (nokko-lockup.svg). El viewBox va a 229 de ancho: el del archivo (223) recorta la última «o».
const WORDMARK =
  "M58.9 -70V-23L7.8 -73.5V0H19.4V-47L70.5 3.5V-70ZM81.7 -23Q81.7 -16 84.95 -10.55Q88.2 -5.1 93.85 -2.05Q99.5 1 106.5 1Q113.6 1 119.2 -2.05Q124.8 -5.1 128.05 -10.55Q131.3 -16 131.3 -23Q131.3 -30.1 128.05 -35.5Q124.8 -40.9 119.2 -43.95Q113.6 -47 106.5 -47Q99.5 -47 93.85 -43.95Q88.2 -40.9 84.95 -35.5Q81.7 -30.1 81.7 -23ZM92.8 -23Q92.8 -27.3 94.6 -30.6Q96.4 -33.9 99.5 -35.7Q102.6 -37.5 106.5 -37.5Q110.4 -37.5 113.5 -35.7Q116.6 -33.9 118.4 -30.6Q120.2 -27.3 120.2 -23Q120.2 -18.7 118.4 -15.45Q116.6 -12.2 113.5 -10.35Q110.4 -8.5 106.5 -8.5Q102.6 -8.5 99.5 -10.35Q96.4 -12.2 94.6 -15.45Q92.8 -18.7 92.8 -23ZM141.2 -78V0H151.8V-78ZM168.7 -46 148.9 -27 170.8 0H184L162.1 -27L182 -46ZM190.7 -78V0H201.3V-78ZM218.2 -46 198.4 -27 220.3 0H233.5L211.6 -27L231.5 -46ZM237.1 -23Q237.1 -16 240.35 -10.55Q243.6 -5.1 249.25 -2.05Q254.9 1 261.9 1Q269 1 274.6 -2.05Q280.2 -5.1 283.45 -10.55Q286.7 -16 286.7 -23Q286.7 -30.1 283.45 -35.5Q280.2 -40.9 274.6 -43.95Q269 -47 261.9 -47Q254.9 -47 249.25 -43.95Q243.6 -40.9 240.35 -35.5Q237.1 -30.1 237.1 -23ZM248.2 -23Q248.2 -27.3 250 -30.6Q251.8 -33.9 254.9 -35.7Q258 -37.5 261.9 -37.5Q265.8 -37.5 268.9 -35.7Q272 -33.9 273.8 -30.6Q275.6 -27.3 275.6 -23Q275.6 -18.7 273.8 -15.45Q272 -12.2 268.9 -10.35Q265.8 -8.5 261.9 -8.5Q258 -8.5 254.9 -10.35Q251.8 -12.2 250 -15.45Q248.2 -18.7 248.2 -23Z";

/** La llave de línea: tres líneas entran, una llave roja las recoge, una línea sale. Desde 32px; por debajo, `Isotipo`. */
export function Brace({ className, title = "Nokko" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 7 64 50"
      className={cn("h-8 w-auto", className)}
      role="img"
      aria-label={title}
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="2.6">
        {LINES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d={CURVE} stroke="var(--color-series-3)" strokeWidth="3.6" />
    </svg>
  );
}

/** Lockup: la llave y el wordmark «Nokko». Mínimo 140px de ancho. La marca se escribe así, nunca en mayúsculas. */
export function Lockup({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 229 64"
      className={cn("h-[41px] w-auto text-ink", className)}
      role="img"
      aria-label="Nokko"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="2.6">
        {LINES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d={CURVE} stroke="var(--color-series-3)" strokeWidth="3.6" />
      <g transform="translate(86,50.28) scale(0.4908)">
        <path d={WORDMARK} fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * El isotipo sólido (nokko-icono.svg): placa en tinta, barras en papel, llave roja. Para menos de 32px:
 * icono de app, favicon, avatar. En el tema tinta la placa pasa a papel y la llave a `red` (nokko-icono-tinta.svg).
 */
export function Isotipo({ className, title = "Nokko" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8 text-lime", className)}
      role="img"
      aria-label={title}
    >
      <rect width="64" height="64" fill="var(--color-ink)" />
      <g fill="var(--color-paper)">
        <rect x="11" y="14.5" width="19" height="6" />
        <rect x="11" y="29" width="19" height="6" />
        <rect x="11" y="43.5" width="19" height="6" />
      </g>
      <path
        d="M35 11 C 45 11, 41.5 28, 53 32 C 41.5 36, 45 53, 35 53"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
    </svg>
  );
}
