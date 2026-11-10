# SDD-20261110-plays-phase-autonomy-deps · [Mejora] Fase, nivel de aprobación y dependencias en los 28 plays

**Tipo:** Mejora · **Prioridad propuesta:** Media (es el cimiento del diagnóstico; no toca base de datos ni la lógica de ningún play)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-10
**Ticket:** NK-0126 (iniciativa; este es su SDD 1)
**PRD:** `docs/prd/PRD-20261110-diagnostico-y-equipos-de-plays.md` (cubre G-1, G-2, G-3) · **Depende de:** `SDD-20261106-plays-library-core.md` (NK-0063, entregado) · **Coordinar con:** SDD 2 de plays (`plays-signals-decay`) y NK-0081, NK-0082, NK-0083, que tocan el mismo catálogo

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra.

## 1. Resumen
Cada uno de los 28 plays del catálogo (`src/lib/plays/catalog.ts`) recibe tres datos nuevos: **fase** (fundación, captura, generación, orquestación), **nivel de aprobación** (quién prepara y quién decide; sigue siendo siempre un borrador) y **dependencias** (ids de otros plays que tienen que existir antes). Con ellos, una función pura dice qué plays se pueden recomendar y en qué orden. La pantalla `/plays` y las herramientas del agente muestran la fase y el nivel con palabras. Es un cambio de tipos, datos del catálogo y pruebas; no hay migración.

## 2. Problema y para quién
El catálogo dice el estado de cada play pero no en qué orden activarlos ni qué papel tiene la persona. Sin eso, el diagnóstico (SDD 4 de la iniciativa) no puede ordenar «por fase y dependencias» (decisión 10) ni recomendar solo lo que se puede hacer (G-3). Para Owner y Sales Leader, que son quienes activan plays.

## 3. Evidencia y por qué ahora
Leído en `main` @ `aa368b62` (rama de este trabajo; el código es el de `d3eeba1`), el 2026-11-10:
- `src/lib/plays/catalog.ts:48-` define `Play` con `id, title, motion, channels, status, blockedBy, needs, detectors, defaultEnabled, outputs, gates, sdd`. No hay fase, nivel ni dependencias.
- `needs` es **texto libre en español** (por ejemplo `"Notas de llamada"`, `catalog.ts:79`), no ids de plays: **no se puede deducir las dependencias de `needs`**. La decisión 19 del PRD («del PRD de plays y del campo `needs`») se resuelve añadiendo un campo nuevo de ids; `needs` queda como texto para la pantalla.
- Estado real: 12 plays construibles con datos propios (11 `parcial` y `pain-qualified-segments` en `planificado`; el PRD de plays lo llamaba «nuevo interno») y 16 `bloqueado`, con `blockedBy` entre `proveedor_datos`, `linkedin_d2`, `decision_gtm` y `fuente_externa` (lectura de `catalog.ts`).
- `src/lib/plays/status.ts:38-42` (`canTogglePlays`): solo `owner` y `sales_leader` activan; `:46-` `blocking()`: un play `bloqueado` o `planificado` nunca se activa. El diagnóstico reutiliza esta regla.
- `src/lib/plays/catalog.test.ts` ya prueba que hay 28 plays con ids únicos (`:13`), estados honestos (`:105`) y que las salidas son solo `suggestion`, `task` o `draft` (`:118-127`).
- `src/lib/agent/tools/plays.ts` expone `list_plays`, `get_play` y `set_play_enabled`; `src/lib/plays/view.ts` define las palabras de estado, movimiento y canal de `/plays`.
- La clasificación por fase y autonomía viene de SkillTree (análisis `ANALISIS-20261110-skilltree-para-nokko.md`, referencia externa): se copia la idea de clasificar, no su texto ni sus asignaciones; los valores de la tabla del §13 son propuesta propia.
- Sin datos de uso: todas las líneas base son «sin dato».

**Por qué ahora:** el SDD 2 de plays (señales con peso y caída) y los hallazgos NK-0081 a NK-0083 también tocan `catalog.ts`; añadir los campos antes evita reescribir cada play dos veces.

## 4. Resultado buscado
Referencia a los objetivos del PRD:
- G-1: el diagnóstico puede ordenar por fase y dependencias. Medida: plays del catálogo con fase, nivel y dependencias válidas; 28 de 28. Línea base: 0 de 28 (los campos no existen). Fuente: `catalog.test.ts`.
- G-2: ningún nivel permite un envío automático. Medida: salidas de tipo «envío» = 0, por prueba.
- G-3: ningún play bloqueado, planificado o dependiente de uno de ellos se recomienda. Medida: recomendaciones de plays no recomendables = 0, por prueba.

## 5. Alcance
**Incluye:**
- Campos `phase`, `approval` y `dependsOn` en `Play` y sus valores para los 28 plays.
- Función pura `recommendablePlays` (plays recomendables y su orden).
- Palabras y filtro por fase en `/plays` y campos en `list_plays`/`get_play`.
- Pruebas de catálogo, orden, dependencias y herramientas.

**No incluye:** (es el límite que el brief copia a «Movimientos prohibidos»)
- Migraciones, tablas o columnas nuevas; `play_states` y `play_runs` no cambian.
- Lógica de ejecución de ningún play (SDD 2 a 9 de plays).
- Los equipos de plays y el diagnóstico (SDD 2 y 4 de esta iniciativa).
- Cambiar `status`, `blockedBy`, `detectors`, `defaultEnabled`, `outputs` o `gates`.
- Horas, dinero o puntuaciones en la pantalla.
- Pantallas nuevas.

## 6. Cambios de comportamiento (delta)
**Añadido:** fase, nivel de aprobación y dependencias por play; función `recommendablePlays`; filtro por fase en `/plays`; campos nuevos en dos herramientas del agente.
**Modificado:** el tipo `Play` y el contenido de `CATALOG`; las palabras de `/plays` (se muestra la fase y el nivel junto al estado).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero ver la fase y el papel de la persona en cada play para entender en qué orden activarlos.
- **CA-1** Los 28 plays tienen `phase` con uno de estos cuatro valores: `fundacion`, `captura`, `generacion`, `orquestacion` · cubre G-1 · prueba: `src/lib/plays/catalog.test.ts`
- **CA-2** Los 28 plays tienen `approval` con uno de estos tres valores: `persona_prepara` («Lo prepara una persona; NOKKO te avisa»), `nokko_con_ayuda` («NOKKO prepara con tu ayuda; tú decides») y `nokko_borrador` («NOKKO prepara el borrador entero; tú lo apruebas»). Ningún valor implica enviar, publicar o cambiar datos sin confirmación, y las salidas siguen siendo solo `suggestion`, `task` o `draft` · cubre G-2 · prueba: `src/lib/plays/catalog.test.ts`
- **CA-3** `/plays` muestra con palabras la fase y el nivel de cada play y permite filtrar por fase; el filtro actual por movimiento y estado no cambia · cubre G-1 · prueba: `src/lib/plays/view.test.ts`
- **CA-4** `list_plays` y `get_play` devuelven fase y nivel con las mismas palabras que la pantalla · cubre G-1 · prueba: `src/lib/agent-tools.test.ts`

### H-2: Como Owner o Sales Leader, quiero que el diagnóstico solo recomiende lo que se puede hacer ya.
- **CA-5** Todo id de `dependsOn` existe en el catálogo, ningún play depende de sí mismo y no hay ciclos · cubre G-1 · prueba: `src/lib/plays/catalog.test.ts`
- **CA-6** `recommendablePlays` nunca devuelve un play `bloqueado` o `planificado`, ni uno que dependa (directa o indirectamente) de uno que no se pueda recomendar · cubre G-3 · prueba: `src/lib/plays/recommend.test.ts`
- **CA-7** `recommendablePlays` ordena por fase (fundación, captura, generación, orquestación) y, dentro de la fase, un play siempre va después de aquello de lo que depende; el resultado es estable ante el mismo catálogo · cubre G-1 · prueba: `src/lib/plays/recommend.test.ts`
- **CA-8** Un play que no está activado se recomienda igual (es una recomendación, no una activación); activar sigue exigiendo Owner o Sales Leader y las reglas de `blocking()` de `status.ts` no cambian · cubre G-2 · prueba: `src/lib/plays/status.test.ts`

## 8. Casos límite y errores
- Un play bloqueado del que dependen otros: los dependientes quedan fuera de la recomendación y se muestran con el motivo del primero (CA-6).
- Un catálogo con un id inexistente en `dependsOn` o un ciclo: la prueba de catálogo falla y el build no pasa (CA-5); en ejecución, `recommendablePlays` ignora el play inválido en vez de romper la pantalla **[Por verificar]** con el gate si prefiere lanzar error.
- Empresa sin filas en `play_states`: la recomendación no depende de `play_states`; todos los plays aparecen con su valor por defecto.
- Multitenant: el catálogo es código común; no se lee ni escribe ningún dato de otra empresa.

## 9. Experiencia y copy
- Fases (textos propuestos): «Fundación», «Captura», «Generación», «Orquestación».
- Niveles (textos propuestos): «Lo prepara una persona», «NOKKO prepara, tú decides», «NOKKO redacta, tú apruebas».
- Siempre con palabra, nunca solo con icono o color. Sin iconos nuevos.
- Los textos son propuesta; Fede los revisa en la aprobación.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, migraciones, RLS ni GRANTs nuevos. Datos de código, no de clientes. Permisos de activación sin cambios (Owner y Sales Leader, `canTogglePlays`).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | — | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Tipo `Play` con `phase`, `approval`, `dependsOn` y valores de los 28 plays | CA-1, CA-2, CA-5 | `src/lib/plays/catalog.test.ts` |
| U-2 | `recommendablePlays` (`src/lib/plays/recommend.ts`) | CA-6, CA-7, CA-8 | `src/lib/plays/recommend.test.ts` |
| U-3 | Palabras y filtro por fase en `view.ts` y `plays-panel.tsx` | CA-3 | `src/lib/plays/view.test.ts` |
| U-4 | Campos nuevos en `list_plays` y `get_play` (y título en `TITLES` si cambia; refrescar `.lovable/mcp/manifest.json`) | CA-4 | `src/lib/agent-tools.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Reutiliza la estructura `seed()` de `catalog.ts`; añade los tres campos en `Seed` sin tocar `defaultEnabled`, `gates` ni `outputs`.
- `recommendablePlays` es una función pura sobre el catálogo, sin I/O, igual que `status.ts` y `view.ts`.
- Nombres de código en inglés (`phase`, `approval`, `dependsOn`); valores en español sin tildes como en `motion` y `channels`.
- Si se prefiere un solo SDD con el SDD 2 de plays, este se absorbe allí.

**Valores propuestos para los 28 plays** (propuesta de redacción, no decisión; Fede los revisa en la aprobación. Fase y nivel salen del propósito de cada play según `catalog.ts` y el PRD de plays, no de SkillTree):
| Play | Fase | Nivel | Depende de |
|---|---|---|---|
| `meeting-prep-and-follow-up` | generacion | nokko_borrador | — |
| `meeting-form-orchestration` | captura | nokko_borrador | — |
| `closed-lost-revival` | generacion | nokko_con_ayuda | `signals-in-crm-with-decay` |
| `signals-in-crm-with-decay` | captura | nokko_borrador | — |
| `signal-activation` | orquestacion | nokko_borrador | `signals-in-crm-with-decay` |
| `call-transcript-signal-extraction` | captura | nokko_borrador | — |
| `pain-qualified-segments` | fundacion | nokko_con_ayuda | `call-transcript-signal-extraction` |
| `hubspot-account-tiering-scoring` | fundacion | nokko_con_ayuda | — |
| `crm-hygiene` | captura | nokko_con_ayuda | — |
| `plg-to-sales` | captura | nokko_borrador | — |
| `product-sign-up-outreach` | generacion | nokko_borrador | — |
| `multi-thread-inbound-leads` | generacion | nokko_con_ayuda | — |
| `website-visitor-de-anonymization` | captura | nokko_borrador | — |
| `review-site-intent-scoring` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `new-hire-tracking` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `hiring-signal-monitoring` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `funding-signal-scraping` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `tech-stack-signal-detection` | fundacion | nokko_borrador | — |
| `brand-mentions-monitoring` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `competitor-post-engagers` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `target-account-exec-posts` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `founder-connections-mining` | fundacion | nokko_con_ayuda | — |
| `webinar-attendee-capture` | captura | nokko_borrador | — |
| `automated-reply-enrichment` | captura | nokko_borrador | — |
| `abm-ads` | fundacion | nokko_con_ayuda | — |
| `public-records-signals` | captura | nokko_borrador | `signals-in-crm-with-decay` |
| `public-filings-qualification` | captura | nokko_borrador | — |
| `local-business-tam` | fundacion | nokko_borrador | — |

Las dependencias salen del PRD de plays §8: el SDD 8 (señales externas) y el SDD 9 dependen del SDD 2 (señales con peso y caída); `closed-lost-revival` «usa 2 para algo cambió»; `pain-qualified-segments` depende de `call-transcript-signal-extraction` (tabla del PRD de plays). **[Por verificar]** que cada play externo de señales dependa de verdad de ese modelo y no solo del SDD, y si `public-filings-qualification` y `local-business-tam` también.

## 14. Riesgos y dependencias
- **Conflicto de ramas** con el SDD 2 de plays y con NK-0081 a NK-0083 en `catalog.ts`: coordinar o integrar en orden (§3).
- **Clasificación opinable:** fase y nivel de algunos plays son juicio; por eso los valores son propuesta y la prueba solo exige que existan y sean coherentes.
- **Palabra «agente» ya usada** para el asistente: aquí no se usa para los plays.
- **NK-0077/NK-0078:** el catálogo manda sobre las reglas proactivas; añadir campos no cambia `defaultEnabled`.

## 15. Preguntas para Fede y para la revisión técnica
1. ¿Los tres textos de nivel y los cuatro de fase te sirven, o prefieres otros nombres?
2. ¿Revisas la tabla del §13 play por play, o la apruebas y se ajusta en la revisión?
3. ¿Se integra aquí o dentro del SDD 2 de plays para evitar conflicto en `catalog.ts`?
4. Para el gate: ¿`recommendablePlays` debe ignorar un play inválido o lanzar error en ejecución?

## 16. Pendiente de verificar
- Que no haya otro uso de `Play` (importaciones de `catalog.ts`) que rompa al añadir campos obligatorios: lo comprueba el compilador y el gate.
- Dependencias de los plays externos (§13).
- Que los nombres `TITLES` y `.lovable/mcp/manifest.json` no cambien con los campos nuevos (U-4).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
