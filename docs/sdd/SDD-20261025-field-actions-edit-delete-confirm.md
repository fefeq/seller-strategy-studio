# SDD-20261025-field-actions-edit-delete-confirm · [Feature] Editar, borrar y confirmar en campos

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** En curso (Aprobado por Fede, 2026-10-26; U-1 a U-5 hechas) · **Pide:** Fede · **Para:** Claude Code · **Fecha:** 2026-10-25
**Depende de:** SDD-20261025-universal-field-definitions (estado de origen/confirmación)

## 1. Resumen
Hoy muchos datos se pueden crear pero no editar, borrar ni confirmar después (onboarding, ICP, pilares, fuentes). Se quiere un conjunto de acciones común —**editar, borrar, confirmar, deshacer**— disponible en todo campo o elemento donde tenga sentido, con las mismas reglas en cada pantalla y en el Agente.

## 2. Problema y para quién
Founder que revisa lo que NOKKO leyó o propuso y no puede corregirlo donde lo ve; pierde ediciones al salir; no puede quitar una fuente equivocada; no puede marcar "esto es correcto".

## 3. Evidencia y por qué ahora
Fuente: lectura del código del repo (2026-10-25), sin datos de uso (sin dato):
- ICP y pilares existentes: no hay edición ni borrado desde su vista (`icp-editor`, `strategy/positioning`). **[Por verificar]** en el código (lo comprueba Claude Code) si existe otra vía.
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
- CA-5: CUANDO borro o guardo un cambio, el sistema DEBE ofrecer deshacer durante 24 horas (decidido por Fede).
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

## 12. Notas técnicas [Sugerencia — se valida en la implementación]
- Reutilizar `applySetupItems`/`undoSetupItems` y las herramientas de escritura del registro del Agente (`src/lib/agent/tools/strategy.ts`).
- Borrado de fuentes en `src/components/onboarding/sources.tsx`; `useOnboarding().save` hace upsert en `onboarding_sessions`.
- LLM: ninguna llamada nueva. Las acciones son deterministas.

## 13. Riesgos y dependencias
- Depende del SDD de definiciones universales para el estado de confirmación.
- Riesgo: borrar datos con dependencias ocultas → CA-6.

## 14. Decisiones abiertas (recomendación de Claude)
Las resuelve Claude Code comprobándolas en el código; lo que no pueda comprobar lo decide Fede con la recomendación de Claude. No hay revisor técnico externo.
1. ¿Hay hoy alguna vía de edición/borrado de ICP y pilares no visible en la interfaz?
2. ¿Qué plazo razonable para deshacer?
3. ¿El fallo de lista de fuentes que se reemplaza es real?

## 15. Pendiente de verificar
- [Verificado 2026-10-26 en el repo] Vías de edición de ICP/pilares: la **edición existe** (`icp-editor.tsx`, `positioning.tsx`); lo que falta es borrar y archivar. El punto de la sección 3 («solo crear») es incorrecto en la edición. No hay vías ocultas de borrado. Ver `annex/field-actions-matrix-proposal-20261026.md`.
- [Verificado 2026-10-26 en el repo] Fallo de acumulación: es real. `SourcesStep.onFiles` hace `setFiles(read.filter(...))` y sustituye la lista en cada selección; los textos y nombres sí se acumulan.
- [Por verificar] Uso real de la función deshacer (sin dato; no se puede medir sin datos de uso). Hoy `undoSetupItems` solo borra lo creado por un guardado, solo para el Owner, sin plazo.

## 16. Registro de decisiones (lo completa Fede)
- Decisiones tomadas:
- Fecha:
- Decisión: Aceptado / Cambios pedidos / Rechazado

## 17. Delta de implementación (agente, 2026-10-26)
- Decisiones de Fede aplicadas (`annex/field-actions-matrix-proposal-20261026.md`): editar y confirmar, cualquier miembro; borrar, solo el Owner; «en uso» y archivado vía registro de cambios con deshacer de 24 h (U-2); procedencia ampliada a posicionamiento, pilares y segmentos (U-3); editar siempre confirma.
- U-1 hecha: matriz y reglas en `src/lib/field-actions.ts`; botones comunes en `src/components/field-actions.tsx`; aviso de cambios sin guardar con `useUnsavedGuard` (CA-3) en el editor de ICP y en la revisión de bloques del onboarding; confirmación por campo, en bloque y por bloque en la ficha de encaje de la cuenta (CA-8 a CA-10). La marca de origen gana quién y cuándo (`confirmedBy`, `confirmedAt`) y el tipo `sin_dato` para confirmar un valor sin origen sin atribuirlo a una persona. La migración 0058 (verificada en local) se ajustó para sellar `confirmedBy` con `auth.uid()`.
- U-2 hecha: reglas puras en `src/lib/delete-rules.ts` (qué se pierde y dónde se usa, segmento en uso no se borra, archivar ICP y pilar = borrar con deshacer 24 h, ventana y rol del deshacer); `DeleteSegment` las usa y ofrece «Deshacer» en el aviso; panel «Cambios de las últimas 24 horas» en Estrategia (`recent-changes.tsx`). **Migración 0060 verificada en local (PGlite), sin aplicar a la base real** (`field_edit_log`, disparadores en `segments`, `icp_profiles`, `positioning` y `messaging_pillars`, `undo_field_edit`; lista de comprobaciones en su cabecera). Hasta aplicarla en la base real, el borrado de segmentos funciona pero «Deshacer» falla con un error. Los botones de borrar/archivar de ICP y pilares llegan en U-3. Numeración: otra rama añade también un `0059`; renumerar al fusionar.
- U-3 hecha: ICP, pilares y posicionamiento. ICP y pilares se archivan o borran con `DeleteElement` (qué se pierde, dónde se usa, solo el Owner, «Deshacer» 24 h); el editor de ICP y el de posicionamiento avisan al salir con cambios sin guardar (CA-3) y su guardado deja de enviar `field_sources` (evita pisar confirmaciones con una copia vieja); confirmación por campo y por bloque en ICP (países, geografía, empleados, tamaño), posicionamiento (marco de Dunford, frase y jerarquía) y pilares (`ConfirmMark`, `ConfirmBar`). El borrado de segmentos usa el mismo componente. **Migración 0061 verificada en local (PGlite), sin aplicar a la base real** (`field_sources` y disparadores en `positioning`, `messaging_pillars` y `segments`, sobre `track_field_sources` de la 0058). Hasta aplicar 0058 y 0061 en la base real, la confirmación no se ofrece (las filas no traen `field_sources`) y no se rompe ninguna pantalla. Edición de segmentos: la procedencia está en la migración, pero la pantalla de segmentos no muestra confirmación todavía. Editar de por sí confirma (decisión de Fede) a través del disparador.
- U-4 hecha: fuentes y hallazgos del onboarding. CA-12: al añadir archivos se acumulan (`mergeFiles`; el mismo nombre sustituye al anterior; tope de 10 documentos por lectura, **valor puesto por el agente porque el SDD no lo fija: lo confirma Fede**). Las fuentes pendientes se pueden quitar antes de leer (web, archivos, nombres de texto y texto pegado). CA-11: tras leer, «Quitar» indica qué hallazgos dependen de la fuente y permite mantenerlos (marcados «fuente quitada») o descartarlos; la dependencia se calcula por coincidencia del texto de la fuente del hallazgo con la fuente quitada, y una fuente genérica («Tus fuentes») no la tiene. La propuesta no se recalcula al quitar una fuente (se avisa en el diálogo). Los hallazgos se pueden confirmar, editar (editar confirma) y descartar con recuperación durante 24 h, solo cuando la lectura termina, porque el trabajo en segundo plano sigue escribiendo la lista mientras tanto. Sin migración: todo vive en `onboarding_sessions.findings` y `sources` (jsonb existente). Pendiente fuera de U-4: no hay recorrido manual en local.
- U-5 hecha: acciones desde el Agente con las mismas reglas que la pantalla (`src/lib/agent/tools/field-actions.ts`). Escrituras (solo tras tu aprobación, como todo el registro): `update_icp`, `update_pillar`, `delete_segment`, `delete_icp`, `delete_pillar`, `confirm_fields`, `undo_change`; lecturas: `check_delete` (qué se pierde y dónde se usa, antes de proponer el borrado) y `list_recent_changes`. CA-14: el rol se comprueba en código (el Agente corre también con el cliente privilegiado, sin RLS): borrar y deshacer un borrado, solo Owner; un segmento en uso no se borra; el nombre mostrado debe coincidir con el del elemento. Editar y confirmar: cualquier miembro, como en pantalla. `TRACKED_FIELDS` (campos confirmables) vive en `src/lib/field-actions.ts` y una prueba lo compara con los disparadores de las migraciones. Manifiesto MCP regenerado y títulos añadidos. Dependen de migraciones aún sin aplicar a la base real: `confirm_fields` falla con un mensaje claro hasta aplicar 0058/0061, y `list_recent_changes`/`undo_change` hasta aplicar 0060; desde Telegram o cron, `undo_change` no puede ejecutar la función (sin persona con sesión) y remite a la pantalla. `update_positioning` y `upsert_segment` ya existían y no se han tocado.
- Verificación de migraciones (2026-10-26, decisión de Fede de no depender de Dani): `src/lib/migrations.pg.test.ts` ejecuta 0058, 0060 y 0061 sobre un Postgres en proceso (PGlite) con dos empresas ficticias y 18 pruebas: sello de persona, borrado de marca, escritura de servicio, aislamiento entre empresas, registro de cambios, deshacer (ventana de 24 h, solo Owner para un borrado, restauración con el id original y con las columnas de lista NOT NULL, sin fila nueva en el registro), borrado en cascada de una empresa, convivencia con `positioning_copy_guard` y borrado en cascada de un segmento. El arnés replica el catálogo real leído de la base de Nokko el 2026-10-26 (solo esquema, sin datos): columnas con sus NOT NULL y valores por defecto, `set_audit`, `positioning_copy_guard`, claves ajenas hacia `segments` y políticas. Una comprobación con mutaciones confirmó que el arnés detecta una migración rota. **Hallazgo de esa lectura:** borrar un segmento también arrastra `account_assignment_rules` (cascada) y deja sin segmento `finance_cost_lines`; ambas tablas se añadieron a la comprobación de «en uso» de pantalla y Agente. **Límite:** sigue sin aplicarse a la base real (no hay copia de ella accesible: la rama de Supabase de Nokko no está en las herramientas conectadas, y aplicar DDL con `query_database` de Lovable tocaría producción). `types.ts` se actualizó a mano en el formato del generador (columnas `field_sources`, tabla `field_edit_log`, función `undo_field_edit`) y se retiraron los casts; Lovable lo regenerará al aplicar las migraciones.
- Alcance de la confirmación en U-1: campos de la cuenta con procedencia (`accounts`). Posicionamiento, pilares, segmentos e ICP la reciben en U-3 (migración nueva, verificada en local).

- Prueba en producción (2026-10-27, nokko.ai, empresa de prueba creada y borrada después; la empresa Postin no se tocó): pasan procedencia con sello de persona y confirmación («Escrito por ti · Confirmado», «Sin origen · Confirmado», bloque «Confirmado»), normalización del tamaño («Empleados: 51-200» → «51–200 empleados»), aviso de cambios sin guardar con tres opciones, registro de cambios con «Deshacer», archivar y recuperar un pilar y un ICP (misma fila, mismo id, países normalizados «es, mx» → ES, MX), bloqueo del borrado de un segmento con una cuenta («Se usa en…»), borrado de un segmento vacío con aviso de 24 h, consulta del Agente (`check_delete`) y borrado de la empresa con su cascada (el registro de cambios quedó a 0 filas, sin huérfanos). **Defectos hallados y corregidos:** el panel «Cambios de las últimas 24 horas» no se refrescaba tras editar (ahora se invalida); tras «Deshacer» un pilar mostraba el texto antiguo hasta recargar (campos con clave por valor); «1 cuentas» (singular); y deshacer una edición borraba la confirmación de otro campo hecha después (migración 0063, solo restaura la marca de los campos revertidos). La 0063 está verificada en local y **sin aplicar a la base real**.
---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
