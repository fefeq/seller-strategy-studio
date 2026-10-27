# SDD-20261025-strategy-setup-guided-next-step · [Mejora] «Configura tu estrategia» que guía

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** En curso (Aprobado por Fede, 2026-10-26; tabla de la sección 11 validada con el orden del wizard; U-1 a U-6 hechas; correcciones de la auditoría independiente hechas el 2026-10-27, salvo CA-6 y la reaparición de la sugerencia, que esperan decisión de Fede; migración 0062 verificada en réplica local, no aplicada a la base real; falta la parte de diagnóstico compartido) · **Pide:** Fede · **Para:** Fede · **Fecha:** 2026-10-25
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
Cada una con mi recomendación. Nada de esto está implementado hasta que decidas.
1. **Actividad del CA-6 (bloqueante de esa corrección).** Hoy la «actividad» es el último `updated_at` de las tablas de los 8 pasos, y `updated_at` también lo mueven procesos automáticos (enriquecimientos, sincronizaciones, triggers). Con los datos actuales no se pueden separar: `set_audit` pone `updated_at = now()` siempre y, si escribe un proceso sin sesión, deja el `updated_by` anterior. Solo `field_edit_log` distingue personas (`changed_by`), y solo cubre segmentos, ICP, posicionamiento y pilares, no cuentas, deals ni cuotas. Opciones: (A) columna `last_human_edit_at` mantenida por trigger cuando hay `auth.uid()` en las 7 tablas, más migración; (B) medir solo lo que hoy se puede atribuir (`created_by` y `field_edit_log`) y declarar que cuentas, deals y cuotas no cuentan; (C) dejarlo y aceptar el ruido. **Recomiendo A**: es la única que da una respuesta correcta y es una migración pequeña con la misma prueba local que la 0062.
2. **La sugerencia no reaparece al vencer la posposición.** Verificado con prueba: posponer sí cierra `setup_incomplete:<paso>` (en la siguiente pasada del job), pero al vencer el detector vuelve a emitir la misma clave y el `upsert` con `ignoreDuplicates` choca con la fila cerrada o descartada, así que no vuelve a la bandeja. La guía en pantalla y en el Agente sí reaparece. Opciones: (A) incluir el día de fin de la posposición en la clave (`setup_incomplete:<paso>:<día>`) cuando el paso tuvo una; (B) reabrir en `syncSuggestions` la fila cerrada de un paso cuya posposición acaba de vencer. **Recomiendo A**: no toca el esquema ni la lógica de cierre. Efecto secundario: una posposición nueva genera una sugerencia nueva, que es lo que quieres.
3. **Diagnóstico GTM visible para la empresa.** Hoy solo lo lee su autor (`onboarding_sessions`, RLS «Own onboarding in my company»). Opciones: política nueva de lectura entre miembros, o copia a una tabla de empresa. **Recomiendo la política de lectura** (el autor sigue siendo el único que escribe): no duplica datos ni puede desincronizarse.
4. **`BASELINE_MAX` sube de 980 a 985** por las 5 columnas de `setup_step_snoozes` (`org_id` y `created_at` no tienen concepto en el catálogo), contra la regla de que solo baje. **Recomiendo aceptar +5 ahora**, dejado por escrito en `field-baseline.ts`, y abrir en el SDD 1 la regla de columnas técnicas de tablas nuevas para que no se repita.
5. **«Máximo un aviso por sesión»** leído como una vez por sesión en cada sitio (Inicio y Agente), porque el CA-6 pide ambos. **Recomiendo mantener** esa lectura.
6. **Copy del §9.** Faltan dos cosas del mensaje tipo: la duración («5 min») y la grafía de la marca. No hay medida de duración por paso, así que no la escribo (no invento cifras); **recomiendo quitar «(5 min)» del ejemplo** o dame las duraciones. La app escribe «Nokko» en las 326 apariciones; el ejemplo dice «NOKKO». **Recomiendo «Nokko»**, como el resto del producto.
7. **Aviso del CA-5 al descompletar un paso.** Implementado como aviso breve en pantalla («Paso pendiente de nuevo: tu ICP.»), uno por cambio. Confirma si prefieres un mensaje fijo en el panel de progreso en lugar del aviso.
8. **Posponer solo lo pueden hacer los roles que completan el paso** (también en la base de datos). **Recomiendo mantenerlo**; la alternativa es que cualquier miembro pueda posponerle cualquier paso a la empresa.

## 15. Pendiente de verificar
- [Verificado en el código, 2026-10-26] El diagnóstico GTM NO se puede compartir a nivel empresa sin cambiar permisos: vive en `onboarding_sessions.diagnosis` y su RLS («Own onboarding in my company», migración 0052) solo deja leer y escribir filas con `user_id = auth.uid()`. Compartirlo exige una política nueva de lectura entre miembros o copiarlo a una tabla de empresa. Ninguna de las dos se ha hecho: el cambio de «diagnóstico por usuario → visible para la empresa» queda fuera de esta entrega a la espera de tu decisión (punto 3 de la sección 14).
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
| CA-6 | `setup-guide.test.ts` (`nudgeDue`), `proactive.test.ts` (prioridad) | **Pendiente de decisión (§14.1):** hoy los procesos automáticos también cuentan como actividad |
| CA-7 | `setup-guide.test.ts` «CA-7» (día guardado y mostrado igual en cuatro zonas horarias, mínimo del selector), `migrations.pg.test.ts` (migración 0062), `setup-snooze-suggestions.test.ts` | La sugerencia no reaparece al vencer (§14.2): dos pruebas `it.fails` lo documentan |
| CA-8 | `setup-guide.test.ts` (roles, incluida la coincidencia con las herramientas del Agente), `proactive.test.ts` (a quién va la sugerencia), `agent-tools.test.ts` (`estado` por rol), `migrations.pg.test.ts` (función de la base frente a `STEP_ROLES`) | |
| CA-9 | `agent-tools.test.ts` (la herramienta devuelve la guía); la tarjeta «Primera sugerencia» no tiene prueba de componente | |
| CA-10 | `use-setup-guide.test.tsx` «CA-10» (el panel del Agente muestra «Ya tienes … Siguiente: …» al terminar un paso) | Lo que dice el modelo tras una acción confirmada (llamar a `get_setup_status` y usar `guia.mensaje`) no se puede probar sin llamar al modelo: **verificación manual** |

Cargas: el hook de la guía vive en la barra lateral de todas las pantallas; solo consulta con pasos pendientes: las posposiciones (1 consulta), la actividad (7 más) solo en el aviso de Inicio y los miembros solo si el paso pendiente no es del rol (`use-setup-guide.test.tsx`).

Fuera de esta entrega: diagnóstico visible para la empresa (§14.3). Verificado en local, no en la base real: migración 0062 con dos empresas ficticias sobre una réplica en memoria (PGlite), que no es la base de datos. No verificado: recorrido de los flujos en local (la app solo arranca contra el backend real) y el escaneo de seguridad DAST (la aplicación no se ejecutó).

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (pendiente de las decisiones de Fede de la sección 14).
