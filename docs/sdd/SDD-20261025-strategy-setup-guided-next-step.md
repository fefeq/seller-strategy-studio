# SDD-20261025-strategy-setup-guided-next-step · [Mejora] «Configura tu estrategia» que guía

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** En curso (Aprobado por Fede, 2026-10-26; tabla de la sección 11 validada con el orden del wizard; U-1 a U-6 hechas; migración 0060 sin verificar; falta la parte de diagnóstico compartido) · **Pide:** Fede · **Para:** Dani · **Fecha:** 2026-10-25
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

## 11. Tabla de los 8 pasos (derivada del código, 2026-10-26)
Fuente: `SETUP_ITEMS` y `setupStatus` en `src/lib/setup-schema.ts`, `SETUP_STEP_LINK` en `src/lib/proactive/resolve.ts`, `src/components/setup/wizard.tsx` y roles en `src/lib/agent/tools/strategy.ts` y `core-write.ts`.

| Nº wizard | id | Peso | Cuenta como completo (hoy) | Dónde se edita | Roles que pueden completarlo | Dependencia en el código |
|---|---|---|---|---|---|---|
| 1 | `positioning` | 20 | Los 13 campos de `POSITIONING_FIELDS` con texto | `/strategy?tab=positioning` | owner, sales_leader, marketing | Ninguna |
| 2 | `icp` | 15 | Al menos un ICP con sectores, tamaño, encaje y anti-ICP | `/strategy?tab=icp` | owner, sales_leader, marketing | Ninguna |
| 3 | `segments` | 10 | Hay segmentos y todos tienen ACV mín. o máx. | `/strategy?tab=motions` | owner, sales_leader | Necesita segmentos existentes; `create_organization` siembra los de plantilla |
| 4 | `benchmarks` | 10 | Hay segmentos y todos tienen win rate y cuota AE (0 vale) | `/strategy?tab=motions` | owner, sales_leader | Mismos segmentos que el paso 3; el formulario es el mismo |
| 5 | `pillars` | 10 | Al menos 3 pilares con título y mensaje | `/strategy?tab=pillars` | owner, sales_leader, marketing | Ninguna |
| 6 | `quota` | 15 | Cuota del trimestre actual con importe mayor que 0 | `/metrics` | owner, sales_leader | Ninguna; el trimestre se recalcula solo y el paso vuelve a Pendiente al cambiar de trimestre |
| 7 | `accounts` | 10 | Al menos una cuenta | `/accounts` | Sin restricción de rol en la herramienta | Ninguna; crear un deal sin cuenta crea una, así que el paso 8 puede completar el 7 |
| 8 | `deals` | 10 | Al menos un deal | `/deals` | Sin restricción de rol en la herramienta | Opcionales: segmento, etapa y cuenta (se crea si no existe) |

**Dos órdenes distintos hoy (incumple CA-3):**
- Wizard: orden fijo de la tabla (1 a 8). Tras guardar salta al siguiente pendiente en ese orden, circular.
- Detector `setup-incomplete` y `setupStatus.next`: orden por peso descendente, con empate por posición: positioning, icp, quota, segments, benchmarks, pillars, accounts, deals. La cuota (15) se recomienda antes que segmentos (10).

**Hallazgos:**
- El código no impone ninguna dependencia entre pasos; solo hay dependencias de datos (3 y 4 sobre los mismos segmentos; 8 puede crear la cuenta del 7).
- El estado completado ya se deriva de datos (`done(d)`), sin guardar aparte; es la base de la nota técnica de la sección 12.
- Los roles del paso 7 y 8 no están restringidos: CA-8 solo aplica a los pasos 1 a 6.
- No hay estado «pospuesto» ni fecha de posposición en ningún sitio: es nuevo (sección 10).

**Orden único (validado por Fede, 2026-10-26):** el del wizard (1 a 8), porque va de estrategia a ejecución y mantiene «paso 2» siempre igual. Regla de siguiente paso: el primer pendiente no pospuesto en ese orden. El detector y `setupStatus` ya la usan; el peso solo cuenta para el porcentaje.

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
2. ¿Puede el estado derivarse siempre de datos? Implementado así: completado y pendiente se derivan de datos; solo la posposición se guarda (tabla `setup_step_snoozes`, migración 0060, sin verificar).
3. ¿Política de lectura entre miembros sobre `onboarding_sessions`, o copia del diagnóstico a una tabla de empresa? Bloquea el delta «diagnóstico visible para la empresa».
4. El catálogo de campos (SDD 1, U-4) no prevé tablas nuevas: `org_id` y `created_at` no tienen concepto. Se añadieron las 5 columnas de `setup_step_snoozes` a la línea base y `BASELINE_MAX` sube de 980 a 985, contra la regla de que solo baje. ¿Cubre el catálogo las columnas técnicas de tablas nuevas?
5. «Máximo un aviso por sesión» se ha leído como una vez por sesión en cada sitio (Inicio y Agente), porque CA-6 pide ambos. ¿Es correcto?

## 15. Pendiente de verificar
- [Verificado en el código, 2026-10-26] El diagnóstico GTM NO se puede compartir a nivel empresa sin cambiar permisos: vive en `onboarding_sessions.diagnosis` y su RLS («Own onboarding in my company», migración 0052) solo deja leer y escribir filas con `user_id = auth.uid()`. Compartirlo exige una política nueva de lectura entre miembros o copiarlo a una tabla de empresa. Ninguna de las dos se ha hecho: el cambio de «diagnóstico por usuario → visible para la empresa» queda fuera de esta entrega a la espera de Dani (pregunta 3 de la sección 14).
- [Por verificar] Línea base de finalización (sin dato).

## 16. Sección de Dani (la completa él)
- Diseño técnico:
- Tareas:
- Estimación:
- Decisión: Aceptado / Cambios pedidos / Rechazado

## 17. Entrega (delta y CA → prueba)
Rama `feat/strategy-guided-next-step`. Unidades: U-1 regla pura (`src/lib/setup-guide.ts`), U-2 tabla de posposición (`drizzle/migrations/0060_setup_step_snoozes.sql`), U-3 detector y orden único, U-4 hook y componentes (`src/hooks/use-setup-guide.ts`, `src/components/setup/guide.tsx`), U-5 pantallas (asistente, panel de progreso, Inicio, barra lateral), U-6 Agente.

| CA | Prueba automática | Notas |
|---|---|---|
| CA-1 | `setup-guide.test.ts` «CA-1» | Pantalla sin prueba de componente |
| CA-2 | `setup-guide.test.ts` «CA-2» | Se muestra en el panel de progreso al completar |
| CA-3 | `setup-guide.test.ts` (orden fijo), `proactive.test.ts` (detector), `agent-tools.test.ts` (`get_setup_status`) | |
| CA-4 | `setup-guide.test.ts` «CA-4» | |
| CA-5 | `setup-guide.test.ts` «CA-5» (regla); la actualización sin recarga depende de invalidar consultas | Sin prueba de componente |
| CA-6 | `setup-guide.test.ts` (`nudgeDue`), `proactive.test.ts` (prioridad) | Actividad = último cambio en los datos de los 8 pasos o una posposición |
| CA-7 | `setup-guide.test.ts` (posposición), `proactive.test.ts` | |
| CA-8 | `setup-guide.test.ts` (roles, incluida la coincidencia con las herramientas del Agente) | |
| CA-9 | `agent-tools.test.ts` (la herramienta devuelve la guía); la tarjeta «Primera sugerencia» no tiene prueba de componente | |
| CA-10 | Regla en el prompt del Agente y tarjeta «Hecho: …» al completar; sin prueba automática | Verificar a mano |

Fuera de esta entrega: diagnóstico visible para la empresa (pregunta 3). No verificado: migración 0060 y su RLS con dos empresas ficticias (no hay base de pruebas), recorrido de los flujos en local (la app solo arranca contra el backend real) y el escaneo de seguridad DAST (la aplicación no se ejecutó).

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (bloqueado hasta cerrar decisiones de Fede).
