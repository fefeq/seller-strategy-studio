# Resultado · NK-0148

- **Rama:** `feat/nk-0148-node26-localstorage`. El sha final lo da `git rev-parse HEAD` (este archivo va en el último commit).
- **Base:** `7fe9aedec2f1ae6253c7c9b91d70270e4a24fc4d`
- **Commits:** test (2 archivos), fix (helper `src/lib/safe-storage.ts` + `metrics.tsx` + `guide-card.tsx`), chore (known-failures vacío), style (prettier de `guide-card.tsx`), evidencia, y un commit de rework (`safe-storage.test.ts` con Storage propio en memoria).

## Prueba de autor
| Comprobación | Resultado |
|---|---|
| Fail-first sobre base (Node 22) | `metrics-no-storage.test.tsx` y `safe-storage.test.ts`: «fail-first proven». Revisado test a test: 4/4 casos de la pantalla fallan por `Cannot read properties of undefined (reading 'setItem'/'getItem')` (storage undefined) o `SecurityError: denied` (getter que lanza), en `metrics.tsx:83` y `guide-card.tsx:24`. |
| Pasa en el final | `vitest run`: 299 archivos, 5263 tests, todo verde (Node 22). |
| Mutación | Revertido `metrics.tsx`: los 2 casos de `/metrics` en rojo. Revertido `guide-card.tsx`: los 2 casos de la guía en rojo. Restaurado. |
| tsc / eslint / prettier | tsc 0; eslint 0 y prettier OK en los 5 archivos tocados (guide-card necesitó formato, commit aparte). |
| Fixtures | Datos ficticios, sin red. |

## Rework (revisor): Node 26
- **Defecto:** `safe-storage.test.ts` asumía un `localStorage` real. En Node 26 fallaban 4 tests de ese archivo («reads back what it wrote» y el `afterEach` con `localStorage.clear()` sin protección), así que el ticket quitaba 6 fallos y añadía 4.
- **Arreglo:** el test instala un Storage en memoria con `vi.stubGlobal("localStorage", ...)` solo en el caso que necesita almacenamiento funcional; `afterEach` hace `vi.unstubAllGlobals()` y restaura (o borra) el descriptor original. Nunca toca ni limpia el global real. Los casos undefined / que lanza / cuota quedan igual. Sin timeouts, sin skip/only, aserciones intactas.
- **Fail-first (Node 22) sobre base 7fe9aed:** `safe-storage.test.ts` «fail-first proven». Falla en base porque `@/lib/safe-storage` no existe allí (error de import, afecta a los 4 casos); no es una prueba de comportamiento sobre la base, lo es la mutación de abajo y el test de pantalla.
- **Node 26.13.1 (`npx node@26`):** los 3 archivos (`safe-storage`, `metrics-no-storage`, `metrics-states`): 51/51. `vitest run` completo: 299 archivos, 5263 tests, 0 fallos. No quedan fallos preexistentes en Node 26, así que no hay nada que listar ni probar en base.
- **Node 22.23.4:** los mismos 3 archivos 51/51; `vitest run` completo 299 archivos, 5263 tests, 0 fallos. `tsc` 0; eslint 0 y prettier OK en `safe-storage.test.ts`.

## CA-3: accesos sin protección fuera de lo tocado
- `src/components/suggestions.tsx` líneas 83 y 85 (`sessionStorage.getItem/setItem` en un `useEffect`, sin try/catch). No arreglado: pantalla no tocada.
- Con protección ya: `theme-toggle.tsx`, `route.tsx` (shell), `auth.tsx`, `analytics.ts`, `use-setup-guide.ts`, `stale-module.ts` (try/catch propio, sin pasar por el helper).

## Lo que NO se afirma
- Que la guía de Inicio y `/metrics` se vean bien en un navegador real o en móvil/escritorio, claro/oscuro: no hay cambio de UI y no se comprobó visualmente.
- Que el comportamiento sea correcto con Node 26 en otros entornos (p. ej. con `--localstorage-file`): solo se probó el valor por defecto de 26.13.1 (sin ese flag, aviso `ExperimentalWarning`).
- `metrics-states.test.tsx` no se modificó; sus 6 entradas se quitaron de `known-failures.json` (ahora `{ "tests": [] }`) y pasan en Node 22 y 26.
- Con el storage roto, la guía de Inicio no recuerda «ocultar» entre recargas (solo en memoria); es el comportamiento degradado esperado.
- El conteo 5263 vs la línea base 5252 (+11) no está desglosado: mis tests nuevos son 8.
- `suggestions.tsx` sigue sin proteger (CA-3), fuera de las pantallas tocadas.
