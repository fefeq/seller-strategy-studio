# SDD NK-0168 — Iconografía (entrega 1)
Estado: aprobado por decisiones de Fede 2026-11-13 (docs/decisiones-fede-20261113.md).

## Objetivo
Revocar «sin iconos». Regla nueva: icono siempre con texto visible, un icono por concepto, estados con palabra.

## Alcance entrega 1
- U-1 `IconText` (16 px botones, 20 px navegación, trazo 1,75, icono `aria-hidden`).
- U-2 Mazo de Inicio/Sugerencias: ✕ → `Ban` + texto de la etiqueta izquierda; ✓ → `Check` + texto de la derecha.
- U-3 Menú móvil: ☰/✕ → `Menu` «Menú» / `X` «Cerrar».
- U-4 Guardia `src/lib/icon-rule.test.ts`: fuera de `components/ui` ningún icono lucide se pinta sin `IconText`.
- U-5 Regla en AGENTS.md, EXECUTION.md y skill nokko-shape. SDD vivos quedan como históricos.
- Sin cambio: `›` del rail (aria-label + title), «+ Nuevo…».

## Pendiente (entrega 2)
Aplicar `Trash2/Eraser/Ban/X` a botones de borrar/descartar/cancelar existentes, `Spline` en Theory U y `Cable` en Conectar asistentes; afinar tamaños con capturas.

## Pruebas
- Nuevas: icon-rule.test.ts (2), swipe-deck-icons.test.tsx (1).
- Existente modificada con permiso previo: strategy-screens.test.tsx:421 `getByText("✓")` → texto visible «Hacer» dentro del botón (misma intención: la tarjeta operativa conserva botones de icono).
