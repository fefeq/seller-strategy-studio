# SDD-20261025-onboarding-flow-end-to-end · [Feature] Onboarding completo y proactivo

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Borrador · **Pide:** Fede · **Para:** Claude Code · **Fecha:** 2026-10-25
**Depende de:** SDD universal de campos, SDD de acciones sobre campos, SDD de guía de estrategia

## 1. Resumen
Auditoría del flujo de Onboarding de punta a punta: «se queda rengo y sin proactividad». Este SDD cierra los huecos: definición única de "onboarding terminado", reanudación y recordatorios, cierre con siguiente paso, y coherencia entre lo leído, lo confirmado y lo que usa el resto del producto.

## 2. Problema y para quién
Founder que empieza el onboarding, lo deja a medias o lo termina, y NOKKO no le acompaña después. Miembro invitado con recorrido corto.

## 3. Evidencia y por qué ahora
Fuente: código del repo y plan existente `.lovable/plan/onboarding-de-nokko-de-cero-a-una-estrategia-gtm-aprobada-si-2026-10-24.md` (2026-10-25). Sin datos de uso (sin dato).
Hallazgos del código:
1. El plan prevé 9 bloques de tareas (numerados 1 a 8 y 3b) (esqueleto, fuentes, lectura, diagnóstico, preguntas, bloques, A fondo, roadmap, invitados). **[Por verificar]** cuáles están completas en `main`.
2. Hay varias definiciones de "completo" para ICP y posicionamiento (duplicados en campos de posicionamiento).
3. La lista de fuentes se reemplaza al añadir archivos y no admite quitar.
4. El diagnóstico es por usuario y no se propaga.
5. El roadmap final es estático y no tiene estado.
6. No hay aviso si el onboarding queda a medias más allá de la tarjeta de Inicio **[Por verificar]**.
7. Los datos leídos se guardan como hallazgos de sesión; qué pasa con los no aprobados al abandonar es **[Por verificar]**.

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de empresas que alcanzan «onboarding terminado» en 7 días (fuente: base de datos). Línea base: sin dato.
- % que reanudan tras abandonar (fuente: eventos de sesión de onboarding). Línea base: sin dato.

## 5. Alcance
**Incluye:** definición única de terminado; reanudación; recordatorios proactivos; cierre con roadmap con estado; propagación del diagnóstico a la empresa; recorrido de invitados; tratamiento de datos no aprobados.
**No incluye:** nuevo contenido de bloques; conectores CRM nuevos; facturación; el detalle de edición/borrado (SDD de acciones) y la guía paso a paso (SDD de guía).

## 6. Cambios de comportamiento (delta)
**Añadido:** estado "terminado" único; recordatorio de reanudación; resumen al terminar con lo que se aprobó, lo supuesto y lo pendiente.
**Modificado:** diagnóstico por usuario → de empresa; roadmap estático → con estado; salida a mitad → conserva el punto exacto y los hallazgos.
**Eliminado:** definiciones duplicadas de completo.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero retomar justo donde lo dejé.
- CA-1: CUANDO vuelvo al onboarding, el sistema DEBE llevarme al paso donde lo dejé, desde cualquier dispositivo.
- CA-2: SI abandono con hallazgos sin revisar, ENTONCES el sistema DEBE conservarlos como propuestas pendientes sin aplicarlos a la estrategia.

### H-2: Como founder, quiero que NOKKO me recuerde terminar.
- CA-3: MIENTRAS el onboarding esté sin terminar y no haya actividad durante 1 día (decidido por Fede), el sistema DEBE avisarme en Inicio y en el Agente con el punto de reanudación.
- CA-4: CUANDO la lectura de fuentes en segundo plano termina, el sistema DEBE avisarme y llevarme a revisar.
- CA-5: SI la lectura falla o se pausa por presupuesto, ENTONCES el sistema DEBE decirme qué pasó y cómo continuar.

### H-3: Como founder, quiero un cierre claro.
- CA-6: El sistema DEBE considerar terminado el onboarding solo cuando se cumpla una única definición declarada (bloques obligatorios aprobados o saltados explícitamente).
- CA-7: CUANDO termino, el sistema DEBE mostrar qué quedó Confirmado, Deducido o Supuesto, y los siguientes pasos con estado.
- CA-8: CUANDO termino, el sistema DEBE dejar el diagnóstico y los datos disponibles para toda la empresa y para el Agente.

### H-4: Como founder, quiero poder cambiar mis fuentes y datos sin repetir todo.
- CA-9: CUANDO añado una fuente después de empezar, el sistema DEBE leerla sin perder lo aprobado.
- CA-10: CUANDO un dato de una fuente nueva contradice uno que escribí yo, el sistema DEBE proponerlo sin sobrescribirlo.

### H-5: Como miembro invitado, quiero un recorrido corto.
- CA-11: CUANDO me uno a una empresa, el sistema DEBE mostrarme solo mi rol, mis preferencias y lo ya aprobado.

## 8. Casos límite y errores
- Empresa sin web ni documentos: permitir empezar solo con nombre (CA-1, CA-6).
- Fuente ilegible o sin acceso: marcarla y continuar con las demás (CA-5).
- Presupuesto al 80 % y 100 % (umbrales actuales según el plan del repo): avisar y pausar según la regla de presupuesto actual (CA-5).
- Dos miembros en el onboarding a la vez: el segundo ve el estado actual y no duplica trabajo (CA-1).
- Cambio de profundidad a mitad: conservar lo hecho (CA-1).

## 9. Experiencia y copy
Recordatorio: «Te quedaste en *ICP*. Te llevan 3 minutos terminar. ¿Seguimos?». Cierre con resumen en tres columnas: Confirmado, Deducido, Supuesto. «Tú», sin iconos, estados con palabra.

## 10. Datos, permisos y privacidad
Se guardan hallazgos con su origen. Los documentos leídos no se muestran fuera de la empresa. Sin datos de terceros. Solo API oficial para cualquier fuente de LinkedIn.

## 11. Unidades de trabajo
- U-1: Definición única de terminado y estado de empresa (H-3).
- U-2: Reanudación y propuestas pendientes (H-1, H-4).
- U-3: Recordatorios y avisos (H-2).
- U-4: Cierre con resumen y propagación del diagnóstico (H-3).
- U-5: Invitados (H-5).

## 12. Notas técnicas [Sugerencia — se valida en la implementación]
- `onboarding_sessions` (estado, hallazgos, `block_status`), `src/lib/onboarding.ts`, `src/hooks/use-onboarding.ts`, `src/components/onboarding/*`.
- Reutilizar `background_jobs` (`onboarding_read`) y el centro de avisos.
- **Uso de LLM:** lectura de fuentes ya usa extracción con IA; objetivo: cachear por contenido (hash de fuente) para no releer, usar `effort:"low"` salvo A fondo, y mostrar coste previo. Todo el estado, recordatorios y cierre: reglas deterministas.

## 13. Riesgos y dependencias
- Es épica: se propone tratarla tras los SDD 1, 2 y 3 y dividirla en dos entregas (U-1/U-2/U-4 y U-3/U-5) cuando Claude Code confirme el estado del plan en el código y los PR.
- Dueños: «completo» → SDD universal; añadir fuente y no sobrescribir → SDD de acciones y universal (CA-9); este SDD solo los referencia.
- Depende de tres SDD previos.
- Riesgo de solapamiento con el plan de 2026-10-24: comprobar en el código y los PR qué falta antes de repartir unidades.

## 14. Decisiones abiertas (recomendación de Claude)
Las resuelve Claude Code comprobándolas en el código; lo que no pueda comprobar lo decide Fede con la recomendación de Claude. No hay revisor técnico externo.
1. ¿Qué tareas del plan de onboarding están ya en `main` y en `production`?
2. ¿Qué pasa hoy con hallazgos no aprobados al abandonar?
3. ¿Existe ya recordatorio fuera de Inicio?

## 15. Pendiente de verificar
- [Por verificar] Estado de las tareas del plan.
- [Por verificar] Comportamiento al abandonar.
- [Por verificar] Diferencias entre `production` y `main` (este análisis solo vio `main`).

## 16. Registro de decisiones (lo completa Fede)
- Decisiones tomadas:
- Fecha:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
