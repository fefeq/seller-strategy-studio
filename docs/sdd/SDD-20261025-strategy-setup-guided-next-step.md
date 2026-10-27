# SDD-20261025-strategy-setup-guided-next-step · [Mejora] «Configura tu estrategia» que guía

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** En curso (Aprobado por Fede, 2026-10-27) · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25
**Depende de:** SDD universal de campos (definición única de "completo")

## 1. Resumen
Al terminar cada paso de «Configura tu estrategia», NOKKO debe decirte **qué hacer ahora**, en pantalla y en el Agente, y avisarte de forma proactiva si te quedas parado. Hoy el recorrido es una lista estática sin estado de finalización ni siguiente paso.

## 2. Problema y para quién
Founder con poco tiempo que termina un paso y no sabe cuál sigue ni por qué importa.

## 3. Evidencia y por qué ahora
Fuente: código del repo (2026-10-25); sin datos de uso (sin dato):
- `SETUP_ITEMS` define 8 elementos con peso, y `POSITIONING_FIELDS` 13 campos; existe un detector proactivo `setup-incomplete`.
- El roadmap final es estático y no tiene estado de completado.
- El diagnóstico GTM es por usuario y no se propaga al resto de la empresa.
- Existen varias definiciones de "ICP completo" (ver SDD de onboarding).
- Petición directa de Fede (2026-10-25).

**Apuesta declarada:** no hay datos de uso; la prioridad se apoya en el código de `main` y en la petición de Fede. Se medirá tras el lanzamiento con las métricas de la sección 4.

## 4. Resultado buscado
- % de empresas que completan los 8 elementos en 7 días desde la creación (fuente: base de datos). Línea base: sin dato.
- Tiempo desde terminar un paso hasta iniciar el siguiente (fuente: registro de eventos; hoy no medido, sin dato).

## 5. Alcance
**Incluye:** siguiente paso recomendado tras cada paso; panel de progreso con estado real; aviso proactivo en el Agente y en pantalla; motivo de cada paso; posibilidad de posponer.
**No incluye:** rediseño del contenido de los pasos; nuevos pasos; notificaciones por email (solo si Fede lo pide).

## 6. Cambios de comportamiento (delta)
**Añadido:** mensaje de «siguiente paso» al terminar cada paso; estado completado/pendiente/pospuesto por elemento; aviso proactivo; mismo contexto en Agente y pantalla.
**Modificado:** roadmap estático → lista con estado y siguiente paso; diagnóstico por usuario → visible para la empresa.
**Eliminado:** definiciones duplicadas de completo.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero saber qué hacer al terminar un paso.
- CA-1: CUANDO termino un paso, el sistema DEBE mostrarme el siguiente paso recomendado con una frase de por qué importa y un botón para empezarlo.
- CA-2: SI no queda ningún paso pendiente, ENTONCES el sistema DEBE mostrar qué hace NOKKO solo y qué me toca a mí a partir de ahora.
- CA-3: El sistema DEBE calcular el siguiente paso por reglas fijas de prioridad y dependencia, igual en pantalla y en el Agente.

### H-2: Como founder, quiero ver mi progreso real.
- CA-4: El sistema DEBE mostrar por elemento el estado Completado / Pendiente / Pospuesto, según una única definición de "completo".
- CA-5: CUANDO un dato se confirma o edita en cualquier pantalla, el sistema DEBE actualizar el progreso sin recarga manual.

### H-3: Como founder, quiero que NOKKO me avise si me quedo parado.
- CA-6: MIENTRAS haya pasos pendientes y pase más de 1 día sin actividad (decidido por Fede), el sistema DEBE avisarme en la próxima sesión, en el Agente y en Inicio, con el siguiente paso.
- CA-7: CUANDO pospongo un paso, el sistema DEBE no volver a avisarme de ese paso hasta la fecha que elija.
- CA-8: SI mi rol no puede completar el paso, ENTONCES el sistema DEBE indicar quién de la empresa puede.

### H-4: Como founder, quiero la guía también en el Agente.
- CA-9: CUANDO abro el Agente con pasos pendientes, el sistema DEBE ofrecerme el siguiente paso como primera sugerencia.
- CA-10: CUANDO termino un paso con ayuda del Agente, el sistema DEBE confirmar lo hecho y proponer el siguiente.

## 8. Casos límite y errores
- Todos los pasos completos: CA-2.
- Dato editado que "descompleta" un paso: el estado vuelve a Pendiente y se avisa (CA-5).
- Fallo al calcular el estado: mostrar el último estado conocido y reintentar (CA-4).
- Varios miembros: el progreso es de la empresa, no por usuario (CA-4); el diagnóstico queda visible para todos los roles permitidos.
- Usuario invitado: ve solo los pasos que le competen (CA-8).

## 9. Experiencia y copy
Mensaje tipo: «Ya tienes tu ICP. Siguiente: define tu posicionamiento (5 min). Así NOKKO sabrá qué diferencia contar.» Botones: «Empezar», «Más tarde». Todo en «tú», sin iconos.

## 10. Datos, permisos y privacidad
Se guarda estado por elemento y fecha de posposición por empresa. Sin datos de terceros. Respetar roles.

## 12. Notas técnicas [Sugerencia — Dani valida]
- Regla pura sobre `SETUP_ITEMS`/`setupStatus` (`src/lib/setup-schema.ts`); reutilizar detector `src/lib/proactive/detectors/setup-incomplete.ts` y `next-steps`.
- **Uso de LLM:** cero para decidir el siguiente paso (regla determinista). Opcional: reformular el motivo con modelo barato (`effort: "low"`), con caché por (paso, empresa) y plantilla de respaldo si falla.
- Estado completado derivado de datos, no guardado aparte, para evitar incoherencias.

## 13. Riesgos y dependencias
- Dueño de la regla de «completo»: SDD universal de campos. Este SDD y el de onboarding solo la consumen.
- Mecanismo de aviso compartido con el SDD de onboarding (un único detector para ambos).
- Ruido: demasiados avisos. Mitigación: máximo un aviso por sesión y posposición.
- Depende del SDD universal (definición única de completo).

## 14. Preguntas para Dani
1. ¿Dónde viven hoy las definiciones de completo y cuántas son distintas?
2. ¿Puede el estado derivarse siempre de datos?

## 15. Pendiente de verificar
- [Por verificar] Si el diagnóstico GTM se puede compartir a nivel empresa sin cambios de permisos.
- [Por verificar] Línea base de finalización (sin dato).

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
