# SDD-20261106-ux-metrics-data-state · [Mejora] NK-0051 ampliado, C2: explicaciones plegadas y una sola forma para el estado de un dato

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador (v2: nace al partir `SDD-20261106-ux-core-screens-pattern` tras el gate; este es C2) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06 · **Ticket:** NK-0051 (ampliación)
**PRD:** No aplica (mejora acotada; contexto en `docs/UX-INFORME-20261031.md`, punto 7) · **Depende de:** `SDD-20261106-metrics-honest-data` (SDD-A, textos de datos), `SDD-20261106-ux-core-screens-pattern` (C1), y `Kpi`/`Panel` compartidos y suelo de 12 px de `SDD-20261031-ux-legibility-contrast` · **Coordinar con:** `SDD-20261025-theory-u-proactive-decision-support`

> Sprint 1 de mejoras en pantallas core, bloque C2.

**Contrato entre los SDD del sprint (el mismo texto en A, B, C1 y C2):** A cambia datos y textos de datos de `/metrics`; B, la búsqueda de `/hub`; C1, estados de pantalla (carga, error, vacío), sección en la URL, vacíos y pistas de `/hub` y `/theory-u`; C2, el plegado de explicaciones en las tres pantallas y la forma del estado de un dato en `/metrics`. Orden de integración: A → B → C1 → C2.

## 1. Resumen
Las explicaciones de cálculo ocupan varias líneas fijas antes de la cifra, y el estado de un dato se escribe de formas distintas («—», «estimado», textos libres). C2 pliega las explicaciones largas detrás de «Cómo se calcula» y da una única forma visual a «Real», «Estimado · motivo» y «Sin dato · motivo», usando las palabras que fija SDD-A.

## 2. Problema y para quién
Owner y Sales Leader en `/metrics`; cualquier persona del equipo en Theory U y Conocimiento.

## 3. Evidencia y por qué ahora
Leído en `main` @ `f76f639` y revisado por el gate en la v1 conjunta (informe completo en el §17 de `SDD-20261106-ux-core-screens-pattern`).
- **Explicaciones largas fijas** (líneas de texto secundario de más de 200 caracteres de código; aproximación con `awk`): `self-service-funnel.tsx` 4, `leads/lead-funnel-panel.tsx` 4, `segment-coverage.tsx` 3, `metrics/finance-panel.tsx` 2, `cac-panel.tsx` 1, `quarter-kpis-panel.tsx` 1, `budget-panel.tsx` 1; en Theory U, `listening.tsx:49`, `case-clinic.tsx:54`, `prototypes.tsx:80` (leídos), y coincidencias en `journey.tsx`, `sensing.tsx` y `hub.tsx` por confirmar. La lista cerrada la fija U-1 y la aprueba Fede.
- **Formas del estado de un dato en `/metrics`:** ~50 líneas con «—» en 9 archivos (gate). No todos significan «falta el dato»: algunos son «no aplica» (p. ej. `revops-panels.tsx:83`, win rate sin cerrados).
- `src/components/ui/collapsible.tsx` existe (Radix) y no se usa; el código usa `<details>` en 10 sitios (p. ej. `briefing.tsx:65`).

## 4. Resultado buscado
Explicaciones de la lista cerrada fijas en pantalla: objetivo 0. Marcas de dato de la lista cerrada fuera del componente: objetivo 0. Uso: sin dato.

## 5. Alcance
**Incluye:** `HowCalculated` y su uso en la lista cerrada de explicaciones de `/metrics`, `/theory-u` y `/hub`; `DataState` y su uso en la lista cerrada de marcas de dato de `/metrics` (incluidas las que añade SDD-A).
**No incluye:** las palabras de las marcas (las fija SDD-A); estados de carga y vacío (C1); paleta y tamaños (otros SDD de NK-0051); «—» que significan «no aplica».

## 6. Cambios de comportamiento (delta)
**Añadido:** «Cómo se calcula» / «Ocultar cálculo»; componente de estado de dato.
**Modificado:** explicaciones de la lista cerrada, plegadas; marcas de la lista cerrada, con una sola forma.
**Eliminado:** nada (las explicaciones siguen accesibles).

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero ver la cifra antes que la explicación.
- **CA-1** Cada explicación de la lista cerrada (archivo:línea, más de 160 caracteres de texto visible) está detrás de «Cómo se calcula», cerrada por defecto, que se abre con teclado y ratón y anuncia su estado (`aria-expanded`). · prueba: `src/components/how-calculated.test.tsx` (componente) y `src/components/metrics/how-calculated-usage.test.tsx` (render de la lista cerrada)

### H-2: Como Owner o Sales Leader, quiero saber de un vistazo si una cifra es real.
- **CA-2** Cada marca de la lista cerrada de `/metrics` usa `DataState` con una de tres palabras, «Real», «Estimado» o «Sin dato», más « · motivo» cuando lo hay; el color solo acompaña a la palabra. Los «—» de «no aplica» quedan fuera y están listados como tales. · prueba: `src/components/data-state.test.tsx` y `src/components/metrics/data-state-usage.test.tsx`

## 8. Casos límite y errores
- Móvil: el desplegable no tapa la cifra; se abre debajo.
- Una explicación de una sola línea no se pliega.
- Lectores de pantalla: la palabra del estado se lee; el color no aporta información sola.

## 9. Experiencia y copy
«Cómo se calcula» / «Ocultar cálculo». «Real», «Estimado · motivo», «Sin dato · motivo» (palabras de SDD-A). Español, «tú», sin iconos.

## 10. Datos, permisos y privacidad
Sin cambios de datos ni consultas.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Lista cerrada de explicaciones (aprobada por Fede) y `HowCalculated` aplicado | CA-1 | `src/components/how-calculated.test.tsx` |
| U-2 | Lista cerrada de marcas de dato («falta» frente a «no aplica») y `DataState` aplicado | CA-2 | `src/components/data-state.test.tsx` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `HowCalculated` sobre `src/components/ui/collapsible.tsx` (da `aria-expanded`) o `<details>`, el que cumpla mejor CA-1.
- `DataState` junto a `Empty` en `src/components/page.tsx`. Si SDD-A se construye antes, A entrega sus textos con un envoltorio mínimo y U-2 los pasa al componente sin cambiar las palabras, de modo que los tests de A no cambian.

## 14. Riesgos y dependencias
- Depende de SDD-A y de `Kpi`/`Panel` compartidos (NK-0051, sin código en el remoto). Si estos se retrasan, C2 espera.

## 15. Preguntas para Fede y para la revisión técnica
1. Umbral para plegar: 160 caracteres visibles. ¿Te vale?

## 16. Pendiente de verificar
- Coincidencias de explicaciones largas en `journey.tsx`, `sensing.tsx`, `hub.tsx`: U-1.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado (la v1 conjunta la revisó; ver §17 de C1)

## 18. Delta de implementación (lo rellena el agente al entregar)
—
