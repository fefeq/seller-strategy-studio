# SDD-20261025-strategy-setup-guided-next-step · [Mejora] «Configura tu estrategia» que guía

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** Aprobado (Fede, 2026-10-26); tabla de la sección 12 pendiente de validar · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-10-25
**PRD:** docs/prd/PRD-20261028-ux-onboarding-coherencia.md (cubre G-3) · **Depende de:** SDD universal de campos (definición única de "completo")

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
Cubre el objetivo G-3 del PRD.

## 5. Alcance
**Incluye:** siguiente paso recomendado tras cada paso; panel de progreso con estado real; aviso proactivo en el Agente y en pantalla; motivo de cada paso; posibilidad de posponer.
**No incluye:** rediseño del contenido de los pasos; nuevos pasos; notificaciones por email (solo si Fede lo pide).

## 6. Cambios de comportamiento (delta)
**Añadido:** mensaje de «siguiente paso» al terminar cada paso; estado completado/pendiente/pospuesto por elemento; aviso proactivo; mismo contexto en Agente y pantalla.
**Modificado:** roadmap estático → lista con estado y siguiente paso; diagnóstico por usuario → visible para la empresa.
**Eliminado:** definiciones duplicadas de completo.

## 7. Historias y criterios de aceptación
### H-1: Como founder, quiero saber qué hacer al terminar un paso.
- CA-1: CUANDO termino un paso, el sistema DEBE mostrarme el siguiente paso recomendado con una frase de por qué importa y un botón para empezarlo. · cubre G-3 · prueba: `src/lib/setup-guide.test.ts`
- CA-2: SI no queda ningún paso pendiente, ENTONCES el sistema DEBE mostrar qué hace NOKKO solo y qué me toca a mí a partir de ahora. · cubre G-3 · prueba: `src/lib/setup-guide.test.ts`
- CA-3: El sistema DEBE calcular el siguiente paso por reglas fijas de prioridad y dependencia, igual en pantalla y en el Agente. · cubre G-3 · prueba: `src/lib/setup-guide.test.ts`

### H-2: Como founder, quiero ver mi progreso real.
- CA-4: El sistema DEBE mostrar por elemento el estado Completado / Pendiente / Pospuesto, según una única definición de "completo". · cubre G-3 · prueba: `src/lib/setup-guide.test.ts`
- CA-5: CUANDO un dato se confirma o edita en cualquier pantalla, el sistema DEBE actualizar el progreso sin recarga manual. · cubre G-3 · prueba: `src/lib/setup-guide.test.ts` (parcial: la regla de estado, no la actualización sin recarga)

### H-3: Como founder, quiero que NOKKO me avise si me quedo parado.
- CA-6: MIENTRAS haya pasos pendientes y pase más de 1 día sin actividad (decidido por Fede), el sistema DEBE avisarme en la próxima sesión, en el Agente y en Inicio, con el siguiente paso. · cubre G-3 · prueba: `src/lib/setup-guide.test.ts`
- CA-7: CUANDO pospongo un paso, el sistema DEBE no volver a avisarme de ese paso hasta la fecha que elija. · cubre G-3 · prueba: `src/lib/setup-guide.test.ts`
- CA-8: SI mi rol no puede completar el paso, ENTONCES el sistema DEBE indicar quién de la empresa puede. · cubre G-3 · prueba: `src/lib/setup-guide.test.ts`

### H-4: Como founder, quiero la guía también en el Agente.
- CA-9: CUANDO abro el Agente con pasos pendientes, el sistema DEBE ofrecerme el siguiente paso como primera sugerencia. · cubre G-3 · prueba: por nombrar en el brief
- CA-10: CUANDO termino un paso con ayuda del Agente, el sistema DEBE confirmar lo hecho y proponer el siguiente. · cubre G-3 · prueba: por nombrar en el brief

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

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Decidir el siguiente paso | regla (determinista, cero LLM) | no aplica | sin dato |
| Reformular el motivo del paso (opcional) | regla → caché por (paso, empresa) → modelo barato; plantilla de respaldo si falla | modelo barato, `effort: "low"` (modelo: el que decide `aiProviders()` (`src/lib/gemini.ts`: claves propias primero, pasarela de Lovable de respaldo)) | sin dato |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
El SDD original no declaraba unidades de trabajo. U-1 la nombró el agente de implementación en el commit `f2e0449`; se recoge aquí el 2026-10-28.

| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Regla pura de la guía: orden fijo, siguiente paso, estado por paso, posposición, aviso por inactividad y roles (`src/lib/setup-guide.ts`) | CA-1 a CA-8 | `src/lib/setup-guide.test.ts` (no se ha comprobado que fallara sobre el commit base) |
| — | Guía en el Agente | CA-9, CA-10 | por nombrar en el brief; sin unidad asignada |

### Tabla de los 8 pasos (derivada del código, 2026-10-26)
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
- El estado completado ya se deriva de datos (`done(d)`), sin guardar aparte; es la base de la nota técnica de la sección 13.
- Los roles del paso 7 y 8 no están restringidos: CA-8 solo aplica a los pasos 1 a 6.
- No hay estado «pospuesto» ni fecha de posposición en ningún sitio: es nuevo (sección 10).

**Orden único propuesto (por validar por Fede):** el del wizard (1 a 8), porque va de estrategia a ejecución y mantiene «paso 2» siempre igual. Regla de siguiente paso: el primer pendiente no pospuesto en ese orden. Implica cambiar el detector, que hoy usa peso. Alternativa: orden por peso, que pone la cuota antes que segmentos.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Regla pura sobre `SETUP_ITEMS`/`setupStatus` (`src/lib/setup-schema.ts`); reutilizar detector `src/lib/proactive/detectors/setup-incomplete.ts` y `next-steps`.
- **Uso de LLM:** cero para decidir el siguiente paso (regla determinista). Opcional: reformular el motivo con modelo barato (`effort: "low"`), con caché por (paso, empresa) y plantilla de respaldo si falla.
- Estado completado derivado de datos, no guardado aparte, para evitar incoherencias.

## 14. Riesgos y dependencias
- Dueño de la regla de «completo»: SDD universal de campos. Este SDD y el de onboarding solo la consumen.
- Mecanismo de aviso compartido con el SDD de onboarding (un único detector para ambos).
- Ruido: demasiados avisos. Mitigación: máximo un aviso por sesión y posposición.
- Depende del SDD universal (definición única de completo).

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Dónde viven hoy las definiciones de completo y cuántas son distintas?
2. ¿Puede el estado derivarse siempre de datos?

## 16. Pendiente de verificar
- [Por verificar] Si el diagnóstico GTM se puede compartir a nivel empresa sin cambios de permisos.
- [Por verificar] Línea base de finalización (sin dato).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Un agente `nokko-gate` con contexto fresco lee este SDD y el código, y devuelve su informe. El coordinador lo copia aquí sin editarlo. El gate no aprueba el SDD: informa; la aprobación es de Fede.
Informe del gate recibido el 2026-10-28, copiado sin editar. El veredicto no aprueba el SDD: la aprobación es de Fede.
- **Veredicto del gate:** Objeciones
- **CA sin prueba posible o sin G-n:** todos citan G-3, que existe (PRD:26). CA-9 y CA-10 no tienen test («por nombrar», SDD:53-54). CA-3 pide «igual en pantalla y Agente», pero el test solo compara `guideState` consigo mismo (setup-guide.test.ts:31-34). CA-6 no prueba «en el Agente y en Inicio», solo `nudgeDue` (test:110-128). CA-7 no prueba la persistencia: no hay tabla de posposición por paso, y `snoozed_until` es de sugerencias (types.ts:4714). CA-5 es parcial, como el propio SDD admite.
- **[Por verificar] que sigue sin comprobarse:** el del diagnóstico compartible. AGENTS.md:28 confirma que se guarda por usuario en `onboarding_sessions`, pero no leí su RLS. La línea base no se puede comprobar en el repo.
- **Contradicciones con el código o con decisiones previas:**
  - La §12 dice «sin unidades» y la §18 «Sin entrega» (SDD:78, 138), pero el commit `f2e0449` ya entrega U-1 con CA-1 a CA-8.
  - El orden está «por validar por Fede» (SDD:108), pero el código ya lo fija (test:24-30).
  - El detector sigue ordenando por peso (setup-schema.ts:72, setup-incomplete.ts:7, proactive.test.ts:130). El comentario de setup-guide.ts:4 dice lo contrario.
  - La §8 dice «invitado ve solo los suyos» (SDD:61), pero `stepsFor` muestra también los pendientes ajenos (setup-guide.ts:91).
  - El enlace de CA-1 es `/strategy` (test:49), mientras que la tabla dice `?tab=pillars` (SDD:93).
  - La §6 elimina definiciones de completo y comparte el diagnóstico (SDD:34-35), pero nada de eso está en el alcance de la §5 ni en ningún CA.
  - El `next-steps` de la §13 no existe como detector. Solo hay `nextSteps` en bmad/phases.ts:36.
  - «Un aviso por sesión» (SDD:118) no tiene CA.
  - La caché de la §11 no figura en la §10.
- **Cifras sin fuente:** «(5 min)» (SDD:64).
- **Lo que esta revisión NO demuestra:** no ejecuté los tests, no revisé la UI ni el Agente, y no leí la RLS de `onboarding_sessions`.

## 18. Delta de implementación
Reconstruido el 2026-10-28 desde el historial de git; no es el informe de entrega de la sesión que lo implementó.
- U-1 entregada en `f2e0449` (`feat(setup): pure guide rule with one fixed order, snooze, roles and nudge`, SDD strategy-setup-guided-next-step, U-1, CA-1 a CA-8). El commit añade solo `src/lib/setup-guide.ts` y `src/lib/setup-guide.test.ts`. A 2026-10-28 ningún otro archivo de `src` importa el módulo (comprobado con `grep`): la regla existe y está probada, pero no está conectada a ninguna pantalla.
- CA-9 y CA-10 (guía en el Agente): sin entrega registrada.
- La tabla de la sección 12 («Tabla de los 8 pasos») sigue pendiente de validar por Fede, según el Estado de la cabecera.

---
Validación: migrado a la plantilla de NOKKO el 2026-10-28. Revisión técnica: ver sección 17. `AUDIT-20261025.md` es el registro histórico anterior.
