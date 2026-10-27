# SDD-20261025-strategy-setup-guided-next-step · [Mejora] «Configura tu estrategia» que guía

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** En curso (Aprobado por Fede, 2026-10-26; tabla de la sección 11 validada con el orden del wizard; U-1 a U-6 hechas; correcciones de la auditoría independiente y decisiones de la sección 14 aplicadas el 2026-10-27; migraciones 0062, 0064 y 0065 verificadas en réplica local, no aplicadas a la base real) · **Pide:** Fede · **Para:** Fede · **Fecha:** 2026-10-25
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
Mensaje tipo: «Ya tienes tu ICP. Siguiente: define tu posicionamiento. Así Nokko sabrá qué diferencia contar.» (sin duración por paso: no hay medida; marca escrita «Nokko» como en el resto del producto) Botones: «Empezar», «Más tarde». Todo en «tú», sin iconos.

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

## 12. Notas técnicas [Sugerencia]
- Regla pura sobre `SETUP_ITEMS`/`setupStatus` (`src/lib/setup-schema.ts`); reutilizar detector `src/lib/proactive/detectors/setup-incomplete.ts` y `next-steps`.
- **Uso de LLM:** cero para decidir el siguiente paso (regla determinista). Opcional: reformular el motivo con modelo barato (`effort: "low"`), con caché por (paso, empresa) y plantilla de respaldo si falla.
- Estado completado derivado de datos, no guardado aparte, para evitar incoherencias.
- Posposición: tabla `setup_step_snoozes` (migración 0062). La fecha elegida se guarda como el mediodía de ese día en hora local, que se lee como el mismo día en el navegador y en el servidor del Agente, y se muestra siempre como «3 de noviembre de 2026».
- Roles en la base de datos: las políticas de `setup_step_snoozes` llaman a `can_complete_setup_step(org, paso)`, que repite `STEP_ROLES`; una prueba compara la función con `STEP_ROLES` para todos los pasos y roles. Motivo: sin ello, cualquier miembro podría posponerle a la empresa un paso que no le toca saltándose la interfaz.

## 13. Riesgos y dependencias
- Dueño de la regla de «completo»: SDD universal de campos. Este SDD y el de onboarding solo la consumen.
- Mecanismo de aviso compartido con el SDD de onboarding (un único detector para ambos).
- Ruido: demasiados avisos. Mitigación: máximo un aviso por sesión y posposición.
- Depende del SDD universal (definición única de completo).

## 14. Decisiones para Fede
El 2026-10-27 Fede delegó en el agente cerrar los pendientes: se aplicó la recomendación de cada punto. Revísalas; cualquiera se puede revertir.
1. **Actividad del CA-6: hecho, opción A.** `updated_at` también lo mueven procesos automáticos y no sirve. Migración 0064: columna `last_human_edit_at` en las 7 tablas de los pasos, puesta por trigger solo cuando hay una persona con sesión; el aviso lee esa columna. Límites: lo que una función del servidor hace con la sesión de la persona cuenta como suyo; las filas existentes quedan vacías (sin dato) hasta que alguien las edite, y sin dato no hay aviso. Alternativas descartadas: contar solo `created_by` y `field_edit_log` (no cubre cuentas, deals ni cuotas) o aceptar el ruido.
2. **Sugerencia que reaparece al vencer: hecho.** Un paso cuya posposición acabó usa la clave `setup_incomplete:<paso>:<día en que acabó>`, así que es una sugerencia nueva aunque la anterior se cerrara al posponer o se hubiera descartado. «Quitar posposición» ya no borra la fila: la termina ahora, para que valga lo mismo.
3. **Diagnóstico GTM visible para la empresa: hecho, con una variación.** En vez de ampliar la política de lectura (que habría compartido también propuesta, hallazgos y opiniones), la migración 0065 añade `company_diagnosis(org)`, que devuelve solo el diagnóstico: el tuyo si lo tienes, si no el más reciente de la empresa, y nada a quien no sea miembro. La tarjeta de Inicio la usa.
4. **`BASELINE_MAX` sube de 980 a 992** (5 columnas de `setup_step_snoozes` y 7 de `last_human_edit_at`), contra la regla de que solo baje. Aceptado, dejado por escrito en `field-baseline.ts`. Pendiente fuera de este SDD: la regla de columnas técnicas de tablas nuevas en el SDD 1.
5. **«Máximo un aviso por sesión»:** una vez por sesión en cada sitio (Inicio y Agente). Mantenido.
6. **Copy del §9:** sin «(5 min)» (no hay duración medida) y con «Nokko» como en el resto del producto. Si quieres duraciones, hay que medirlas primero.
7. **CA-5:** aviso breve en pantalla al descompletar un paso. Mantenido.
8. **Posponer** solo lo pueden hacer los roles que completan el paso, también en la base de datos. Mantenido.

## 15. Pendiente de verificar
- [Verificado en el código, 2026-10-26] El diagnóstico GTM vivía en `onboarding_sessions.diagnosis` y su RLS («Own onboarding in my company», migración 0052) solo deja leer filas con `user_id = auth.uid()`. Resuelto el 2026-10-27 con la función `company_diagnosis` (migración 0065), sin ampliar esa política (§14.3).
- [Por verificar] Línea base de finalización (sin dato).

## 16. Decisión de Fede
- Decisiones de la sección 14:
- Decisión: Aprobado / Cambios pedidos / Rechazado

## 17. Entrega (delta y CA → prueba)
Rama `feat/strategy-guided-next-step`. Unidades: U-1 regla pura (`src/lib/setup-guide.ts`), U-2 tabla de posposición (`drizzle/migrations/0062_setup_step_snoozes.sql`), U-3 detector y orden único, U-4 hook y componentes (`src/hooks/use-setup-guide.ts`, `src/components/setup/guide.tsx`), U-5 pantallas (asistente, panel de progreso, Inicio, barra lateral), U-6 Agente.

| CA | Prueba automática | Notas |
|---|---|---|
| CA-1 | `setup-guide.test.ts` «CA-1» (mensaje del §9 y siglas) | Pantalla sin prueba de componente |
| CA-2 | `setup-guide.test.ts` «CA-2» | Se muestra en el panel de progreso al completar |
| CA-3 | `setup-guide.test.ts` (orden fijo), `proactive.test.ts` (detector), `agent-tools.test.ts` (`get_setup_status`) | |
| CA-4 | `setup-guide.test.ts` «CA-4» | |
| CA-5 | `setup-guide.test.ts` «CA-5» (regla del aviso), `use-setup-guide.test.tsx` «CA-5» (el aviso sale una vez y el paso vuelve a Pendiente) | La actualización sin recarga depende de que cada pantalla invalide `["setup"]`: lo hacen los editores de estrategia, el asistente y el pipeline en vivo; no hay prueba de cada una |
| CA-6 | `setup-guide.test.ts` (`nudgeDue`), `proactive.test.ts` (prioridad), `setup-activity.test.ts` (lee `last_human_edit_at`), `migrations.pg.test.ts` (migración 0064: solo personas) | Actividad = último cambio de una persona en los datos de los 8 pasos o una posposición |
| CA-7 | `setup-guide.test.ts` «CA-7» (día guardado y mostrado igual en cuatro zonas horarias, mínimo del selector), `migrations.pg.test.ts` (migración 0062), `setup-snooze-suggestions.test.ts` (cierra al posponer y reaparece al vencer, también si estaba descartada), `use-setup-guide.test.tsx` (quitar posposición) | |
| CA-8 | `setup-guide.test.ts` (roles, incluida la coincidencia con las herramientas del Agente), `proactive.test.ts` (a quién va la sugerencia), `agent-tools.test.ts` (`estado` por rol), `migrations.pg.test.ts` (función de la base frente a `STEP_ROLES`) | |
| CA-9 | `agent-tools.test.ts` (la herramienta devuelve la guía); la tarjeta «Primera sugerencia» no tiene prueba de componente | |
| CA-10 | `use-setup-guide.test.tsx` «CA-10» (el panel del Agente muestra «Ya tienes … Siguiente: …» al terminar un paso) | Lo que dice el modelo tras una acción confirmada (llamar a `get_setup_status` y usar `guia.mensaje`) no se puede probar sin llamar al modelo: **verificación manual** |

Cargas: el hook de la guía vive en la barra lateral de todas las pantallas; solo consulta con pasos pendientes: las posposiciones (1 consulta), la actividad (7 más) solo en el aviso de Inicio y los miembros solo si el paso pendiente no es del rol (`use-setup-guide.test.tsx`).

Diagnóstico visible para la empresa: función en `migrations.pg.test.ts` (migración 0065); la tarjeta de Inicio que la usa no tiene prueba de componente. Verificado en local, no en la base real: migraciones 0062, 0064 y 0065 con dos empresas ficticias sobre una réplica en memoria (PGlite), que no es la base de datos. No verificado: recorrido de los flujos en local (la app solo arranca contra el backend real) y el escaneo de seguridad DAST (la aplicación no se ejecutó).

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (pendiente de las decisiones de Fede de la sección 14).
