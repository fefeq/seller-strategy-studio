# SDD-20261025-strategy-setup-guided-next-step · [Mejora] «Configura tu estrategia» que guía

**Tipo:** Mejora · **Prioridad propuesta:** Alta
**Estado:** En curso (Aprobado por Fede, 2026-10-27; ledger: NK-0008 SHIPPED, cierre en SDD-20261101-strategy-setup-closeout) · **Pide:** Fede · **Para:** Claude Code · **Fecha:** 2026-10-25
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
**Incluye:** siguiente paso recomendado tras cada paso; panel de progreso con estado real; aviso proactivo en el Agente y en pantalla; motivo de cada paso; posibilidad de posponer; actividad del aviso solo de personas (migración 0064, con el arreglo de «Deshacer» 0066 y su índice 0067); diagnóstico visible para la empresa (migración 0065, propuesta del §14.5).
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

## 12. Notas técnicas [Sugerencia — se valida en la implementación]
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

## 14. Decisiones abiertas (recomendación de Claude)
**Propuestas de Claude Code, pendientes de confirmar por Fede.** Fede no ha decidido ninguna: están implementadas en el PR para poder revisarlas y cada una se revierte con un commit. Lo que Claude Code pudo comprobar en el código está en el §15.
1. **Actividad del CA-6 solo de personas (propuesta, opción A).** `updated_at` también lo mueven procesos automáticos (enriquecimientos, sincronizaciones, triggers) y no sirve: `set_audit` lo pone siempre y, sin sesión, deja el `updated_by` anterior. Migración 0064: columna `last_human_edit_at` en las 7 tablas de los pasos, puesta por un trigger solo cuando hay una persona con sesión. Límite: lo que una función del servidor hace con la sesión de la persona cuenta como suyo. Alternativas: contar solo `created_by` y `field_edit_log` (no cubre cuentas, deals ni cuotas) o aceptar el ruido. Recomiendo A. Consecuencias ya resueltas en el PR: confirmar un campo mueve la columna y rompía «Deshacer» (0066, que la ignora en el registro y en la comparación del deshacer, en vez de no estamparla en las confirmaciones, porque confirmar sí es actividad de una persona); y el índice parcial de la 0067 para las siete consultas del aviso (recomiendo el índice a una consulta única, que seguiría recorriendo las tablas).
2. **Respaldo cuando no hay dato de actividad (propuesta).** Las filas existentes no tienen `last_human_edit_at` hasta que alguien las edita, y sin dato no habría aviso para ninguna empresa que ya exista. Propuesta: si ningún paso tiene valor y no hay posposiciones, la actividad es la fecha de alta de la empresa. Una edición real o una posposición ganan siempre. Efecto: una empresa que nunca volvió recibe el aviso al pasar un día desde el alta. Alternativa: no avisar hasta la primera edición. Recomiendo el respaldo.
3. **La sugerencia vuelve (propuesta).** Un paso cuya posposición acabó usa la clave `setup_incomplete:<paso>:<instante en que acabó, en segundos>`, y una sugerencia que el sistema cerró como «resuelta» se reabre cuando su clave se emite de nuevo (cambio de orden, paso reabierto por una edición, nuevo trimestre de la cuota). Una descartada por la persona sigue descartada. «Quitar posposición» termina la posposición ahora en lugar de borrar la fila. Alternativa: añadir un periodo a la clave. Recomiendo esto porque no toca el esquema.
4. **`BASELINE_MAX` sube de 980 a 992, a decidir por Fede.** 5 columnas de `setup_step_snoozes` y 7 de `last_human_edit_at`, contra la regla de que solo baje, porque `org_id`, `created_at` y las columnas técnicas no tienen concepto en el catálogo. Recomiendo aceptar el aumento y abrir en el SDD 1 la regla de columnas técnicas de tablas nuevas.
5. **Diagnóstico GTM visible para la empresa: función `company_diagnosis` (migración 0065), a decidir por Fede.** Hoy solo lo lee su autor (`onboarding_sessions`, RLS «Own onboarding in my company»). Ampliar esa política compartiría también propuesta, hallazgos y opiniones, así que la propuesta es una función que devuelve solo el diagnóstico a los miembros: el suyo si lo tiene, si no el más reciente de la empresa. La tarjeta de Inicio la usa. Alternativas: la política de lectura entre miembros, o una copia a una tabla de empresa. Recomiendo la función. Si Fede prefiere otra visibilidad, se cambia la 0065 sin tocar el resto.
6. **«Máximo un aviso por sesión»:** una vez por sesión en cada sitio (Inicio y Agente), porque el CA-6 pide ambos. Recomiendo mantenerlo.
7. **Copy del §9:** sin «(5 min)» porque no hay duración medida por paso, y con «Nokko», como en el resto del producto (el ejemplo decía «NOKKO»). Si Fede quiere duraciones, hay que medirlas primero.
8. **CA-5 y roles:** aviso breve en pantalla al descompletar un paso, y solo pueden posponer un paso los roles que pueden completarlo, también en la base de datos. Recomiendo mantenerlos.
9. **Migración 0062 editada en el sitio.** Se añadió `DROP POLICY IF EXISTS` antes de cada política porque ningún documento ni lista de comprobación la registra como aplicada en una base real. Claude Code no pudo comprobarlo contra la base de NOKKO. Fede debe confirmar que no está aplicada; si lo está, el cambio no afecta a lo ya aplicado y la 0062 no se vuelve a ejecutar.

## 15. Pendiente de verificar
- [Verificado en el código, 2026-10-26] El diagnóstico GTM vive en `onboarding_sessions.diagnosis` y su RLS («Own onboarding in my company», migración 0052) solo deja leer filas con `user_id = auth.uid()`. Compartirlo exige una política nueva de lectura entre miembros, una copia a una tabla de empresa o una función como `company_diagnosis` (propuesta del §14.5, migración 0065).
- [Por verificar] Que la migración 0062 no esté aplicada en ninguna base real (§14.9).
- [Por verificar] Línea base de finalización (sin dato).

## 16. Registro de decisiones (lo completa Fede)
- Decisiones tomadas:
- Fecha:
- Decisión: Aceptado / Cambios pedidos / Rechazado

## 17. Entrega (delta y CA → prueba)
Rama `feat/strategy-guided-next-step`. Unidades: U-1 regla pura (`src/lib/setup-guide.ts`), U-2 tabla de posposición (`drizzle/migrations/0062_setup_step_snoozes.sql`), U-3 detector y orden único, U-4 hook y componentes (`src/hooks/use-setup-guide.ts`, `src/components/setup/guide.tsx`), U-5 pantallas (asistente, panel de progreso, Inicio, barra lateral), U-6 Agente, U-7 actividad solo de personas (`drizzle/migrations/0064_last_human_edit_at.sql`, `loadSetupGuideExtras`), U-8 diagnóstico de la empresa (`drizzle/migrations/0065_company_diagnosis.sql`), U-9 «Deshacer» con la 0064 (`drizzle/migrations/0066_undo_ignores_last_human_edit.sql`), U-10 índice de la actividad (`drizzle/migrations/0067_last_human_edit_index.sql`).

| CA | Prueba automática | Notas |
|---|---|---|
| CA-1 | `setup-guide.test.ts` «CA-1» (mensaje del §9 y siglas) | Pantalla sin prueba de componente |
| CA-2 | `setup-guide.test.ts` «CA-2» | Se muestra en el panel de progreso al completar |
| CA-3 | `setup-guide.test.ts` (orden fijo), `proactive.test.ts` (detector), `agent-tools.test.ts` (`get_setup_status`) | |
| CA-4 | `setup-guide.test.ts` «CA-4» | |
| CA-5 | `setup-guide.test.ts` «CA-5» (regla del aviso), `use-setup-guide.test.tsx` «CA-5» (el aviso sale una vez y el paso vuelve a Pendiente) | La actualización sin recarga depende de que cada pantalla invalide `["setup"]`: lo hacen los editores de estrategia, el asistente y el pipeline en vivo; no hay prueba de cada una |
| CA-6 | `setup-guide.test.ts` (`nudgeDue`), `proactive.test.ts` (prioridad), `setup-activity.test.ts` (lee `last_human_edit_at`, respaldo con la fecha de alta), `migrations.pg.test.ts` (0064 solo personas; 0066 «Deshacer»; 0067 índice), `use-setup-guide.test.tsx` (volver a posponer cuenta) | Actividad = último cambio de una persona en los datos de los 8 pasos, una posposición o, sin nada de eso, la fecha de alta (§14.2) |
| CA-7 | `setup-guide.test.ts` «CA-7» (día guardado y mostrado igual en cuatro zonas horarias, mínimo del selector), `migrations.pg.test.ts` (migración 0062), `setup-snooze-suggestions.test.ts` (cierra al posponer, reaparece al vencer también si estaba descartada, reabre las resueltas con dos pasos, posponer y quitar dos veces el mismo día), `use-setup-guide.test.tsx` (quitar posposición) | |
| CA-8 | `setup-guide.test.ts` (roles, incluida la coincidencia con las herramientas del Agente), `proactive.test.ts` (a quién va la sugerencia), `agent-tools.test.ts` (`estado` por rol), `migrations.pg.test.ts` (función de la base frente a `STEP_ROLES`) | |
| CA-9 | `agent-tools.test.ts` (la herramienta devuelve la guía); la tarjeta «Primera sugerencia» no tiene prueba de componente | |
| CA-10 | `use-setup-guide.test.tsx` «CA-10» (el panel del Agente muestra «Ya tienes … Siguiente: …» al terminar un paso) | Lo que dice el modelo tras una acción confirmada (llamar a `get_setup_status` y usar `guia.mensaje`) no se puede probar sin llamar al modelo: **verificación manual** |

Cargas: el hook de la guía vive en la barra lateral de todas las pantallas; solo consulta con pasos pendientes: las posposiciones (1 consulta), la actividad (7 más) solo en el aviso de Inicio y los miembros solo si el paso pendiente no es del rol (`use-setup-guide.test.tsx`).

Diagnóstico visible para la empresa: función en `migrations.pg.test.ts` (migración 0065); la tarjeta de Inicio que la usa no tiene prueba de componente. Verificado en local, no en la base real: migraciones 0062, 0064, 0065, 0066 y 0067 con dos empresas ficticias sobre una réplica en memoria (PGlite), que no es la base de datos. No verificado: recorrido de los flujos en local (la app solo arranca contra el backend real) y el escaneo de seguridad DAST (la aplicación no se ejecutó).

---
Validación: OK (autorrevisión). Auditoría: ver AUDIT-20261025.md (pendiente de las decisiones de Fede de la sección 14).
