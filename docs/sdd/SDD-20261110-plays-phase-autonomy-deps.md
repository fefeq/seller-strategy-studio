# SDD-20261110-plays-phase-autonomy-deps · [Mejora] Fase, nivel de aprobación y dependencias en los 28 plays

**Tipo:** Mejora · **Prioridad propuesta:** Media (es el cimiento del diagnóstico; no toca base de datos ni la lógica de ningún play)
**Estado:** Hecho — PR #123 (f2b9ebe). Aprobado (2026-11-10, por delegación de Fede: «si ejecuta todo vos»; dos pasadas de `nokko-gate`, objeciones de la segunda resueltas en el texto sin tercera pasada) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-10
**Ticket:** NK-0126 (iniciativa; este es su SDD 1)
**PRD:** `docs/prd/PRD-20261110-diagnostico-y-equipos-de-plays.md` (cubre G-2 y G-3; prepara G-1, que se mide en el SDD 4) · **Depende de:** `SDD-20261106-plays-library-core.md` (NK-0063, entregado) · **Coordinar con:** SDD 2 de plays (`plays-signals-decay`) y NK-0081, NK-0082, NK-0083, que tocan el mismo catálogo

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra.

## 1. Resumen
Cada uno de los 28 plays del catálogo (`src/lib/plays/catalog.ts`) recibe tres datos nuevos: **fase** (fundación, captura, generación, orquestación), **nivel de aprobación** (quién prepara y quién decide; sigue siendo siempre un borrador) y **dependencias** (ids de otros plays que tienen que funcionar antes; solo dependencias entre plays, no el orden de construcción de los SDD). Con ellos, una función pura dice qué plays se pueden recomendar y en qué orden. La pantalla `/plays` y las herramientas del agente muestran la fase y el nivel con palabras. Es un cambio de tipos, datos del catálogo y pruebas; no hay migración.

## 2. Problema y para quién
El catálogo dice el estado de cada play pero no en qué orden activarlos ni qué papel tiene la persona. Sin eso, el diagnóstico (SDD 4 de la iniciativa) no puede ordenar «por fase y dependencias» (decisión 10) ni recomendar solo lo que se puede hacer (G-3). Para Owner y Sales Leader, que son quienes activan plays.

## 3. Evidencia y por qué ahora
Leído en la rama `chore/ledger-sprint5-intake-20261110` @ `aa368b62`, que no cambia nada en `src/` respecto a `main` @ `d3eeba1`, el 2026-11-10:
- `src/lib/plays/catalog.ts:43-` define `Play` con `id, title, motion, channels, status, blockedBy, needs, detectors, defaultEnabled, outputs, gates, sdd`. No hay fase, nivel ni dependencias.
- `needs` es **texto libre en español** (por ejemplo `"Notas de llamada"`, `catalog.ts:79`), no ids de plays: **no se puede deducir las dependencias de `needs`**. La decisión 19 del PRD («del PRD de plays y del campo `needs`») se resuelve añadiendo un campo nuevo de ids; `needs` queda como texto para la pantalla.
- Estado real: 12 plays construibles con datos propios (11 `parcial` y `pain-qualified-segments` en `planificado`; el PRD de plays lo llamaba «nuevo interno») y 16 `bloqueado`, con `blockedBy` entre `proveedor_datos`, `linkedin_d2`, `decision_gtm` y `fuente_externa` (lectura de `catalog.ts`).
- `src/lib/plays/status.ts:38-42` (`canTogglePlays`): solo `owner` y `sales_leader` activan; `:45` `blocking()` (no exportada): un play `bloqueado` o `planificado` nunca se activa. El diagnóstico reutiliza esta regla.
- `src/lib/plays/catalog.test.ts` ya prueba que hay 28 plays con ids únicos (`:13`), estados honestos (`:105`) y que las salidas son solo `suggestion`, `task` o `draft` (`:118-133`).
- `src/lib/agent/tools/plays.ts` expone `list_plays`, `get_play` y `set_play_enabled` (probadas en `src/lib/agent/tools/plays.test.ts`); `src/lib/plays/view.ts` define las palabras de estado, movimiento y canal de `/plays`.
- La clasificación por fase y autonomía viene de SkillTree (análisis `ANALISIS-20261110-skilltree-para-nokko.md`, referencia externa): se copia la idea de clasificar, no su texto ni sus asignaciones; los valores de la tabla del §13 son propuesta propia.
- Sin datos de uso: todas las líneas base son «sin dato».

**Por qué ahora:** el SDD 2 de plays (señales con peso y caída) y los hallazgos NK-0081 a NK-0083 también tocan `catalog.ts`; añadir los campos antes evita reescribir cada play dos veces.

## 4. Resultado buscado
Referencia a los objetivos del PRD:
- G-1 (se mide en el SDD 4, «diagnósticos terminados con equipo»): este SDD solo lo prepara. Indicador interno de este SDD: plays con fase, nivel y dependencias válidas, 28 de 28; línea base 0 de 28 (los campos no existen). Fuente: `catalog.test.ts`.
- G-2: los niveles no cambian las salidas permitidas (`suggestion`, `task`, `draft`), que ya garantiza `catalog.test.ts:118-133`. Este SDD no añade una prueba nueva para G-2: la existente sigue siendo la guarda (no cuenta como fail-first).
- G-3: el PRD habla de plays «bloqueados»; este SDD lo **amplía** a `planificado` y a los plays que dependen de uno no recomendable, porque tampoco se pueden activar (`status.ts:45`). Medida: recomendaciones de plays no recomendables = 0, por prueba.

## 5. Alcance
**Incluye:**
- Campos `phase`, `approval` y `dependsOn` en `Play` y sus valores para los 28 plays.
- Función pura `recommendablePlays` (plays recomendables y su orden).
- Palabras y filtro por fase en `/plays` (vía `view.ts` y `describePlay` de `status.ts`) y campos de salida en `list_plays`/`get_play`; `list_plays` **no** gana filtro de entrada por fase (su esquema de entrada y el manifiesto no cambian).
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
- **CA-1** Los 28 plays tienen `phase` con uno de estos cuatro valores: `fundacion`, `captura`, `generacion`, `orquestacion` · cubre G-1 (preparación) · prueba: `src/lib/plays/catalog.test.ts`
- **CA-2** Los 28 plays tienen `approval` con uno de estos dos valores: `nokko_con_ayuda` y `nokko_borrador` (textos en §9). No se añade un valor «lo prepara una persona» porque ningún play lo usa hoy · cubre G-1 (preparación); G-2 ya lo guarda `catalog.test.ts:118-133` · prueba: `src/lib/plays/catalog.test.ts`
- **CA-3** `view.ts` exporta las palabras de fase y nivel (§9, un único juego de textos) y `filterPlays` filtra también por fase sin cambiar el filtro por movimiento y estado. Que `plays-panel.tsx` las muestre se comprueba en el recorrido de `nokko-walkthrough`, no con un test · cubre G-1 (preparación) · prueba: `src/lib/plays/view.test.ts`
- **CA-4** `list_plays` y `get_play` devuelven fase y nivel con las mismas palabras de `view.ts` · cubre G-1 (preparación) · prueba: `src/lib/agent/tools/plays.test.ts`

### H-2: Como Owner o Sales Leader, quiero que el diagnóstico solo recomiende lo que se puede hacer ya.
- **CA-5** Todo id de `dependsOn` existe en el catálogo, ningún play depende de sí mismo, no hay ciclos y la fase de cada dependencia es igual o anterior a la del play que depende de ella · cubre G-1 (preparación) · prueba: `src/lib/plays/catalog.test.ts`
- **CA-6** `recommendablePlays` nunca devuelve como recomendado un play `bloqueado` o `planificado`, ni uno que dependa (directa o indirectamente) de uno que no se pueda recomendar; los excluidos vuelven aparte con su motivo en palabras (el de su bloqueo o «depende de <título>, que no está disponible») · cubre G-3 · `recommendablePlays(catalog)` recibe el catálogo como parámetro para probar cadenas indirectas, ciclos e ids inexistentes con un catálogo de prueba; un play inválido (dependencia inexistente o en ciclo) se excluye con el motivo «El catálogo tiene un error en este play»; el motivo de bloqueo reutiliza `effectiveState(play, null).reason` (`status.ts:60`), sin duplicar `BLOCKER_TEXT` · prueba: `src/lib/plays/recommend.test.ts`
- **CA-7** `recommendablePlays` ordena por fase (fundación, captura, generación, orquestación) y, dentro de la fase, un play va después de aquello de lo que depende; sin dependencia entre sí, se respeta el orden del catálogo; el resultado es estable ante el mismo catálogo · cubre G-1 (preparación) · prueba: `src/lib/plays/recommend.test.ts`
- **CA-8** Un play que no está activado en la empresa se recomienda igual, y `recommendablePlays` no lee ni escribe `play_states` (recomendar no es activar; la firma no recibe cliente ni estados, y la prueba falla antes porque el módulo no existe) · cubre G-3 · prueba: `src/lib/plays/recommend.test.ts`

## 8. Casos límite y errores
- Un play bloqueado del que dependen otros: los dependientes quedan fuera de la recomendación y vuelven con el motivo (CA-6).
- Un catálogo con un id inexistente en `dependsOn` o un ciclo: la prueba de catálogo falla y el build no pasa (CA-5); en ejecución, `recommendablePlays` excluye ese play con su motivo sin romper la pantalla (CA-6).
- Empresa sin filas en `play_states`: la recomendación no depende de `play_states`; todos los plays aparecen con su valor por defecto.
- Multitenant: el catálogo es código común; no se lee ni escribe ningún dato de otra empresa.

## 9. Experiencia y copy
- Fases (textos propuestos): «Fundación», «Captura», «Generación», «Orquestación».
- Niveles (único juego de textos, el mismo en pantalla y en el agente): `nokko_con_ayuda` → «NOKKO prepara, tú decides»; `nokko_borrador` → «NOKKO redacta, tú apruebas».
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
| U-2 | `recommendablePlays` (`src/lib/plays/recommend.ts`), con excluidos y motivo | CA-6, CA-7, CA-8 | `src/lib/plays/recommend.test.ts` |
| U-3 | Palabras y filtro por fase en `view.ts`, `describePlay` (`status.ts:83-97`) y `plays-panel.tsx:75` | CA-3 | `src/lib/plays/view.test.ts` |
| U-4 | Campos de salida nuevos en `list_plays` y `get_play` vía `describePlay` (sin filtro de entrada por fase; título en `TITLES` si cambia; refrescar `.lovable/mcp/manifest.json`) | CA-4 | `src/lib/agent/tools/plays.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Reutiliza la estructura `seed()` de `catalog.ts`; añade los tres campos en `Seed` sin tocar `defaultEnabled`, `gates` ni `outputs`.
- `recommendablePlays` es una función pura sobre el catálogo, sin I/O, igual que `status.ts` y `view.ts`.
- Nombres de código en inglés (`phase`, `approval`, `dependsOn`); valores en español sin tildes como en `motion` y `channels`.
- Se entrega antes del SDD 2 de plays (§15.3).

**Valores propuestos para los 28 plays** (propuesta de redacción, no decisión; Fede los revisa en la aprobación. Fase y nivel salen del propósito de cada play según `catalog.ts` y el PRD de plays, no de SkillTree):
| Play | Fase | Nivel | Depende de |
|---|---|---|---|
| `meeting-prep-and-follow-up` | generacion | nokko_borrador | — |
| `meeting-form-orchestration` | captura | nokko_borrador | — |
| `closed-lost-revival` | generacion | nokko_con_ayuda | — |
| `signals-in-crm-with-decay` | captura | nokko_borrador | — |
| `signal-activation` | orquestacion | nokko_borrador | `signals-in-crm-with-decay` |
| `call-transcript-signal-extraction` | captura | nokko_borrador | — |
| `pain-qualified-segments` | captura | nokko_con_ayuda | `call-transcript-signal-extraction` |
| `hubspot-account-tiering-scoring` | fundacion | nokko_con_ayuda | — |
| `crm-hygiene` | captura | nokko_con_ayuda | — |
| `plg-to-sales` | captura | nokko_borrador | — |
| `product-sign-up-outreach` | generacion | nokko_borrador | — |
| `multi-thread-inbound-leads` | generacion | nokko_con_ayuda | — |
| `website-visitor-de-anonymization` | captura | nokko_borrador | — |
| `review-site-intent-scoring` | captura | nokko_borrador | — |
| `new-hire-tracking` | captura | nokko_borrador | — |
| `hiring-signal-monitoring` | captura | nokko_borrador | — |
| `funding-signal-scraping` | captura | nokko_borrador | — |
| `tech-stack-signal-detection` | fundacion | nokko_borrador | — |
| `brand-mentions-monitoring` | captura | nokko_borrador | — |
| `competitor-post-engagers` | captura | nokko_borrador | — |
| `target-account-exec-posts` | captura | nokko_borrador | — |
| `founder-connections-mining` | fundacion | nokko_con_ayuda | — |
| `webinar-attendee-capture` | captura | nokko_borrador | — |
| `automated-reply-enrichment` | captura | nokko_borrador | — |
| `abm-ads` | fundacion | nokko_con_ayuda | — |
| `public-records-signals` | captura | nokko_borrador | — |
| `public-filings-qualification` | captura | nokko_borrador | — |
| `local-business-tam` | fundacion | nokko_borrador | — |

Solo se ponen dependencias **entre plays** respaldadas por el PRD de plays: `pain-qualified-segments` → `call-transcript-signal-extraction` (`PRD-20261106-plays-gtm.md:37`, «Depende de») y `signal-activation` → `signals-in-crm-with-decay` (su «Falta» es «unificar fuentes bajo el modelo con caída»). El orden entre SDD del PRD de plays (§8: 7, 8 y 9 dependen del 2) es orden de construcción y no se traduce en dependencias entre plays (objeción de la primera pasada del gate). `closed-lost-revival` «usa» las señales para su puerta «algo cambió», pero funciona sin ellas: no es dependencia dura. La decisión 19 del PRD decía «del campo `needs`»; como `needs` es texto libre, se resuelve con `dependsOn` (aceptado por delegación de Fede, 2026-11-10).

## 14. Riesgos y dependencias
- **Conflicto de ramas** con el SDD 2 de plays y con NK-0081 a NK-0083 en `catalog.ts`: coordinar o integrar en orden (§3).
- **Clasificación opinable:** fase y nivel de algunos plays son juicio; por eso los valores son propuesta y la prueba solo exige que existan y sean coherentes.
- **Palabra «agente» ya usada** para el asistente: aquí no se usa para los plays.
- **NK-0077/NK-0078:** el catálogo manda sobre las reglas proactivas; añadir campos no cambia `defaultEnabled`.

## 15. Preguntas para Fede y para la revisión técnica
Resueltas por delegación de Fede («ejecuta todo vos», 2026-11-10):
1. Textos de fase y nivel: los del §9.
2. Tabla del §13: aprobada como está; se ajusta en revisión si hace falta.
3. Integración: se entrega antes del SDD 2 de plays, que se rebasa sobre este cambio.
4. Play inválido en ejecución: se excluye sin romper la pantalla; el build falla por CA-5.

## 16. Pendiente de verificar
- Que no haya otro uso de `Play` (importaciones de `catalog.ts`) que rompa al añadir campos obligatorios: lo comprueba el compilador y el gate.
- Que los nombres `TITLES` y `.lovable/mcp/manifest.json` no cambien con los campos nuevos (U-4).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
### Primera pasada (2026-11-10, informe del gate copiado sin editar)
**Veredicto: Objeciones.** Ninguna bloquea el diseño, pero hay que corregir el SDD antes de darle el GO. Revisé solo documentos y código, sin ejecutar nada. No usé `gate.mjs` ni `flake.mjs` porque todavía no hay código que probar.

**CA sin prueba posible o sin G-n**
- **CA-4:** apunta a `src/lib/agent-tools.test.ts`, pero ese archivo no menciona `list_plays` ni `get_play`. Las herramientas de plays se prueban en `src/lib/agent/tools/plays.test.ts`, y CA-4 y U-4 deberían apuntar a ese archivo.
- **CA-8:** el SDD se contradice. §7 dice que se prueba en `status.test.ts` y la tabla U-2 del §12 dice `recommend.test.ts`.
  - En `status.test.ts` solo es comprobable una parte («activar sigue exigiendo Owner o Sales Leader» y que `blocking()` no cambia), y eso ya lo cubren tests que hoy pasan (`status.test.ts:11-27` y `:50-97`). Esa parte no falla antes, así que no cuenta (GROUND-RULES regla 5). Además, `blocking()` no se exporta (`status.ts:45`).
  - La parte nueva («un play que no está activado se recomienda igual») solo puede fallar antes en `recommend.test.ts`.
  - Está marcado como «cubre G-2», pero G-2 es «ningún envío automático» y CA-8 trata de recomendar y activar. Encaja con G-3.
- **CA-2:** «Ningún valor implica enviar» no se puede comprobar con un test. La parte de las salidas ya la cubre `catalog.test.ts:118-130`, que pasa hoy. Solo la existencia y los valores de `approval` fallarían antes.
- **CA-3:** `view.test.ts` puede probar las palabras y `filterPlays`. Que `plays-panel.tsx` las muestre no lo prueba ningún test.
- **§8 («se muestran con el motivo del primero»):** no tiene CA ni prueba.

**[Por verificar] que sigue sin comprobarse**
- §8 y §15.4, ignorar o lanzar error ante un play inválido: lo decide Fede. Mi recomendación técnica es excluir el play sin romper la pantalla, que es la opción segura para G-3, y que CA-5 siga fallando en el build.
- Dependencias de los plays externos (§13), incluidas `public-filings-qualification` y `local-business-tam`: siguen abiertas (detalle en el punto 4 del siguiente bloque).
- §16, si `TITLES` y `manifest.json` cambian: no se puede comprobar hasta implementar.
- Lo que sí comprobé de §16: nadie construye `Play` a mano. Lo importan `plays-panel.tsx`, `agent/tools/plays.ts`, `org-data.ts`, `headlines.ts` y los tests, siempre a través de `CATALOG`. Añadir campos obligatorios en `Seed` no rompe ningún literal.

**Contradicciones con el código o con decisiones previas**
1. **Referencias del §3:** casi todas son ciertas, con dos desfases de pocas líneas:
   - El tipo `Play` empieza en `catalog.ts:43`, no en `:48` (la `:48` es `status`).
   - `blocking()` está en `status.ts:45`, no en `:46`.
   - Son ciertas `catalog.ts:79`, `status.ts:38-42`, `catalog.test.ts:13`, `:105` y `:118-127` (el bloque llega a `:130`).
   - El recuento 11 `parcial` + 1 `planificado` + 16 `bloqueado` y los cuatro `blockedBy` coinciden.
   - Los commits `aa368b6` y `d3eeba1` existen y no hay diferencias en `src/` entre ellos ni hasta HEAD.
   - Leí la rama `chore/ledger-sprint5-intake-20261110`, no `main`.
2. **Ids del §13:** los 28 coinciden con `catalog.ts`, en el mismo orden.
3. **Archivos de test:** existen `catalog.test.ts`, `view.test.ts`, `status.test.ts` y `agent-tools.test.ts`. `recommend.test.ts` y `recommend.ts` son nuevos. Los problemas de CA-4 y CA-8 están en el bloque anterior.
4. **Dependencias frente a `docs/prd/PRD-20261106-plays-gtm.md`:**
   - `closed-lost-revival` → `signals-in-crm-with-decay` está respaldada, pero de forma débil. El PRD de plays dice «1; usa 2 para "algo cambió"» (`:108`), y el SDD lo convierte en dependencia dura.
   - `pain-qualified-segments` → `call-transcript-signal-extraction` sí está respaldada (`:37`).
   - Las dependencias del PRD de plays son entre SDD (orden de construcción), no entre plays. Traducir «SDD 2» a «el play `signals-in-crm-with-decay`» es una inferencia: el SDD 2 también construye `signal-activation`.
   - Se aplica de forma incoherente:
     - SDD 8 (`:113`) depende de 2, pero el SDD solo pone la dependencia en 8 de sus 13 plays. Quedan sin ella `website-visitor-de-anonymization`, `tech-stack-signal-detection`, `founder-connections-mining`, `webinar-attendee-capture`, `automated-reply-enrichment` y `abm-ads`.
     - SDD 9 (`:114`) depende de 2, pero solo `public-records-signals` la lleva.
     - SDD 7 (`:112`, «1, 2») tampoco la recoge en `plg-to-sales`, `product-sign-up-outreach` ni `multi-thread-inbound-leads`, y el §13 no lo menciona.
5. **Inversión de fase:** `pain-qualified-segments` está en `fundacion` y depende de `call-transcript-signal-extraction`, que está en `captura`. Con el orden de CA-7 (primero fase), el play dependiente quedaría antes que aquello de lo que depende. Hoy no se recomienda porque está `planificado`, pero lo estará cuando se construya. CA-5 debería exigir que la fase de la dependencia sea igual o anterior, o hay que cambiar la fase. Además, «coherentes» (§14) no está definido en ningún CA.
6. **Textos de nivel:** CA-2 dice «Lo prepara una persona; NOKKO te avisa», y el §9 dice «Lo prepara una persona», «NOKKO prepara, tú decides» y «NOKKO redacta, tú apruebas». CA-4 exige «las mismas palabras que la pantalla», así que hay que fijar un único juego de textos.
7. **Objetivos frente al PRD nuevo:**
   - El PRD (`PRD-20261110…:119`) dice que el SDD 1 cubre G-2 y G-3, y el SDD dice G-1, G-2 y G-3.
   - El SDD redefine la medida de G-1 («28 de 28 plays con campos»), cuando en el PRD (`:37`) es «diagnósticos terminados con equipo».
   - G-3 en el PRD (`:39`) solo habla de «bloqueado». El SDD lo amplía a planificado y dependientes; es más estricto y razonable, pero hay que decirlo.
8. **Decisión 19 del PRD** (dependencias «del campo `needs`»): el SDD la resuelve con un campo nuevo, y es correcto porque `needs` es texto libre. Pero se aparta de la decisión literal y Fede debería aceptarlo de forma explícita.
9. **Nivel sin usar:** ningún play recibe `persona_prepara`, así que ese valor no tiene uso.

**Lo que esta revisión NO demuestra**
- No ejecuté vitest, tsc, `gate.mjs` ni `flake.mjs`: no hay implementación. No hay segunda máquina ni soak.
- No valida que la fase y el nivel de cada play sean correctos de negocio: es juicio, y lo revisa Fede.
- No comprueba que el texto del análisis de SkillTree (documento del proyecto) se haya respetado.
- No comprueba conflictos reales con NK-0081 a NK-0083 ni con el SDD 2 de plays, porque no están en este árbol.
- No modifiqué ningún archivo.

### Cambios tras la primera pasada (autor)
CA-4 y U-4 a `plays.test.ts`; CA-8 a `recommend.test.ts` con G-3 y solo la parte nueva; CA-2 limitado a los valores de `approval` (se quita `persona_prepara`); CA-3 con la pantalla en el recorrido; CA-6 devuelve excluidos con motivo; CA-5 exige fase de dependencia igual o anterior; `pain-qualified-segments` pasa a `captura`; solo dependencias entre plays respaldadas (se quitan las derivadas del orden de SDD y la de `closed-lost-revival`; se añade la justificación de `signal-activation`); un único juego de textos; objetivos alineados con el PRD; decisión 19 aceptada por delegación; líneas del §3 corregidas.

### Segunda pasada (2026-11-10, informe del gate copiado sin editar)
**Veredicto: Objeciones.** Son menores y ninguna bloquea el diseño, pero hay que corregir el texto antes del GO. Revisé documentos y código en solo lectura en la rama `chore/ledger-sprint5-intake-20261110`. Entre `d3eeba1` y HEAD no hay ningún cambio en `src/`.

**Objeciones de la primera pasada que siguen sin resolver**
- **§8, play inválido en ejecución.** Se quitó el texto «motivo del primero», pero en su lugar entra otra conducta: «`recommendablePlays` excluye el play inválido sin romper la pantalla» (SDD:70). Esa conducta no tiene CA ni prueba. Además, no dice qué motivo se devuelve.
- **§3, rama leída (SDD:17).** Sigue diciendo «Leído en `main` @ `aa368b62`», pero `aa368b6` no está en `main`: solo está en la rama `chore/...`. La parte de `d3eeba1` sí es cierta, porque está en `main`.
- **Decisión 19 y tabla del §13 «aceptadas por delegación de Fede».** No puedo comprobar esa delegación. La primera pasada pedía una aceptación explícita de Fede. En esa pasada el Estado era «Borrador», así que el GO decide. Fede dio el GO del 2026-11-10 (promoción de NK-0127 en el ledger), que cubre este SDD; la delegación sigue sin poder comprobarse.

**Problemas nuevos**
1. **CA-6 no se puede probar del todo con el catálogo real.** Pide excluir dependencias «indirectas», pero el catálogo real no tiene ninguna cadena de dos saltos: solo `signal-activation` → `signals-in-crm-with-decay` (que sí se puede recomendar) y `pain-qualified-segments` → `call-transcript-signal-extraction`. Hay que exigir que `recommendablePlays` reciba el catálogo como parámetro, para probarlo con un catálogo de prueba. Lo mismo hace falta para ciclos e ids inexistentes en ejecución.
2. **Motivo de bloqueo.** CA-6 reutiliza el texto de bloqueo, pero `blocking()` y `BLOCKER_TEXT` no se exportan (`status.ts:16,45`). El §13 debería decir que se reutiliza `effectiveState(play, null).reason` o que se exporta `blocking`, para no duplicar lógica (regla de `src/lib/AGENTS.md`).
3. **Archivos que faltan en U-3 y U-4.** No citan `status.ts` (`describePlay`, líneas 83-97), que es lo que alimenta `list_plays`, `get_play` y `plays-panel.tsx:75`. Tampoco dicen si `list_plays` gana un filtro `phase`. Si lo gana, cambian el esquema de entrada y `manifest.json` (`plays.test.ts:245`). Hoy §5 y §6 lo dejan ambiguo.
4. **CA-7, orden dentro de una misma fase.** No fija el desempate entre plays sin dependencia entre sí. «Estable» se cumple, pero el orden no está especificado. Propongo el orden del catálogo.
5. **Referencias que no cuadran.** §3 cita `catalog.test.ts:118-127` y §4 cita `:118-130`, pero el bloque real va de 118 a 133. Además, el §13 dice «Si se prefiere un solo SDD con el SDD 2… se absorbe allí», y eso contradice lo ya decidido en §15.3.

**CA sin prueba posible o sin G-n**
- **CA-2 (G-2).** Solo prueba que existen los valores de `approval`. La parte de G-2 (salidas permitidas) la cubre `catalog.test.ts:118-133`, que ya pasa hoy y por tanto no cuenta (regla 5 de GROUND-RULES). En la práctica, G-2 no tiene ninguna prueba nueva que falle antes.
- **CA-8.** «No lee ni escribe `play_states`» se cumple por la firma de la función, no por una aserción. La prueba falla antes solo porque el módulo todavía no existe.
- **CA-3, parte de pantalla.** Se comprueba en el recorrido manual, no con una prueba automática. Está declarado.

**[Por verificar] abiertos:** si cambian `TITLES` y el manifiesto (§16), la delegación de Fede (§15) y los conflictos reales con NK-0081 a NK-0083 y con el SDD 2 de plays.

**Lo que esta revisión NO demuestra:** no ejecuté `gate.mjs`, `flake.mjs`, vitest ni tsc, porque todavía no hay implementación (`recommend.ts` no existe). No hubo segunda máquina ni soak. No valido que la fase y el nivel de cada play sean correctos de negocio. No leí el análisis de SkillTree. No modifiqué ningún archivo.

### Cambios tras la segunda pasada (autor)
§3 dice la rama leída; CA-6 exige `recommendablePlays(catalog)` con catálogo de prueba, motivo para plays inválidos y reutiliza `effectiveState(play, null).reason`; U-3 y U-4 citan `describePlay` y `list_plays` no gana filtro de entrada; CA-7 desempata por orden del catálogo; referencias a `catalog.test.ts:118-133`; se quita la nota de absorber en el SDD 2; G-2 declarado como cubierto por la guarda existente, sin prueba nueva; CA-8 declara que falla antes por ausencia del módulo. No se ha hecho una tercera pasada.

### Delegación
Fede, en el chat del 2026-11-10: «si ejecuta todo vos». Es la base de las decisiones del §15 y de la aprobación de este SDD.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
