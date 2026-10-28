# SDD-20261025-field-actions-edit-delete-confirm · [Feature] Editar, borrar y confirmar en campos

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-2) · **Depende de:** SDD-20261025-universal-field-definitions (estado de origen/confirmación)

## 1. Resumen
Hoy muchos datos se pueden crear pero no editar, borrar ni confirmar después (onboarding, ICP, pilares, fuentes). Se quiere un conjunto de acciones común —**editar, borrar, confirmar, deshacer**— disponible en todo campo o elemento donde tenga sentido, con las mismas reglas en cada pantalla y en el Agente.

## 2. Problema y para quién
Founder que revisa lo que NOKKO leyó o propuso y no puede corregirlo donde lo ve; pierde ediciones al salir; no puede quitar una fuente equivocada; no puede marcar "esto es correcto".

## 3. Evidencia y por qué ahora
Fuente: lectura del código del repo (2026-10-25), sin datos de uso (sin dato):
- ICP y pilares existentes: no hay edición ni borrado desde su vista (`icp-editor`, `strategy/positioning`). **[Por verificar]** en la revisión técnica si existe otra vía.
- Las ediciones en pantalla son estado local: se pierden al salir sin guardar.
- Fuentes del onboarding: no se pueden quitar; además, al añadir archivos la lista se reemplaza en lugar de acumularse (`SourcesStep`, `setFiles(read.filter(...))`): fallo confirmado en `src/components/onboarding/sources.tsx:35` y en `src/components/setup/ai-fill.tsx:40` (verificado el 2026-10-28); lo cubre CA-12.
- Tras el onboarding no hay confirmación por campo; el asistente de configuración guarda sin revisión ni deshacer.
- Hay deshacer de guardado en Configuración (`undoSetupItems`), pero no en el resto.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de bloques/campos de estrategia con estado "Confirmado" por empresa (fuente: base de datos, tras SDD universal). Línea base: sin dato.
- Casos de datos errados corregidos sin intervención de soporte (fuente: sin dato; se medirá con registro de ediciones).
Cubre el objetivo G-2 del PRD.

## 5. Alcance
**Incluye:** acciones editar/borrar/confirmar/deshacer en: campos de empresa, ICP, segmentos, posicionamiento y pilares, fuentes del onboarding, hallazgos leídos, resultados de Descubiertos que se guardan como dato de estrategia; guardado de borradores; mismas acciones disponibles al Agente.
**No incluye:** edición masiva por CSV; cambios de diseño global; borrado de cuentas/leads del CRM (otro flujo); gestión de miembros.

## 6. Cambios de comportamiento (delta)
**Añadido:** acciones por elemento; confirmación por campo; deshacer ampliado; aviso de cambios sin guardar; quitar fuente.
**Modificado:** guardado del asistente de configuración (antes: guarda directo; después: muestra revisión y permite deshacer).
**Eliminado:** pérdida silenciosa de ediciones.

### Casos a cubrir (catálogo)
| Caso | Hoy | Después |
|---|---|---|
| ICP existente | solo crear | editar y archivar |
| Pilares de posicionamiento | solo crear | editar y borrar |
| Campos del onboarding | confirmar por bloque | además por campo |
| Fuentes | añadir | añadir y quitar |
| Hallazgos de lectura | ver | confirmar, editar, descartar |
| Competidores añadidos por Descubiertos | se añaden solos | confirmar o quitar |
| Asistente de configuración | guarda directo | revisar, confirmar, deshacer |

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero editar cualquier dato de mi estrategia donde lo veo.
- CA-1: CUANDO pulso editar en un elemento permitido, el sistema DEBE permitirme cambiar su valor y guardarlo. · cubre G-2 · prueba: `src/lib/field-actions.test.ts` (parcial: solo el permiso de editar y confirmar)
- CA-2: CUANDO guardo, el sistema DEBE marcar el valor como escrito por mí y confirmado. · cubre G-2 · prueba: `src/lib/field-actions.test.ts`
- CA-3: SI tengo cambios sin guardar y abandono la pantalla, ENTONCES el sistema DEBE avisarme y ofrecer guardar o descartar. · cubre G-2 · prueba: `src/lib/field-actions.test.ts`

### H-2: Como founder, quiero borrar lo que no quiero.
- CA-4: CUANDO borro un elemento, el sistema DEBE pedir confirmación indicando qué se pierde y dónde se usa. · cubre G-2 · prueba: por nombrar en el brief
- CA-5: CUANDO borro o guardo un cambio, el sistema DEBE ofrecer deshacer durante 24 horas (decidido por Fede). · cubre G-2 · prueba: por nombrar en el brief
- CA-6: SI el elemento está en uso por otra parte de la estrategia, ENTONCES el sistema DEBE avisarlo y permitir archivar en lugar de borrar. · cubre G-2 · prueba: por nombrar en el brief
- CA-7: SI mi rol no permite borrar, ENTONCES el sistema DEBE ocultar o desactivar la acción y explicar por qué. · cubre G-2 · prueba: `src/lib/field-actions.test.ts`

### H-3: Como founder, quiero confirmar lo que NOKKO propuso.
- CA-8: CUANDO confirmo un campo, el sistema DEBE cambiar su estado a Confirmado y registrar quién y cuándo. · cubre G-2 · prueba: `src/lib/field-actions.test.ts`
- CA-9: El sistema DEBE permitir confirmar varios campos a la vez dentro de un bloque. · cubre G-2 · prueba: `src/lib/field-actions.test.ts`
- CA-10: CUANDO todos los campos de un bloque están confirmados, el sistema DEBE marcar el bloque como Confirmado. · cubre G-2 · prueba: `src/lib/field-actions.test.ts`

### H-4: Como founder, quiero quitar una fuente equivocada.
- CA-11: CUANDO quito una fuente del onboarding, el sistema DEBE indicar qué hallazgos dependen de ella y permitir mantenerlos o descartarlos. · cubre G-2 · prueba: por nombrar en el brief
- CA-12: CUANDO añado archivos a una lista existente, el sistema DEBE conservar los ya listados. · cubre G-2 · prueba: por nombrar en el brief

### H-5: Como founder, quiero hacer lo mismo desde el Agente.
- CA-13: CUANDO pido al Agente editar, borrar o confirmar un elemento, el sistema DEBE mostrar la acción propuesta y ejecutarla solo tras mi aprobación. · cubre G-2 · prueba: por nombrar en el brief
- CA-14: El sistema DEBE aplicar al Agente las mismas reglas de rol y deshacer que a la pantalla. · cubre G-2 · prueba: por nombrar en el brief

## 8. Casos límite y errores
- Edición simultánea por dos miembros: el sistema DEBE avisar del conflicto y mostrar ambas versiones (CA-1).
- Fallo de guardado: conservar el valor y permitir reintento (CA-3).
- Valor vacío en campo obligatorio: no permitir guardar y explicar (CA-1).
- Un proceso automático propone otro valor sobre uno confirmado: no sobrescribe; queda como propuesta (ver SDD universal CA-9).
- Deshacer tras expirar el plazo: el sistema DEBE indicar que ya no es posible (CA-5).

## 9. Experiencia y copy
Acciones con palabra, sin iconos: «Editar», «Borrar», «Confirmar», «Deshacer». Confirmación de borrado: «Vas a borrar *X*. Se usa en *Y*. ¿Archivar o borrar?». Todo en «tú», diseño Nokko Edición.

## 10. Datos, permisos y privacidad
Se guarda registro de quién y cuándo edita/borra/confirma. Solo el Owner borra, también fuentes del onboarding y hallazgos (decidido por Fede, 2026-10-28). Hoy la matriz de `src/lib/field-actions.ts:21-22` deja borrarlos a cualquier miembro y hay que corregirla (CA-7). Respetar roles por empresa. Sin datos de terceros nuevos.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | regla (las acciones son deterministas) | no aplica | sin dato |

El SDD declara (sección 13, notas técnicas): «LLM: ninguna llamada nueva. Las acciones son deterministas.» Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | Cubre | CA que cierra | Test que falla primero |
|---|---|---|---|---|
| U-1 | Componente y reglas comunes de acciones. | H-1, H-3 | CA-1 a CA-3, CA-8 a CA-10 | por nombrar en el brief |
| U-2 | Borrado con uso, archivado y deshacer. | H-2 | CA-4 a CA-7 | por nombrar en el brief |
| U-3 | ICP, pilares y posicionamiento. | H-1, H-2 | CA-1 a CA-7 | por nombrar en el brief |
| U-4 | Fuentes y hallazgos del onboarding. | H-4 | CA-11, CA-12 | por nombrar en el brief |
| U-5 | Acciones desde el Agente. | H-5 | CA-13, CA-14 | por nombrar en el brief |

La columna «CA que cierra» se deriva de las historias que cubre cada unidad.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Reutilizar `applySetupItems`/`undoSetupItems` y las herramientas de escritura del registro del Agente (`src/lib/agent/tools/strategy.ts`).
- Borrado de fuentes en `src/components/onboarding/sources.tsx`; `useOnboarding().save` hace upsert en `onboarding_sessions`.
- LLM: ninguna llamada nueva. Las acciones son deterministas.

## 14. Riesgos y dependencias
- Depende del SDD de definiciones universales para el estado de confirmación.
- Riesgo: borrar datos con dependencias ocultas → CA-6.

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Hay hoy alguna vía de edición/borrado de ICP y pilares no visible en la interfaz?
2. Plazo para deshacer: decidido por Fede, 24 horas (CA-5).
3. Fallo de lista de fuentes: confirmado (ver sección 3); lo cubre CA-12.

## 16. Pendiente de verificar
- [Por verificar] Vías existentes de edición de ICP/pilares.
- Fallo de acumulación de archivos: confirmado el 2026-10-28 (ver sección 3); lo cubre CA-12.
- [Por verificar] Uso real de la función deshacer (sin dato).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** todos citan G-2 (`PRD:25`). Hay ocho CA que no tienen prueba: CA-4, CA-5, CA-6 y CA-11 a CA-14 dicen «por nombrar» (`SDD:55-71`). El test de CA-3 solo comprueba `isDirty` y `blocksLeaving` (`field-actions.test.ts:40-52`), no el aviso que ve el usuario. CA-2 y CA-8 se prueban con funciones puras (`test:54-69`); la persistencia depende de `0058_field_sources_generic.sql:30`, que no se ha verificado (`SDD:133`). CA-1 está cubierto solo en parte, y el propio SDD lo reconoce (`SDD:50`).
- **[Por verificar] que sigue sin comprobarse:** el fallo de la lista de fuentes es real. `setFiles(read.filter(...))` reemplaza la lista en vez de acumular (`onboarding/sources.tsx:35`), y lo mismo pasa en `setup/ai-fill.tsx:40`. Hay que cerrarlo en `SDD:17`, `SDD:116` y `SDD:120`. El uso real de deshacer sigue sin dato.
- **Contradicciones con el código o con decisiones previas:**
  - `SDD:15` y el catálogo de `SDD:40-41` dicen «solo crear». En `main` ya se editan el ICP (`main:icp-editor.tsx:69`), el posicionamiento y los pilares (`main:strategy/positioning.tsx:51,123`).
  - La matriz deja borrar a cualquier miembro en `onboarding_source` y `finding` (`field-actions.ts:21-22`). Eso choca con «only an org's owner may delete» (`AGENTS.md:14`) y con «borrar, solo el Owner» (`SDD:132`).
  - La pregunta del plazo de deshacer (`SDD:115`) ya está decidida: 24 h (`PRD:48`, `SDD:56`).
  - La métrica «casos corregidos sin soporte» (`SDD:25`) no forma parte de G-2 (`PRD:25`).
  - La sección 11 coincide con la 13 (`SDD:89`, `SDD:107`).
- **Lo que esta revisión NO demuestra:** no ejecuté los tests ni sé si fallan sobre el commit base. No apliqué la migración 0058 ni revisé RLS ni políticas de borrado en la base de datos. Tampoco comprobé si hay otras vías de borrado de ICP o pilares fuera de la interfaz, ni el comportamiento en la app.

## 18. Delta de implementación (agente, 2026-10-26)
- Decisiones de Fede aplicadas (`annex/field-actions-matrix-proposal-20261026.md`): editar y confirmar, cualquier miembro; borrar, solo el Owner; «en uso» y archivado vía registro de cambios con deshacer de 24 h (U-2); procedencia ampliada a posicionamiento, pilares y segmentos (U-3); editar siempre confirma.
- U-1 hecha: matriz y reglas en `src/lib/field-actions.ts`; botones comunes en `src/components/field-actions.tsx`; aviso de cambios sin guardar con `useUnsavedGuard` (CA-3) en el editor de ICP y en la revisión de bloques del onboarding; confirmación por campo, en bloque y por bloque en la ficha de encaje de la cuenta (CA-8 a CA-10). La marca de origen gana quién y cuándo (`confirmedBy`, `confirmedAt`) y el tipo `sin_dato` para confirmar un valor sin origen sin atribuirlo a una persona. La migración 0058 (sin verificar) se ajustó para sellar `confirmedBy` con `auth.uid()`.
- Alcance de la confirmación en U-1: campos de la cuenta con procedencia (`accounts`). Posicionamiento, pilares, segmentos e ICP la reciben en U-3 (migración nueva, sin verificar).

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
