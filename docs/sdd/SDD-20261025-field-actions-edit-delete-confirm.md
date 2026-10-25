# SDD-20261025-field-actions-edit-delete-confirm · [Feature] Editar, borrar y confirmar en campos

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25
**Depende de:** SDD-20261025-universal-field-definitions (estado de origen/confirmación)

## 1. Resumen
Hoy muchos datos se pueden crear pero no editar, borrar ni confirmar después (onboarding, ICP, pilares, fuentes). Se quiere un conjunto de acciones común —**editar, borrar, confirmar, deshacer**— disponible en todo campo o elemento donde tenga sentido, con las mismas reglas en cada pantalla y en el Agente.

## 2. Problema y para quién
Founder que revisa lo que NOKKO leyó o propuso y no puede corregirlo donde lo ve; pierde ediciones al salir; no puede quitar una fuente equivocada; no puede marcar "esto es correcto".

## 3. Evidencia y por qué ahora
Fuente: lectura del código del repo (2026-10-25), sin datos de uso (sin dato):
- ICP y pilares existentes: no hay edición ni borrado desde su vista (`icp-editor`, `strategy/positioning`). **[Por verificar]** con Dani si existe otra vía.
- Las ediciones en pantalla son estado local: se pierden al salir sin guardar.
- Fuentes del onboarding: no se pueden quitar; además, al añadir archivos la lista se reemplaza en lugar de acumularse (`SourcesStep`, `setFiles(read.filter(...))`) — posible fallo, **[Por verificar]**.
- Tras el onboarding no hay confirmación por campo; el asistente de configuración guarda sin revisión ni deshacer.
- Hay deshacer de guardado en Configuración (`undoSetupItems`), pero no en el resto.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de bloques/campos de estrategia con estado "Confirmado" por empresa (fuente: base de datos, tras SDD universal). Línea base: sin dato.
- Casos de datos errados corregidos sin intervención de soporte (fuente: sin dato; se medirá con registro de ediciones).

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
- CA-1: CUANDO pulso editar en un elemento permitido, el sistema DEBE permitirme cambiar su valor y guardarlo.
- CA-2: CUANDO guardo, el sistema DEBE marcar el valor como escrito por mí y confirmado.
- CA-3: SI tengo cambios sin guardar y abandono la pantalla, ENTONCES el sistema DEBE avisarme y ofrecer guardar o descartar.

### H-2: Como founder, quiero borrar lo que no quiero.
- CA-4: CUANDO borro un elemento, el sistema DEBE pedir confirmación indicando qué se pierde y dónde se usa.
- CA-5: CUANDO borro, el sistema DEBE ofrecer deshacer durante un tiempo limitado.
- CA-6: SI el elemento está en uso por otra parte de la estrategia, ENTONCES el sistema DEBE avisarlo y permitir archivar en lugar de borrar.
- CA-7: SI mi rol no permite borrar, ENTONCES el sistema DEBE ocultar o desactivar la acción y explicar por qué.

### H-3: Como founder, quiero confirmar lo que NOKKO propuso.
- CA-8: CUANDO confirmo un campo, el sistema DEBE cambiar su estado a Confirmado y registrar quién y cuándo.
- CA-9: El sistema DEBE permitir confirmar varios campos a la vez dentro de un bloque.
- CA-10: CUANDO todos los campos de un bloque están confirmados, el sistema DEBE marcar el bloque como Confirmado.

### H-4: Como founder, quiero quitar una fuente equivocada.
- CA-11: CUANDO quito una fuente del onboarding, el sistema DEBE indicar qué hallazgos dependen de ella y permitir mantenerlos o descartarlos.
- CA-12: CUANDO añado archivos a una lista existente, el sistema DEBE conservar los ya listados.

### H-5: Como founder, quiero hacer lo mismo desde el Agente.
- CA-13: CUANDO pido al Agente editar, borrar o confirmar un elemento, el sistema DEBE mostrar la acción propuesta y ejecutarla solo tras mi aprobación.
- CA-14: El sistema DEBE aplicar al Agente las mismas reglas de rol y deshacer que a la pantalla.

## 8. Casos límite y errores
- Edición simultánea por dos miembros: el sistema DEBE avisar del conflicto y mostrar ambas versiones (CA-1).
- Fallo de guardado: conservar el valor y permitir reintento (CA-3).
- Valor vacío en campo obligatorio: no permitir guardar y explicar (CA-1).
- Un proceso automático propone otro valor sobre uno confirmado: no sobrescribe; queda como propuesta (ver SDD universal CA-9).
- Deshacer tras expirar el plazo: el sistema DEBE indicar que ya no es posible (CA-5).

## 9. Experiencia y copy
Acciones con palabra, sin iconos: «Editar», «Borrar», «Confirmar», «Deshacer». Confirmación de borrado: «Vas a borrar *X*. Se usa en *Y*. ¿Archivar o borrar?». Todo en «tú», diseño Nokko Edición.

## 10. Datos, permisos y privacidad
Se guarda registro de quién y cuándo edita/borra/confirma. Solo Owner borra donde hoy solo Owner gestiona (respetar roles por empresa). Sin datos de terceros nuevos.

## 11. Unidades de trabajo
- U-1: Componente y reglas comunes de acciones (cubre H-1, H-3).
- U-2: Borrado con uso, archivado y deshacer (cubre H-2).
- U-3: ICP, pilares y posicionamiento (cubre H-1, H-2).
- U-4: Fuentes y hallazgos del onboarding (cubre H-4).
- U-5: Acciones desde el Agente (cubre H-5).

## 12. Notas técnicas [Sugerencia — Dani valida]
- Reutilizar `applySetupItems`/`undoSetupItems` y las herramientas de escritura del registro del Agente (`src/lib/agent/tools/strategy.ts`).
- Borrado de fuentes en `src/components/onboarding/sources.tsx`; `useOnboarding().save` hace upsert en `onboarding_sessions`.
- LLM: ninguna llamada nueva. Las acciones son deterministas.

## 13. Riesgos y dependencias
- Depende del SDD de definiciones universales para el estado de confirmación.
- Riesgo: borrar datos con dependencias ocultas → CA-6.

## 14. Preguntas para Dani
1. ¿Hay hoy alguna vía de edición/borrado de ICP y pilares no visible en la interfaz?
2. ¿Qué plazo razonable para deshacer?
3. ¿El fallo de lista de fuentes que se reemplaza es real?

## 15. Pendiente de verificar
- [Por verificar] Vías existentes de edición de ICP/pilares.
- [Por verificar] Fallo de acumulación de archivos.
- [Por verificar] Uso real de la función deshacer (sin dato).

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
