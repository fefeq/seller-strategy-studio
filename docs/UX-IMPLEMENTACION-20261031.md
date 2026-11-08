# Implementación UX · 31 oct 2026 (paleta, legibilidad, duplicados de «Ganado», mover sin arrastrar)

**Dónde:** worktree `seller-strategy-studio-ux-20261031`, rama local `feat/ux-graphite-legibility-move`, creada desde `origin/main` (dcea201). **Sin commit, sin push, sin desplegar.**
**Verificado:** `tsc --noEmit` limpio · `vitest run` 130 archivos, 2.612 tests en verde (la base eran 121 archivos y 1.129 tests) · `bun run build` correcto · revisión independiente de código (agente sin contexto, no es el gate `nokko-gate`) con sus hallazgos corregidos.
**No verificado:** la app en vivo (exige sesión), claro y oscuro a 375 y 1440 px, gestos táctiles reales, lectores de pantalla, Safari y Firefox con Espacio, y el gate `nokko-gate`.

## Qué hay, por SDD
| SDD | Qué se hizo | Archivos clave |
|---|---|---|
| Paleta Grafito e índigo | Valores de §6 en `:root` y `.dark`; acento índigo en lugar del lima; fondo suave en menú lateral y pestañas activas; series de gráficos; correos, página de error, color del navegador, manifiesto y favicon | `src/styles.css`, `src/lib/palette.test.ts` |
| A · Legibilidad | 87 usos de texto de 10-11 px → 12 px (más gráficos, `smallcaps` y correo diario); 25 selectores → `NativeSelect` (dos densidades); 11 copias de Kpi/Stat/Panel → `Kpi` y `Panel` en `page.tsx` | `src/components/native-select.tsx`, `src/components/page.tsx`, `src/lib/ui-*.test.ts` |
| Bug duplicados de Ganado | Una solicitud pendiente por deal, aviso si ya está pendiente o ya Ganado, marca «Pendiente de aprobación», bloqueo de otros movimientos mientras tanto, mismo criterio en el agente; índice único en la base | `src/lib/won-approval.ts`, `drizzle/migrations/0074_one_pending_won_request_per_deal.sql` |
| B · Mover sin arrastrar | «Mover a…» en cada tarjeta de Pipeline y en el menú de Leads; arrastre con ratón, táctil (pulsación larga de 300 ms) y teclado (Espacio, flechas, Escape) con anuncios en español; «Deshacer» 5 s en movimientos entre etapas abiertas | `src/lib/board-move.ts`, `src/components/board-dnd.tsx`, `src/components/move-menu.tsx` |

## Desviaciones respecto a los SDD (para el §18 de cada uno)
- **Paleta:** `paper-edge` (no definido en el SDD) pasa a `#f1f1ee`; `hairline-firm` no se toca (contraste de bordes de campos queda pendiente, §16 del SDD). En oscuro, `--destructive-foreground` pasa a `#101216`: el blanco sobre `#f87171` daba 2,77:1 (lo descubrió el test de CA-2).
- **Iconos PNG:** `public/manifest.webmanifest` los referencia (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) pero **no existen en `public/` de `origin/main`**; no había nada que rehacer. Sí se cambió el favicon.
- **A:** `Kpi` tiene cuatro tamaños (`hero`, `normal`, `compact`, `inline`), no dos, porque hoy hay cuatro y CA-11 pedía conservar la densidad de cada pantalla. Cambios visibles menores: las cifras de Métricas y finanzas bajan a `text-2xl` en móvil; el presupuesto trimestral pasa de `p-3` a `px-4 py-3`.
- **A:** la prueba de CA-4 (textos de pantallas) sigue siendo manual (hueco declarado en el SDD).
- **B:** se añade `@dnd-kit/core` (dependencia nueva, sugerida por el SDD). El menú de «Ganado» en Pipeline sí se ofrece porque el bug de duplicados va en la misma rama.
- **Bug:** CA-5 (marca al aplicar u omitir) se prueba en la lógica pura (`pendingWonDealIds`), no con una prueba de pantalla.

## Antes de producción (decisiones y comprobaciones)
1. **Migración 0074:** falla si ya hay solicitudes de «Ganado» duplicadas. La comprobación (solo lectura) está en la cabecera del archivo; el 2026-10-31 devolvía cero filas en la base del proyecto de Lovable (**[Por verificar]** que sea la de producción). Se aplica a mano, como las anteriores (`APLICAR-MIGRACIONES-GUIA.md`), antes de publicar el código nuevo. Otras ramas pueden estar usando el número 0074.
2. **Probar a mano:** Espacio en el tarjeta (¿abre el deal al soltar?) en Safari y Firefox; pulsación larga en iPhone (menú del sistema); foco tras mover con teclado (la tarjeta se remonta y el foco va al cuerpo de la página); `Deshacer` con otro cambio de probabilidad entre medias.
3. **Pendientes menores de la revisión:** el deshacer protege por etapa, no por probabilidad; la marca de pendiente no se refresca en vivo; el menú del agente permite editar otros campos de un deal con solicitud pendiente (a propósito).
4. **Gate:** pasar `nokko-gate` desde una sesión abierta en el repo; después, aprobación de entrega de Fede y publicación por Fede.
