# SDD-20261025-discoveries-scoped-manual-search · [Mejora] Descubiertos: qué busca, cuándo, y búsqueda manual acotada

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Para:** Claude Code · **Fecha:** 2026-10-25

## 1. Resumen
Tres cosas: (a) dejar claro al usuario **qué busca** Descubiertos y **cuándo**; (b) poder lanzar una búsqueda manual **eligiendo qué buscar** (solo empresas, solo contactos, solo competidores o combinaciones); (c) que la búsqueda manual no altere sin avisar el ritmo semanal.

## 2. Problema y para quién
Founder que dispara una búsqueda manual y no puede decidir el alcance, no sabe cuándo se ejecutó ni cuándo toca la próxima, ni cuánto gasta.

## 3. Evidencia y por qué ahora
- Petición directa de Fede (2026-10-25 13:25).
- Nota: `https://nokko.ai/discoveries` exige sesión y no se pudo leer; el análisis se basa en el código del repo (`main`, 2026-10-25). **[Por verificar]** que producción coincide.
- Comportamiento actual (código):
  - Búsqueda semanal por empresa; bloqueo por empresa que impide repetir antes de ~7 días menos 1 hora.
  - Hasta 3 ICP por ejecución. Por ICP: 4 empresas, 4 contactos y 2 búsquedas. Máximos por ejecución: 12 empresas, 12 contactos, 5 competidores.
  - Umbral de encaje: 60. Deduplicación por clave. Presupuesto por empresa con pausa automática al 100 % (regla de presupuesto actual, fuente: código del repo).
  - Hasta ~7 llamadas a IA por ejecución.
  - La ejecución manual con «forzar» **reinicia el reloj semanal**, lo que retrasa la siguiente automática.
  - Los competidores hallados se añaden solos a las alternativas competitivas del posicionamiento.
  - La información de última/próxima ejecución no es legible desde la interfaz.
  - No hay herramienta del Agente para lanzar una búsqueda.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de búsquedas manuales con alcance acotado (fuente: registro de ejecuciones). Línea base: sin dato.
- Coste medio de una búsqueda acotada vs completa (fuente: registro de presupuesto). Línea base: sin dato.
- Reclamaciones por «no sé cuándo busca»: sin dato.

## 5. Alcance
**Incluye:** selector de alcance (empresas / contactos / competidores, combinables) y de ICP; vista de qué se busca y cuándo (última, próxima, qué se buscó); estimación de coste antes de lanzar; regla para el reloj semanal; herramienta para lanzar desde el Agente.
**No incluye:** nuevas fuentes de datos; cambiar umbrales de encaje o máximos; búsqueda de contactos sin empresa base si no es viable (pregunta 2); automatización semanal distinta de la actual.

## 6. Cambios de comportamiento (delta)
**Añadido:** alcance elegible; panel de "qué y cuándo"; estimación previa; lanzamiento desde el Agente.
**Modificado:** búsqueda manual (antes: siempre completa y reinicia reloj; después: acotada y con regla de reloj elegida).
**Eliminado:** reinicio silencioso del reloj semanal.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero saber qué busca NOKKO y cuándo.
- CA-1: El sistema DEBE mostrar para mi empresa la fecha de la última ejecución, la próxima prevista, el origen (automática/manual) y el alcance buscado.
- CA-2: El sistema DEBE mostrar para cada ICP activo qué criterios se usan y los máximos por tipo.
- CA-3: SI la búsqueda está pausada por presupuesto, ENTONCES el sistema DEBE indicarlo con el motivo y cómo reanudar.

### H-2: Como founder, quiero elegir qué buscar al lanzar manualmente.
- CA-4: CUANDO lanzo una búsqueda manual, el sistema DEBE permitirme elegir uno o varios tipos: empresas, contactos, competidores.
- CA-5: CUANDO lanzo una búsqueda manual, el sistema DEBE permitirme elegir qué ICP incluir.
- CA-6: CUANDO elijo un alcance, el sistema DEBE ejecutar y gastar presupuesto solo en los tipos elegidos.
- CA-7: SI elijo contactos sin empresas, ENTONCES el sistema DEBE usar las empresas ya guardadas de ese ICP y avisar si no hay ninguna. **[Por verificar viabilidad]**
- CA-8: SI elijo competidores, ENTONCES el sistema DEBE mostrarme los candidatos y NO añadirlos al posicionamiento hasta que los confirme.

### H-3: Como founder, quiero ver el coste antes de lanzar.
- CA-9: CUANDO voy a lanzar una búsqueda, el sistema DEBE mostrar el máximo de resultados y la estimación de coste del alcance elegido y el presupuesto restante.
- CA-10: SI el coste estimado supera el presupuesto restante, ENTONCES el sistema DEBE avisar y ofrecer reducir el alcance.

### H-4: Como founder, quiero controlar el ritmo semanal.
- CA-11: CUANDO lanzo una búsqueda manual, el sistema DEBE dejar el reloj de la búsqueda automática intacto por defecto.
- CA-12: DONDE elija «contar como esta semana», el sistema DEBE reiniciar el reloj semanal y avisarme de la nueva fecha.

### H-5: Como founder, quiero lanzarlo desde el Agente.
- CA-13: CUANDO pido al Agente una búsqueda con un alcance, el sistema DEBE mostrar alcance, coste y ejecutar solo con mi aprobación.
- CA-14: El sistema DEBE aplicar las mismas reglas de rol y presupuesto que en pantalla.

## 8. Casos límite y errores
- Ya hay una búsqueda en curso: no lanzar otra y mostrar el estado (CA-1).
- Sin ICP definidos: indicar que hay que crear uno y enlazar (CA-5).
- Resultados bajo el umbral de encaje: no se guardan; informar del número descartado (CA-6).
- Duplicados: no se guardan de nuevo; informar del número (CA-6).
- Fallo del proveedor de datos: informar, no gastar presupuesto no consumido y permitir reintentar (CA-9).
- Rol sin permiso para lanzar: ocultar/desactivar con explicación (CA-14).

## 9. Experiencia y copy
Botón «Buscar ahora» abre selector: «¿Qué quieres buscar?» Empresas / Contactos / Competidores; «¿En qué ICP?». Antes de lanzar: «Hasta 12 empresas. Coste estimado: *X*. Te quedan *Y*.» Panel: «Última búsqueda: *fecha*. Próxima: *fecha*.» En «tú», sin iconos. Cifras de coste: sin dato hasta que se midan en la implementación.

## 10. Datos, permisos y privacidad
Se guardan alcance, origen y coste por ejecución. Contactos: solo datos de fuentes ya usadas hoy; **[Por verificar]** proveedores y base legal de los datos de contacto (lo decide Fede). LinkedIn: no se usa más que la API oficial, y NOKKO no valora perfiles de LinkedIn.

## 11. Unidades de trabajo
- U-1: Panel de qué y cuándo (H-1).
- U-2: Alcance y selector de ICP en manual (H-2, H-4).
- U-3: Estimación de coste y presupuesto (H-3).
- U-4: Herramienta del Agente (H-5; depende de U-2).

## 12. Notas técnicas [Sugerencia — se valida en la implementación]
- Código: `src/lib/discoveries.ts`, `discoveries.server.ts`, `discoveries.functions.ts`, `src/components/discoveries/icp-panel.tsx`, `src/routes/_authenticated/discoveries.tsx`, función hora `org-maintenance` en `src/lib/inngest/functions.server.ts`.
- `discoverForOrg` escribe el bloqueo antes de ejecutar; con `force:true` reinicia el reloj. `decideDiscovery` añade competidores a `positioning.competitive_alternative` (hoy sin confirmación).
- Los bloqueos (`job_locks`) no son legibles desde el cliente: exponer última/próxima mediante lectura dedicada.
- **Uso de LLM:** búsqueda acotada reduce llamadas (≤7 hoy). Reglas: sin LLM para elegir alcance ni calcular coste; LLM solo en puntuación/clasificación de resultados, `effort:"low"`, y cachear por clave de deduplicación para no reevaluar candidatos ya puntuados.

## 13. Riesgos y dependencias
- Dueño de la confirmación de competidores: SDD de acciones sobre campos. La entidad Competidor se define en el SDD de datos mínimos; ambos SDD se coordinan.
- Gasto: más control puede aumentar lanzamientos; mitigado por CA-9/CA-10.
- Depende de SDD de acciones sobre campos para confirmar competidores.

## 14. Decisiones abiertas (recomendación de Claude)
Las resuelve Claude Code comprobándolas en el código; lo que no pueda comprobar lo decide Fede con la recomendación de Claude. No hay revisor técnico externo.
1. ¿Se puede buscar contactos de empresas ya guardadas sin repetir la búsqueda de empresas?
2. ¿Qué coste real tiene cada tipo de búsqueda?
3. ¿Producción coincide con `main` en Descubiertos?

## 15. Pendiente de verificar
- [Por verificar] Contenido real de `nokko.ai/discoveries` (requiere sesión).
- [Por verificar] Viabilidad de CA-7.
- [Por verificar] Costes por tipo (sin dato).
- [Por verificar] Base legal y proveedores de contactos.

## 16. Registro de decisiones (lo completa Fede)
- Decisiones tomadas:
- Fecha:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
