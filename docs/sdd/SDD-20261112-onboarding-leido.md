# SDD-20261112-onboarding-leido · [Mejora] «Nokko lee»: qué significa «Leído» y qué salió de cada fuente

**Tipo:** Mejora (solo interfaz, sin migración, sin IA) · **Prioridad propuesta:** Media (pregunta directa de Fede durante el onboarding; cambio pequeño y reversible)
**Estado:** Borrador · **Pide:** Fede (2026-11-12) · **Aprueba:** Fede · **Fecha:** 2026-11-12
**Ticket:** NK-0156 (parte 1 de 2; la parte 2 es NK-0157 y NO entra aquí)
**PRD:** No aplica (mejora acotada) · **Depende de:** `SDD-20261025-field-actions-edit-delete-confirm.md` (U-4: descartar hallazgos y quitar fuentes, ya en `main`)

> Nivel elegido: SDD corto. Es una mejora acotada de una pantalla, sin esquema ni IA; un PRD no añadiría nada. Un PRD solo haría falta para NK-0157 (bloque de estrategia por hallazgo), porque ahí la lectura tendría que devolver datos nuevos.
> Números de línea comprobados en `main` @ `ec5a8131a9e59e7d3faf1b8e7fb4938b7864a49d` (worktree `seller-strategy-studio-s8docs2`, sin cambios en `src/`), el 2026-11-12. El ledger citaba líneas erróneas: las buenas son 113 y 194.

## 1. Resumen
En «Nokko lee» (`/onboarding`, paso de lectura) la cabecera dice «Leído» y cada fuente dice «leído», pero ninguna de las dos cosas cuenta qué se ha visto. Esta mejora cambia la cabecera por una frase que dice qué ha pasado, y en cada fuente muestra cuántos hallazgos salieron de ella, con un desplegable que lista esos hallazgos. Todo sale de datos que la pantalla ya carga; no se toca el servidor, el esquema ni la IA.

## 2. Problema y para quién
Fede (2026-11-12), al hacer el onboarding: «no entiendo lo que me dice o lo que representa lo "Leído"; quizás tendría que mostrar una explicación que vio en cada fuente y/o dónde podría aportar valor en la estrategia». Pidió dos tickets. Este cubre «qué vio en cada fuente». «Dónde aporta valor en la estrategia» es NK-0157.

## 3. Evidencia y por qué ahora
Leído en `main` @ `ec5a813`:
1. **Cabecera.** `src/components/onboarding/reading.tsx:112-114`: `done ? "Leído" : failed ? "Sin terminar" : \`Leyendo · ${job?.step ?? "en cola"}\``. «Leído» (`:113`) es un estado del trabajo en segundo plano (`background_jobs.status = "done"`, `:59`), no una afirmación sobre las fuentes.
2. **Estado por fuente.** `reading.tsx:190-195`: `done ? "leído" : failed ? "sin acceso" : "leyendo"` (`:194`). Es el mismo estado del trabajo pintado en cada fuente: todas dicen lo mismo a la vez. Además «sin acceso» (`:194`) afirma una causa que no se conoce: el trabajo puede fallar o cancelarse por el límite mensual de gasto (`src/lib/onboarding.server.ts:25`), por la IA o por la web (hallazgo «Sin acceso a la web», `:42`), y `failed` agrupa `failed` y `cancelled` (`:60`).
3. **Paso del trabajo en la cabecera.** `job.step` lo escribe el servidor en español: «Leyendo tu web», «Mercado y competidores», «Proponiendo tu estrategia», «Debate de los C-Levels» (`onboarding.server.ts:40,51,65,~74`). La cabecera actual da «Leyendo · Leyendo tu web» (repite la palabra). `step` es `null` hasta que el trabajo arranca («en cola», `:113`).
4. **El hallazgo ya guarda su fuente.** `src/lib/onboarding.ts:20-29` `Finding` (`source: string | null`, `discardedAt?`, `sourceRemoved?`). El servidor los escribe en `onboarding.server.ts:30-31` (`note`) con estas fuentes: `Web · {host}` (`:43`), nombre de archivo(s) o «Texto pegado» (`:46-47`), nombre de archivo (`:48`), URL de mercado (`:61`), «Debate C-Levels» (`:73`) y, para la propuesta, el texto libre que la IA puso en `basis.source` o, si falta, «Supuesto de Nokko» / «Tus fuentes» (`src/lib/onboarding.ts:64-74`, instrucción a la IA en `src/lib/setup-extract.server.ts:47`: «por ejemplo "Web · precios", "Business plan", "Texto pegado" o null»).
5. **Regla de coincidencia ya existente.** `src/lib/onboarding-sources.ts:44-48` `findingsDependingOn(source, findings)`: `sourceCore(source)` (`:39-41`, quita «Web ·», « (Drive)», `https://`, minúsculas, sin tildes) y un hallazgo cuenta si `f.source && !f.discardedAt && norm(f.source).includes(core)`. Un `core` vacío no coincide con nada (`:46`). La usa el diálogo de «Quitar» (`reading.tsx:72-82`): «N hallazgos vienen de esta fuente». Contar con otra regla haría que el número de la fuente y el del diálogo discreparan.
6. **Fuentes que ve el paso.** `sources: string[]` con etiquetas como `Web · https://…`, `plan.pdf`, `plan.pdf (Drive)`, `Texto pegado` (`src/components/onboarding/sources.tsx:75-78,138`).
7. **Tests actuales.** `src/components/onboarding/reading.test.tsx:52-68` (3 pruebas de «Hacer solo el diagnóstico»; mock de `supabase`, `useMe` y `confirm-dialog`; ningún texto de cabecera ni de estado por fuente está afirmado: `grep` de «Leído|leído|sin acceso» en `src/` solo da `reading.tsx:113,194` en esta pantalla). `src/lib/onboarding-sources.test.ts:38-44` prueba `findingsDependingOn` con una fuente genérica («Tus fuentes») que no depende de nadie.
8. **Cobertura de la regla (límites, comprobados leyendo el código).** (a) La coincidencia es por subcadena: un `core` corto (por ejemplo `a.md`) también coincide con `data.md`. (b) Un hallazgo cuya fuente es texto libre de la IA («Web · a.com y plan.pdf») cuenta para las dos fuentes, así que la suma de los contadores puede superar el número de hallazgos. (c) Un hallazgo de error («Sin acceso a la web: …», fuente = host) coincide con la fuente web y se cuenta como suyo. (d) «Empiezo a leer tus fuentes» tiene `source: null` y no cuenta para ninguna.

**Uso real:** sin dato (no hay eventos de uso del onboarding en el repo; la única señal es la pregunta de Fede).

**Por qué ahora:** Fede lo ha pedido en el sprint 8 y es lo primero que ve una persona nueva tras subir sus fuentes.

## 4. Resultado buscado
Cualitativo, sin línea base medida («sin dato»):
- Quien llega al final de la lectura puede decir, de cada fuente, cuántos hallazgos salieron de ella y cuáles son, sin abrir nada más.
- La cabecera y el estado de cada fuente no afirman nada que no se sepa.
Comprobación: el §walkthrough de §9 y las pruebas de §7. No se mide conversión ni tiempo (sin dato; no se inventa objetivo).

## 5. Alcance
**Incluye:**
- Nueva frase de cabecera para los tres estados (y «cancelada» aparte), y estado de cada fuente.
- Contador de hallazgos por fuente y desplegable con su lista, solo cuando la lectura ha terminado.
- Función pura `summarizeSources` en `src/lib/onboarding-sources.ts` con la misma regla que `findingsDependingOn`.

**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- NK-0157: cualquier texto sobre dónde aporta valor un hallazgo a la estrategia (bloque, nivel, «por qué importa»). Requiere que la lectura devuelva ese dato; hoy no lo devuelve.
- Cambios en `onboarding.server.ts`, `setup-extract.server.ts`, `onboarding.ts` (tipo `Finding`), esquema, RLS, migraciones, llamadas a IA, funciones del servidor.
- Cambiar la regla de coincidencia de `findingsDependingOn` o su uso en `dropSource` (se reutiliza tal cual; si un caso límite de §3.8 se quiere corregir, es otro ticket y cambia a la vez el diálogo).
- Acciones (confirmar, editar, descartar) dentro del desplegable: siguen en la lista de la izquierda.
- Un total global de hallazgos ni «de N fuentes leídas» (la suma por fuente puede solaparse, §3.8b).
- Resumen de lo que vio dentro de cada archivo o web (no existe el dato; no se pide a la IA).
- Tocar `sources.tsx` (paso anterior), `onboarding.tsx` ni el resto de pasos.

## 6. Cambios de comportamiento (delta)
**Añadido:** contador por fuente («2 hallazgos») y desplegable con los hallazgos de esa fuente; frase de ayuda bajo la cabecera cuando termina.
**Modificado:**
| Dónde | Antes | Después |
|---|---|---|
| Cabecera, `done` (`reading.tsx:113`) | «Leído» | «Terminé de leer tus fuentes» |
| Cabecera, `failed` con estado `failed` | «Sin terminar» | «No pude terminar de leer tus fuentes» |
| Cabecera, `cancelled` | «Sin terminar» | «Se canceló la lectura» |
| Cabecera, en curso (`:113`) | «Leyendo · {paso}» / «Leyendo · en cola» | «Estoy leyendo tus fuentes · {paso}» / «Estoy leyendo tus fuentes · esperando turno» |
| Fuente, `done` (`:194`) | «leído» | «N hallazgos» · «1 hallazgo» · «Sin hallazgos propios» |
| Fuente, `failed` o `cancelled` (`:194`) | «sin acceso» | «Sin terminar» |
| Fuente, en curso | «leyendo» | «leyendo» (igual) |
**Eliminado:** las palabras «Leído», «leído» y «sin acceso» de esta pantalla.

## 7. Historias y criterios de aceptación
### H-1: Como Owner en el onboarding, quiero que la pantalla me diga con palabras qué ha pasado con mis fuentes, para no tener que adivinar qué es «Leído».
- **CA-1** Con el trabajo `done`, la cabecera dice «Terminé de leer tus fuentes» y no aparece la palabra «Leído» (cualquier mayúscula) en la pantalla. · prueba: `src/components/onboarding/reading.test.tsx` («the header says what happened when done»)
- **CA-2** Con el trabajo `failed` la cabecera dice «No pude terminar de leer tus fuentes»; con `cancelled`, «Se canceló la lectura»; la fuente muestra «Sin terminar» y no «sin acceso». · prueba: `reading.test.tsx` («failed and cancelled headers; no claim of access»)
- **CA-3** En curso la cabecera dice «Estoy leyendo tus fuentes · {paso}»; con `step` nulo, «… · esperando turno». · prueba: `reading.test.tsx` («running header with and without step»)
- **CA-4** Con la lectura terminada aparece, bajo la cabecera, una frase que dice qué es cada línea y qué puede hacer la persona: «Cada línea es algo que encontré, con su fuente al final. Confírmalo, edítalo o descártalo.» Sin afirmar nada sobre la estrategia. · prueba: `reading.test.tsx` («help sentence, no strategy claim»)

### H-2: Como Owner, quiero ver cuántos hallazgos salieron de cada fuente y cuáles son, para saber qué vio Nokko en cada una.
- **CA-5** `summarizeSources(sources, findings)` devuelve, por fuente y en el orden de `sources`, `{ source, indexes, count }` con `indexes` igual a `findingsDependingOn(source, findings)` (misma regla; descartados excluidos; hallazgos con `source: null` no cuentan; fuente con `core` vacío → `count: 0`). · prueba: `src/lib/onboarding-sources.test.ts` («summarizeSources agrees with findingsDependingOn»)
- **CA-6** Casos de la regla: «Web · https://acme.test» cuenta el hallazgo con fuente «Web · acme.test»; «plan.pdf (Drive)» cuenta el de fuente «Plan.pdf»; un hallazgo descartado no cuenta; uno con fuente «Tus fuentes» o «Supuesto de Nokko» no cuenta para ninguna fuente concreta; un hallazgo con fuente que menciona dos fuentes cuenta en ambas. · prueba: `onboarding-sources.test.ts` («summarizeSources cases»)
- **CA-7** Con la lectura terminada cada fuente muestra «N hallazgos» (N ≥ 2), «1 hallazgo» (N = 1) o «Sin hallazgos propios» (N = 0), nunca «0 hallazgos». · prueba: `reading.test.tsx` («per-source count wording»)
- **CA-8** El número de una fuente es el mismo que el del diálogo de «Quitar»: con 2 hallazgos vivos de una fuente, la fila dice «2 hallazgos» y al pulsar «Quitar» el diálogo (`askUnsaved`) recibe un cuerpo que empieza por «2 hallazgos vienen». Tras descartar uno desde la lista, la fila pasa a «1 hallazgo». · prueba: `reading.test.tsx` («count matches the remove dialog and follows discards»)
- **CA-9** Una fuente con N ≥ 1 se puede expandir y colapsar con un botón con `aria-expanded` (cerrado por defecto) y nombre accesible «Ver hallazgos de {fuente}»; abierta lista el texto de cada hallazgo vivo de esa fuente, y solo esos. Una fuente con «Sin hallazgos propios» no tiene botón. · prueba: `reading.test.tsx` («expanding a source lists only its live findings»)
- **CA-10** Abierto, el desplegable refleja la lista viva: si el hallazgo se edita, el texto nuevo aparece; si se descarta, desaparece (sin recargar). · prueba: `reading.test.tsx` («expanded list follows the live findings», con `rerender`)
- **CA-11** Con la lectura en curso o fallida no hay contador ni desplegable (la lista sigue escribiéndose o es parcial). · prueba: `reading.test.tsx` («no counts while running or failed»)

## 8. Casos límite y errores
- Fuente sin hallazgos atribuibles (p. ej. todo quedó bajo «Tus fuentes»): «Sin hallazgos propios», sin botón (CA-7, CA-9). El texto de apoyo (§9) no afirma que Nokko no la leyó.
- Todos los hallazgos descartados: contadores a «Sin hallazgos propios»; la lista conserva «Has descartado todos los hallazgos.» (`reading.tsx:152`, sin cambios).
- Mismo hallazgo en dos fuentes (§3.8b): aparece en ambos desplegables; no hay total.
- Sin fuentes (`sources` vacío): la columna de fuentes no pinta filas, como hoy.
- Tras «Quitar» una fuente: desaparece su fila; sus hallazgos conservados quedan con «fuente quitada» (comportamiento actual, sin cambios).
- Otra empresa (multitenant): no aplica, todo sale de `findings` y `sources` que el paso ya recibe por props; no hay consulta nueva.
- Texto largo de una fuente en 375 px: la etiqueta se parte en líneas (`flex-wrap` ya presente) y no hay desplazamiento horizontal.

## 9. Experiencia y copy
Reglas: «tú», sin iconos, estados con palabra, sin cifras inventadas.

| Elemento | Copy exacto |
|---|---|
| Cabecera, terminado | Terminé de leer tus fuentes |
| Cabecera, fallido | No pude terminar de leer tus fuentes |
| Cabecera, cancelado | Se canceló la lectura |
| Cabecera, en curso | Estoy leyendo tus fuentes · {paso} (sin paso: Estoy leyendo tus fuentes · esperando turno) |
| Ayuda bajo la cabecera, terminado | Cada línea es algo que encontré, con su fuente al final. Confírmalo, edítalo o descártalo. |
| Fuente, terminado | 2 hallazgos · 1 hallazgo · Sin hallazgos propios |
| Texto de apoyo de «Sin hallazgos propios» (atributo `title` y texto pequeño bajo la fila al pasar/seleccionar) | No atribuí ningún hallazgo a esta fuente por separado. |
| Botón del desplegable | nombre accesible «Ver hallazgos de {fuente}»; el texto visible es el contador |
| Fuente, fallido o cancelado | Sin terminar |
| Fuente, en curso | leyendo |
Mensaje de error del trabajo (`job.error`) y «La lectura se canceló.» (`reading.tsx:184`): sin cambios; ya cuentan qué pasó.

**§walkthrough** (lo ejecuta `nokko-walkthrough` tras el gate; capturas como evidencia, consola y red sin errores nuevos):
1. 375 px y 1280 px, tema claro y oscuro (`.dark` en `<html>`), con el trabajo en curso, terminado con hallazgos repartidos entre una web, un PDF y un texto pegado, terminado con una fuente sin hallazgos propios, fallido y cancelado.
2. Terminado: la cabecera dice «Terminé de leer tus fuentes»; cada fuente da su contador; abrir y cerrar una fuente con teclado (Tab, Enter/Espacio) y ver el foco visible; el lector de pantalla anuncia «expandido/contraído».
3. Descartar un hallazgo con el desplegable abierto: el contador y la lista cambian a la vez.
4. Pulsar «Quitar» en una fuente: el número del diálogo coincide con el de la fila.
5. 375 px: sin desplazamiento horizontal; la etiqueta larga de una web se parte en líneas; el botón del desplegable tiene área táctil usable [Por verificar el mínimo en tokens del sistema de diseño, `src/styles.css`].
6. Solo tokens y utilidades del sistema (`text-ink-mid`, `text-ink-faint`, `border-hairline`, `text-destructive`): ningún color fijo; contraste suficiente en claro y oscuro [Por verificar en capturas].

## 10. Datos, permisos y privacidad
Sin tablas ni columnas nuevas, sin RLS ni GRANTs, sin consulta nueva. Los permisos no cambian: las acciones de «Quitar» siguen en `FieldActions` por rol. Los textos de los hallazgos ya se muestran en esta pantalla; el desplegable no expone nada más. Los datos de las pruebas son ficticios («ejemplo.test», «plan.pdf», «Texto pegado»).

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| ninguna | regla determinista (`summarizeSources`) | — | sin coste |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `summarizeSources` pura en `src/lib/onboarding-sources.ts`, reutilizando `findingsDependingOn` | CA-5, CA-6 | `src/lib/onboarding-sources.test.ts` (se añade; falla porque la función no existe) |
| U-2 | Cabecera, estado de fuente y frase de ayuda con el copy de §9 | CA-1, CA-2, CA-3, CA-4, CA-11 (parte de estado) | `src/components/onboarding/reading.test.tsx` (se añade) |
| U-3 | Contador y desplegable por fuente en `reading.tsx` | CA-7, CA-8, CA-9, CA-10, CA-11 | `reading.test.tsx` (se añade) |

Los tests se **añaden**; no se modifica ninguna prueba existente (las tres de NK-0009 y las de `findingsDependingOn` siguen como están). En `reading.test.tsx` se añade un auxiliar nuevo (`showWith(findings, sources, status)`) junto al `show` actual, sin cambiarlo. Cada prueba nueva debe fallar sobre `ec5a813` antes del cambio (CA-1: hoy aparece «Leído»; CA-5: la función no existe; CA-7/8/9: no hay contador).

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `summarizeSources(sources: string[], findings: Finding[]): { source: string; indexes: number[]; count: number }[]` = `sources.map((s) => { const indexes = findingsDependingOn(s, findings); return { source: s, indexes, count: indexes.length }; })`. Una sola regla, sin duplicar `norm`.
- `reading.tsx`: `const summary = useMemo(() => summarizeSources(sources, findings), [...])`; estado local `open: Set<string>` (o un `useState<string | null>` por fuente); el desplegable pinta `findings[i].text` para cada `i` de `indexes`, sin acciones.
- Botón en lugar de `<details>`: con `<details>` el contenido cerrado sigue en el DOM y las pruebas no distinguen abierto de cerrado; el botón con `aria-expanded` es verificable y accesible. Alternativa descartada: reutilizar `<details>` (el patrón de «descartados», `reading.tsx:157`).
- Copy de cabecera como función pura pequeña (`readingHeadline(status, step)`) en el mismo `onboarding-sources.ts` solo si el gate lo prefiere; no es necesario para los CA.
- Convención del repo: sin `as any`; textos de usuario por `errorText()` solo cuando hay error crudo (aquí no lo hay).

## 14. Riesgos y dependencias
- **Contadores que parecen más exactos de lo que son** (§3.8): subcadena y fuente libre de la IA. Mitigación: el desplegable permite comprobarlo; se mantiene la regla única con el diálogo; no hay total. Corregir la regla es un ticket aparte que cambia también el diálogo.
- **«Sin hallazgos propios» mal leído como «no se leyó»**: por eso el texto de apoyo dice «No atribuí ningún hallazgo a esta fuente por separado» y no promete nada más.
- **Frase de cabecera larga en 375 px**: se parte en líneas; revisar en el §walkthrough.
- **Fuente no legible pero lectura `done`**: el trabajo puede terminar con el hallazgo de error «Sin acceso a la web: …» (`onboarding.server.ts:42`). Ese hallazgo se cuenta como de la web y se ve en su desplegable; la cabecera «Terminé de leer tus fuentes» no promete que todas se leyeran con éxito. [Por verificar con Fede si prefiere «Terminé la lectura» para evitarlo; ver §15, P-1.]
- Sin dependencia con otros tickets; NK-0157 puede apoyarse después en `summarizeSources` y en el desplegable.

## 15. Preguntas para Fede y para la revisión técnica
- **P-1 (para Fede, con recomendación):** ¿«Terminé de leer tus fuentes» te sirve, o prefieres «Terminé la lectura»? Recomendación: «Terminé de leer tus fuentes»: es lo que quería entender («qué ha pasado»), y el estado por fuente ya cuenta con cuántos hallazgos salió cada una. Si lo cambias, solo cambia el copy de CA-1.
- **P-2 (para el gate):** ¿el contador por subcadena (§3.8) es aceptable para un número que ahora ve la persona, o conviene un ticket aparte para afinar `findingsDependingOn`? Recomendación: aceptable en esta entrega, con ticket aparte si se observan casos reales de coincidencia indebida.
- **P-3 (para el gate):** confirmar que `FieldActions kind="onboarding_source"` no necesita cambios al añadir el botón en la misma fila.
Nota: no hay preguntas de producto que bloqueen el SDD; P-1 no bloquea.

## 16. Pendiente de verificar
- **[Por verificar]** Contraste y área táctil del botón del desplegable en 375 px, claro y oscuro (capturas del §walkthrough).
- **[Por verificar]** Que el hallazgo de error de la web se vea bien dentro del desplegable de la fuente web (caso real: web inaccesible con lectura `done`); se comprueba en el §walkthrough con una web de prueba que falle.
- **[Por verificar]** Que `NK-0156` y `NK-0157` están registrados en el ledger: `.factory/ledger.json` en `main` @ `ec5a813` llega a NK-0152 y no contiene NK-0156 ni NK-0157. Lo registra `nokko-tracker`/`nokko-intake`, no este SDD. Enlazar con `node scripts/factory/ledger.mjs doc NK-0156 --sdd docs/sdd/SDD-20261112-onboarding-leido.md` cuando exista el ticket.
- Uso real del onboarding: sin dato.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: No revisado (este SDD no tiene PRD; los CA no citan G-n)
- [Por verificar] que sigue sin comprobarse: No revisado
- Contradicciones con el código o con decisiones previas: No revisado
- Lo que esta revisión NO demuestra: No revisado

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.

## Lo que NO se afirma
- No se afirma dónde aporta valor un hallazgo a la estrategia, a qué bloque alimenta ni cuánto confía Nokko en él. Es NK-0157 y requiere que la lectura devuelva ese dato.
- No se afirma que Nokko «vio» o «entendió» una fuente: solo que algún hallazgo lleva esa fuente anotada. «Sin hallazgos propios» no es «no leída».
- No se afirma que los contadores sumen el total de hallazgos ni que cada hallazgo salga de una única fuente (§3.8).
- No se afirma el motivo de un fallo («sin acceso» se retira): el estado dice solo «Sin terminar»; el motivo, si existe, sigue siendo `job.error`.
- No se afirma ninguna mejora medida (sin dato), ni que la persona confirme más hallazgos por verlos agrupados.
- No se verifica nada en producción ni con datos reales; el análisis es sobre el código de `main` @ `ec5a813`.
