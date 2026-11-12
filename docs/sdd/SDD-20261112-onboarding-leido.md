# SDD-20261112-onboarding-leido · [Mejora] «Nokko lee»: qué significa «Leído» y qué salió de cada fuente

**Tipo:** Mejora (solo interfaz, sin migración, sin IA) · **Prioridad propuesta:** Media (pregunta directa de Fede durante el onboarding; cambio pequeño y reversible)
**Estado:** Borrador · **Pide:** Fede (2026-11-12) · **Aprueba:** Fede · **Fecha:** 2026-11-12
**Ticket:** NK-0156 (parte 1 de 2; la parte 2 es NK-0157 y NO entra aquí)
**PRD:** No aplica (mejora acotada) · **Depende de:** `SDD-20261025-field-actions-edit-delete-confirm.md` (U-4: descartar hallazgos y quitar fuentes, ya en `main`) y **de NK-0164** (límite único de 3 documentos por lectura en cliente y servidor; rama `feat/nk-0164-onboarding-files-limit`). NK-0156 se construye sobre `main` **después** de que NK-0164 se integre; no se empieza antes.

> Nivel elegido: SDD corto. Es una mejora acotada de una pantalla, sin esquema ni IA; un PRD no añadiría nada. Un PRD solo haría falta para NK-0157 (bloque de estrategia por hallazgo), porque ahí la lectura tendría que devolver datos nuevos.
> Números de línea comprobados en `main` @ `ec5a8131a9e59e7d3faf1b8e7fb4938b7864a49d` (worktree `seller-strategy-studio-s8docs2`, sin cambios en `src/`), el 2026-11-12. El ledger citaba líneas erróneas: las buenas son 113 y 194.
> Revisión: la pasada 1 del gate (`.factory/evidence/NK-0156/sdd-gate-pass1.md`) dio FAIL (3 MAJOR, 7 MINOR); cada hallazgo se comprobó otra vez contra `main` @ `ec5a813` y se corrige aquí (ver §17 y «Decisiones del coordinador»).

## 1. Resumen
En «Nokko lee» (`/onboarding`, paso de lectura) la cabecera dice «Leído» y cada fuente dice «leído», pero ninguna de las dos cosas cuenta qué se ha visto. Esta mejora cambia la cabecera por una frase que dice qué ha pasado, y en cada fuente muestra cuántos hallazgos salieron de ella, con un desplegable que lista esos hallazgos. Todo sale de datos que la pantalla ya carga; no se toca el servidor, el esquema ni la IA.

## 2. Problema y para quién
Fede (2026-11-12), al hacer el onboarding: «no entiendo lo que me dice o lo que representa lo "Leído"; quizás tendría que mostrar una explicación que vio en cada fuente y/o dónde podría aportar valor en la estrategia». Pidió dos tickets. Este cubre «qué vio en cada fuente». «Dónde aporta valor en la estrategia» es NK-0157.

## 3. Evidencia y por qué ahora
Leído en `main` @ `ec5a813`:
1. **Cabecera.** `src/components/onboarding/reading.tsx:112-114`: `done ? "Leído" : failed ? "Sin terminar" : \`Leyendo · ${job?.step ?? "en cola"}\``. «Leído» (`:113`) es un estado del trabajo en segundo plano (`background_jobs.status = "done"`, `:59`), no una afirmación sobre las fuentes.
2. **Estado por fuente.** `reading.tsx:190-195`: `done ? "leído" : failed ? "sin acceso" : "leyendo"` (`:194`). Es el mismo estado del trabajo pintado en cada fuente: todas dicen lo mismo a la vez. Además «sin acceso» (`:194`) afirma una causa que no se conoce: el trabajo puede fallar o cancelarse por el límite mensual de gasto (`src/lib/onboarding.server.ts:24-25`), por la IA o por la web (hallazgo «Sin acceso a la web», `:41`), y `failed` agrupa `failed` y `cancelled` (`:60`).
3. **Paso del trabajo en la cabecera.** `job.step` lo escribe el servidor en español: «Leyendo tu web», «Mercado y competidores», «Proponiendo tu estrategia», «Debate de los C-Levels» (`onboarding.server.ts:38,52,66,73`). La cabecera actual da «Leyendo · Leyendo tu web» (repite la palabra). `step` es `null` hasta que el trabajo arranca («en cola», `:113`).
4. **El hallazgo ya guarda su fuente.** `src/lib/onboarding.ts:20-29` `Finding` (`source: string | null`, `discardedAt?`, `sourceRemoved?`). El servidor los escribe en `onboarding.server.ts:30-33` (`note`) con estas fuentes: `Web · {host}` (`:42`), nombre de archivo(s) o «Texto pegado» (`:46`), nombre de archivo (`:48`), URL de mercado (`:61`), «Debate C-Levels» (`:75`) y, para la propuesta, el texto libre que la IA puso en `basis.source` o, si falta, «Supuesto de Nokko» / «Tus fuentes» (`src/lib/onboarding.ts:64-74`, instrucción a la IA en `src/lib/setup-extract.server.ts:47`: «por ejemplo "Web · precios", "Business plan", "Texto pegado" o null»).
5. **Regla de coincidencia ya existente.** `src/lib/onboarding-sources.ts:44-48` `findingsDependingOn(source, findings)`: `sourceCore(source)` (`:39-41`, quita «Web ·», « (Drive)», `https://`, minúsculas, sin tildes) y un hallazgo cuenta si `f.source && !f.discardedAt && norm(f.source).includes(core)`. Un `core` vacío no coincide con nada (`:46`). La usa el diálogo de «Quitar» (`dropSource`, `reading.tsx:71-97`; el cuerpo «N hallazgos vienen de esta fuente» está en `:76`). Contar con otra regla haría que el número de la fuente y el del diálogo discreparan.
6. **Fuentes que ve el paso.** `sources: string[]` con etiquetas como `Web · https://…`, `plan.pdf`, `plan.pdf (Drive)`, `Texto pegado` (`src/components/onboarding/sources.tsx:74-79,138`).
7. **Tests actuales.** `src/components/onboarding/reading.test.tsx:52-68` (3 pruebas de «Hacer solo el diagnóstico»; mock de `supabase`, `useMe` y `confirm-dialog`; ningún texto de cabecera ni de estado por fuente está afirmado: `grep` de «Leído|leído|sin acceso» en `src/` solo da `reading.tsx:113,194` en esta pantalla). `src/lib/onboarding-sources.test.ts:38-44` prueba `findingsDependingOn`: `:42` afirma que la fuente «Tus fuentes» **sí** coincide con un hallazgo cuya fuente es «Tus fuentes» (`[2]`); el único caso que da «ninguno» es el núcleo vacío `"   "` (`:43`). Para CA-6 basta que las fuentes reales de la pantalla nunca se llaman «Tus fuentes» (§3.6), así que ese texto de un hallazgo no cuenta para ninguna fuente concreta.
8. **Cobertura de la regla (límites, comprobados leyendo el código).** (a) La coincidencia es por subcadena: un `core` corto (por ejemplo `a.md`) también coincide con `data.md`. (b) Un hallazgo cuya fuente es texto libre de la IA («Web · a.com y plan.pdf») cuenta para las dos fuentes, así que la suma de los contadores puede superar el número de hallazgos. (c) Un hallazgo de error («Sin acceso a la web: …», fuente = host) coincide con la fuente web y se cuenta como suyo. (d) «Empiezo a leer tus fuentes» tiene `source: null` y no cuenta para ninguna. (e) **Fuente web: la regla no es fiable.** La etiqueta guarda la URL tal cual (`Web · ${url}`, `sources.tsx:75`), pero el servidor anota solo el host: `Web · ${host}` en el hallazgo de lectura y el host suelto en el de error (`onboarding.server.ts:39,41,42`). Con una ruta («Web · https://acme.test/precios») el núcleo es `acme.test precios` y no coincide con `acme.test`; con LinkedIn («Web · https://www.linkedin.com/company/x», que el campo admite: `sources.tsx:~107`, «Web, blog o LinkedIn de la empresa») pasa lo mismo; y la IA atribuye en texto libre («Web · precios», `setup-extract.server.ts:47`), que tampoco coincide. Resultado comprobado por la sonda del gate: una web leída con éxito sale con 0 o 1 hallazgos (la línea «Leída tu web…» solo cuando no hay ruta). Por eso **la fuente web no muestra contador** (§6, CA-7). (f) **Otros textos de hallazgo en la misma pantalla:** el servidor escribe «Leído: a.md, b.md» / «Leído el texto que pegaste» (`onboarding.server.ts:46`) y «Sin acceso a la web: …» (`:41`); se pintan en la lista, así que las aserciones de «Leído» y «sin acceso» se limitan a la cabecera y al estado de cada fuente (CA-1, CA-2).
9. **Documentos que se leen.** La pantalla de fuentes acepta hasta `MAX_FILES = 10` (`onboarding-sources.ts:8`) pero el servidor solo lee 3 (`onboarding.server.ts:22`; el esquema del job también limita a 3, `background.functions.ts:150`). Es el fallo que corrige **NK-0164** (cliente y servidor con un solo límite de 3). Este SDD **no afirma nada sobre más de 3 documentos**: parte de que, tras NK-0164, cada lectura tiene como máximo 3, y cada uno lleva su hallazgo «Leyendo el documento {archivo}» con el nombre exacto como fuente (`:48`).

**Uso real:** sin dato (no hay eventos de uso del onboarding en el repo; la única señal es la pregunta de Fede).

**Por qué ahora:** Fede lo ha pedido en el sprint 8 y es lo primero que ve una persona nueva tras subir sus fuentes.

## 4. Resultado buscado
Cualitativo, sin línea base medida («sin dato»):
- Quien llega al final de la lectura puede decir, de cada fuente que no sea una web (documentos, texto pegado), cuántos hallazgos salieron de ella y cuáles son, sin abrir nada más. De una web no se da cifra (§3.8e); la pantalla lo dice sin inventar nada.
- La cabecera y el estado de cada fuente no afirman nada que no se sepa.
Comprobación: el §walkthrough de §9 y las pruebas de §7. No se mide conversión ni tiempo (sin dato; no se inventa objetivo).

## 5. Alcance
**Incluye:**
- Nueva frase de cabecera para los tres estados (y «cancelada» aparte), y estado de cada fuente.
- Contador de hallazgos por fuente y desplegable con su lista, solo cuando la lectura ha terminado y solo para fuentes donde la regla compartida es fiable (todas menos la web). La web muestra un texto neutro sin cifra.
- Función pura `summarizeSources` en `src/lib/onboarding-sources.ts` con la misma regla que `findingsDependingOn`; para una fuente web devuelve `count: null`.
- Actualizar la viñeta «Onboarding sources and findings» de `src/lib/AGENTS.md` (U-4).

**No incluye** (límite que el brief copia a «Movimientos prohibidos»):
- NK-0157: cualquier texto sobre dónde aporta valor un hallazgo a la estrategia (bloque, nivel, «por qué importa»). Requiere que la lectura devuelva ese dato; hoy no lo devuelve.
- Cambios en `onboarding.server.ts`, `setup-extract.server.ts`, `onboarding.ts` (tipo `Finding`), esquema, RLS, migraciones, llamadas a IA, funciones del servidor.
- Cambiar la regla de coincidencia de `findingsDependingOn` o su uso en `dropSource` (se reutiliza tal cual; si un caso límite de §3.8 se quiere corregir, por ejemplo hacer fiable el recuento de la web por host, es otro ticket y cambia a la vez el diálogo).
- Cambiar cuántos documentos admite o lee la lectura: es NK-0164. Ni afirmar ni probar nada con más de 3.
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
| Fuente no web, `done` (`:194`) | «leído» | «N hallazgos» · «1 hallazgo» · «Sin hallazgos propios» |
| Fuente web (etiqueta que empieza por «Web ·»), `done` | «leído» | «Sin recuento para webs» + texto visible de apoyo (§9); sin botón |
| Fuente, `failed` o `cancelled` (`:194`) | «sin acceso» | «Sin terminar» |
| Fuente, en curso | «leyendo» | «leyendo» (igual) |
**Eliminado:** las palabras «Leído», «leído» y «sin acceso» **de la cabecera y del estado de cada fuente**. No se eliminan de la lista de hallazgos: el servidor escribe «Leído: a.md», «Leído el texto que pegaste» y «Sin acceso a la web: …» (§3.8f) y siguen viéndose, sin cambios.

## 7. Historias y criterios de aceptación
### H-1: Como Owner en el onboarding, quiero que la pantalla me diga con palabras qué ha pasado con mis fuentes, para no tener que adivinar qué es «Leído».
- **CA-1** Con el trabajo `done`, la cabecera dice «Terminé de leer tus fuentes» y ni la cabecera ni el estado de ninguna fuente contienen «Leído»/«leído» (cualquier mayúscula; aserción con `within` sobre el elemento de cabecera y sobre el estado de cada fuente, no sobre la pantalla entera). Dato de prueba obligatorio: un hallazgo «Leído: plan.md» (fuente «plan.md») que sigue visible en la lista; así se demuestra que el alcance está bien acotado. · prueba: `src/components/onboarding/reading.test.tsx` («the header says what happened when done»)
- **CA-2** Con el trabajo `failed` la cabecera dice «No pude terminar de leer tus fuentes»; con `cancelled`, «Se canceló la lectura»; el estado de cada fuente es «Sin terminar» y no contiene «sin acceso» (misma aserción acotada con `within`; el dato de prueba incluye un hallazgo «Sin acceso a la web: ejemplo.test» que sigue visible en la lista). · prueba: `reading.test.tsx` («failed and cancelled headers; no claim of access»)
- **CA-3** En curso la cabecera dice «Estoy leyendo tus fuentes · {paso}»; con `step` nulo, «… · esperando turno». · prueba: `reading.test.tsx` («running header with and without step»)
- **CA-4** Con la lectura terminada aparece, bajo la cabecera, una frase que dice qué es cada línea y qué puede hacer la persona: «Cada línea es algo que encontré, con su fuente al final. Confírmalo, edítalo o descártalo.» Sin afirmar nada sobre la estrategia. · prueba: `reading.test.tsx` («help sentence, no strategy claim»)

### H-2: Como Owner, quiero ver cuántos hallazgos salieron de cada fuente y cuáles son, para saber qué vio Nokko en cada una.
- **CA-5** `summarizeSources(sources, findings)` devuelve, por fuente y en el orden de `sources`, `{ source, indexes, count }` con `indexes` igual a `findingsDependingOn(source, findings)` (misma regla; descartados excluidos; hallazgos con `source: null` no cuentan; fuente con `core` vacío → `count: 0`). Para una fuente web (etiqueta que cumple `/^Web\s*·/i`, la misma que quita `sourceCore`) devuelve `count: null`: no hay cifra fiable (§3.8e). Para el resto, `count === indexes.length`. · prueba: `src/lib/onboarding-sources.test.ts` («summarizeSources agrees with findingsDependingOn»)
- **CA-6** Casos de la regla: «Web · https://acme.test» cuenta el hallazgo con fuente «Web · acme.test»; «plan.pdf (Drive)» cuenta el de fuente «Plan.pdf»; un hallazgo descartado no cuenta; uno con fuente «Tus fuentes» o «Supuesto de Nokko» no cuenta para ninguna fuente concreta; un hallazgo con fuente que menciona dos fuentes cuenta en ambas; «Texto pegado» cuenta el hallazgo «Texto pegado»; el hallazgo «Leído: plan.md» (fuente «plan.md») cuenta para «plan.md». Casos web, con el resultado esperado escrito: «Web · https://acme.test», «Web · https://acme.test/precios» y «Web · https://www.linkedin.com/company/ejemplo» devuelven los tres `count: null`, aunque `indexes` salga distinto (`[0]`, `[]`, `[]` con un hallazgo de fuente «Web · acme.test»); un hallazgo de fuente «Web · precios» no cuenta para ninguna. · prueba: `onboarding-sources.test.ts` («summarizeSources cases»)
- **CA-7** Con la lectura terminada cada fuente no web muestra «N hallazgos» (N ≥ 2), «1 hallazgo» (N = 1) o «Sin hallazgos propios» (N = 0), nunca «0 hallazgos»; una fuente web muestra «Sin recuento para webs» y nunca «Sin hallazgos propios» ni una cifra, tenga los hallazgos que tenga (casos: web sin ruta, web con ruta, LinkedIn). · prueba: `reading.test.tsx` («per-source count wording; web has no count»)
- **CA-8** El número de una fuente es el mismo que el del diálogo de «Quitar»: con 2 hallazgos vivos de una fuente, la fila dice «2 hallazgos» y al pulsar «Quitar» el diálogo (`askUnsaved`, `reading.tsx:76`) recibe un cuerpo que empieza por «2 hallazgos vienen». (Solo se afirma para fuentes con contador; el diálogo de una web sigue como hoy, §14.) Tras descartar uno desde la lista, la fila pasa a «1 hallazgo». · prueba: `reading.test.tsx` («count matches the remove dialog and follows discards»)
- **CA-9** Una fuente con N ≥ 1 se puede expandir y colapsar con un botón con `aria-expanded` (cerrado por defecto) cuyo nombre accesible **contiene el texto visible** (WCAG 2.5.3): «{contador} · {fuente}», por ejemplo «2 hallazgos · a.md» (el texto visible es «2 hallazgos»); abierta lista el texto de cada hallazgo vivo de esa fuente, y solo esos. Una fuente con «Sin hallazgos propios» o «Sin recuento para webs» no tiene botón. El botón tiene un área táctil mínima de 44 px (§9). · prueba: `reading.test.tsx` («expanding a source lists only its live findings»)
- **CA-10** Abierto, el desplegable refleja la lista viva: si el hallazgo se edita, el texto nuevo aparece; si se descarta, desaparece (sin recargar). · prueba: `reading.test.tsx` («expanded list follows the live findings», con `rerender`)
- **CA-11** Con la lectura en curso o fallida no hay contador ni desplegable (la lista sigue escribiéndose o es parcial). La prueba usa los mismos datos con tres estados: `running` y `failed` no muestran contador ni botón, y el control positivo `done` muestra «1 hallazgo»; así la prueba **falla primero** sobre `ec5a813` (donde nunca hay contador) por el control. · prueba: `reading.test.tsx` («no counts while running or failed; done shows them»)

## 8. Casos límite y errores
- Fuente no web sin hallazgos atribuibles (p. ej. todo quedó bajo «Tus fuentes», o se descartaron): «Sin hallazgos propios», sin botón (CA-7, CA-9), con su texto de apoyo visible (§9), que no afirma que Nokko no la leyó.
- Fuente web (con o sin ruta, LinkedIn): «Sin recuento para webs», sin botón, nunca «Sin hallazgos propios» (§3.8e). Sus hallazgos, incluido «Sin acceso a la web: …», siguen en la lista.
- Todos los hallazgos descartados: contadores a «Sin hallazgos propios»; la lista conserva «Has descartado todos los hallazgos.» (`reading.tsx:152`, sin cambios).
- Mismo hallazgo en dos fuentes (§3.8b): aparece en ambos desplegables; no hay total.
- Sin fuentes (`sources` vacío): la columna de fuentes no pinta filas, como hoy.
- Tras «Quitar» una fuente: desaparece su fila; sus hallazgos conservados quedan con «fuente quitada» (comportamiento actual, sin cambios).
- Otra empresa (multitenant): no aplica, todo sale de `findings` y `sources` que el paso ya recibe por props; no hay consulta nueva.
- Texto largo de una fuente en 375 px (URL sin espacios): `flex-wrap` reparte los elementos de la fila pero no corta una palabra larga y `src/styles.css` no define `overflow-wrap` (solo `.grid > * { min-width: 0 }`, `:225-226`). Por eso la etiqueta de la fuente lleva `[overflow-wrap:anywhere]` (o `break-words`) y `min-w-0`; sin desplazamiento horizontal. Caso obligatorio en el walkthrough.

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
| Texto de apoyo de «Sin hallazgos propios» | Visible siempre, en texto pequeño bajo el nombre de la fuente (no solo en `title`, que no existe en táctil): No atribuí ningún hallazgo a esta fuente por separado. |
| Fuente web, terminado | Sin recuento para webs |
| Texto de apoyo de la web | Visible siempre bajo la fila: Los hallazgos de una web se anotan con su dirección; búscalos en la lista. |
| Botón del desplegable | texto visible = contador («2 hallazgos»); nombre accesible «2 hallazgos · {fuente}» (contiene el texto visible); `min-h-11 min-w-11` (44 px) en móvil; `src/styles.css` no tiene token de mínimo táctil y `Button` mide 36-40 px (`ui/button.tsx:23-24`), así que se fija con esas clases sobre un `<button>` propio |
| Fuente, fallido o cancelado | Sin terminar |
| Fuente, en curso | leyendo |
Mensaje de error del trabajo (`job.error`) y «La lectura se canceló.» (`reading.tsx:184`): sin cambios; ya cuentan qué pasó.

**§walkthrough** (lo ejecuta `nokko-walkthrough` tras el gate; capturas como evidencia, consola y red sin errores nuevos):
1. 375 px y 1280 px, tema claro y oscuro (`.dark` en `<html>`), con el trabajo en curso, terminado con hallazgos repartidos entre una web, un PDF y un texto pegado, terminado con una fuente sin hallazgos propios, fallido y cancelado.
2. Terminado (incluye un hallazgo «Leído: plan.md» en la lista y un archivo `plan.md` entre las fuentes): la cabecera dice «Terminé de leer tus fuentes»; cada fuente da su contador; abrir y cerrar una fuente con teclado (Tab, Enter/Espacio) y ver el foco visible; el lector de pantalla anuncia «expandido/contraído».
3. Descartar un hallazgo con el desplegable abierto: el contador y la lista cambian a la vez.
4. Pulsar «Quitar» en una fuente: el número del diálogo coincide con el de la fila.
5. 375 px: sin desplazamiento horizontal; caso con una URL larga sin espacios (por ejemplo `https://www.ejemplo.test/` + 90 caracteres) como fuente web: la etiqueta se parte con `overflow-wrap`; el botón del desplegable de una fuente de archivo mide al menos 44 px de alto y ancho (medido con las herramientas del navegador).
5b. Fuentes web de prueba: sin ruta, con ruta y LinkedIn (datos ficticios): las tres muestran «Sin recuento para webs» y su texto de apoyo, nunca «Sin hallazgos propios».
6. Solo tokens y utilidades del sistema (`text-ink-mid`, `text-ink-faint`, `border-hairline`, `text-destructive`): ningún color fijo; contraste suficiente en claro y oscuro (cálculo del gate: `ink-faint` sobre `paper` 5,03 claro y 5,92 oscuro; `ink-mid` 7,50 y 8,60; AA para texto normal; se confirma en capturas).

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
| U-3 | Contador y desplegable por fuente en `reading.tsx`; texto neutro de la web | CA-7, CA-8, CA-9, CA-10, CA-11 | `reading.test.tsx` (se añade) |
| U-4 | Actualizar la viñeta «Onboarding sources and findings» de `src/lib/AGENTS.md` (línea 62): `summarizeSources`, que ReadingStep muestra contadores solo con la lectura terminada y que la web no lleva recuento | entregable de documentación (sin CA de comportamiento) | No aplica: sin test; se comprueba en la revisión del diff |

Los tests se **añaden**; no se modifica ninguna prueba existente (las tres de NK-0009 y las de `findingsDependingOn` siguen como están). En `reading.test.tsx` se añade un auxiliar nuevo (`showWith(findings, sources, status)`) junto al `show` actual, sin cambiarlo. Cada prueba nueva debe fallar sobre `ec5a813` antes del cambio (CA-1: hoy aparece «Leído»; CA-5: la función no existe; CA-7/8/9: no hay contador; CA-11: falla por el control positivo `done` con «1 hallazgo»). Se construye sobre `main` tras NK-0164: el comando `fail-first` usa como base ese commit, no `ec5a813`.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- `summarizeSources(sources: string[], findings: Finding[]): { source: string; indexes: number[]; count: number | null }[]` = `sources.map((s) => { const indexes = findingsDependingOn(s, findings); return { source: s, indexes, count: /^Web\s*·/i.test(s) ? null : indexes.length }; })`. Una sola regla, sin duplicar `norm`; `findingsDependingOn`, `sourceCore` y `dropSource` no cambian. Alternativa descartada: contar la web por host dentro de `summarizeSources`: el número de la fila discreparía del diálogo de «Quitar» (que usa `findingsDependingOn`), y cambiar `findingsDependingOn` para que ambos coincidan altera el diálogo (hoy una web con ruta da 0 hallazgos). Eso es un ticket aparte.
- `reading.tsx`: `const summary = useMemo(() => summarizeSources(sources, findings), [...])`; estado local `open: Set<string>` (o un `useState<string | null>` por fuente); el desplegable pinta `findings[i].text` para cada `i` de `indexes`, sin acciones. La etiqueta de la fuente: `[overflow-wrap:anywhere] min-w-0`. El texto de apoyo se renderiza como `<p>` visible (con `id`, y `aria-describedby` en la fila si hace falta), nunca solo `title`.
- Botón en lugar de `<details>`: con `<details>` el contenido cerrado sigue en el DOM y las pruebas no distinguen abierto de cerrado; el botón con `aria-expanded` es verificable y accesible. Alternativa descartada: reutilizar `<details>` (el patrón de «descartados», `reading.tsx:157`).
- Copy de cabecera como función pura pequeña (`readingHeadline(status, step)`) en el mismo `onboarding-sources.ts` solo si el gate lo prefiere; no es necesario para los CA.
- Convención del repo: sin `as any`; textos de usuario por `errorText()` solo cuando hay error crudo (aquí no lo hay).

## 14. Riesgos y dependencias
- **Contadores que parecen más exactos de lo que son** (§3.8a, b): subcadena y fuente libre de la IA. Mitigación: el desplegable permite comprobarlo; se mantiene la regla única con el diálogo; no hay total. Corregir la regla es un ticket aparte que cambia también el diálogo. Límite que se declara: para un archivo, la atribución libre de la IA («Business plan») no coincide con `plan.pdf`, así que el contador puede quedarse corto; cada archivo tiene al menos su hallazgo «Leyendo el documento …» (§3.9).
- **Web sin contador (§3.8e)**: la regla compartida no es fiable para webs, así que no se muestra cifra (decisión del coordinador). Efecto conocido y no tocado aquí: el diálogo de «Quitar» sobre una web con ruta o LinkedIn puede decir «Ningún hallazgo depende de ella» aunque la lista tenga hallazgos de esa web; es el comportamiento de hoy. Se propone un ticket hermano que haga fiable la coincidencia por host y cambie a la vez el diálogo y sus pruebas.
- **Dependencia de NK-0164**: sin él la pantalla acepta hasta 10 documentos y el servidor lee 3; «Terminé de leer tus fuentes» sería falso para los demás. NK-0156 no se construye antes de que NK-0164 esté integrado en `main`.
- **«Sin hallazgos propios» mal leído como «no se leyó»**: por eso el texto de apoyo dice «No atribuí ningún hallazgo a esta fuente por separado» y no promete nada más.
- **Frase de cabecera larga en 375 px**: se parte en líneas; revisar en el §walkthrough.
- **Fuente no legible pero lectura `done`**: el trabajo puede terminar con el hallazgo de error «Sin acceso a la web: …» (`onboarding.server.ts:41`). Ese hallazgo se cuenta como de la web y se ve en su desplegable; la cabecera «Terminé de leer tus fuentes» no promete que todas se leyeran con éxito. Decidido: se mantiene «Terminé de leer tus fuentes» (§15, P-1).
- NK-0157 puede apoyarse después en `summarizeSources` y en el desplegable.

## 15. Preguntas para Fede y para la revisión técnica
- **P-1 (resuelta por el coordinador, Fede delegó la ejecución):** se mantiene «Terminé de leer tus fuentes». Fede puede revertirlo; solo cambia el copy de CA-1.
- **P-2 (resuelta por el coordinador):** el contador se muestra solo donde la regla es fiable (no web); la web no lleva cifra. Queda propuesto el ticket hermano para la coincidencia por host (§14); no bloquea.
- **P-3 (para el gate):** confirmar que `FieldActions kind="onboarding_source"` no necesita cambios al añadir el botón en la misma fila.
Nota: no hay preguntas de producto que bloqueen el SDD; P-1 no bloquea.

## 16. Pendiente de verificar
- **[Por verificar]** Contraste (calculado: pasa AA) y área táctil real de 44 px del botón del desplegable en 375 px, claro y oscuro (capturas y medición del §walkthrough).
- **[Por verificar]** Que con una web inaccesible y lectura `done` el hallazgo «Sin acceso a la web: …» se vea en la lista y la fila de la web diga «Sin recuento para webs» (la web ya no tiene desplegable); se comprueba en el §walkthrough con una web de prueba que falle.
- **[Por verificar]** Que NK-0164 esté integrado en `main` antes de construir; el brief de NK-0156 debe citar el commit resultante como base.
- **[Por verificar]** Que `NK-0156` y `NK-0157` están registrados en el ledger: `.factory/ledger.json` en `main` @ `ec5a813` llega a NK-0152 y no contiene NK-0156 ni NK-0157. Lo registra `nokko-tracker`/`nokko-intake`, no este SDD. Enlazar con `node scripts/factory/ledger.mjs doc NK-0156 --sdd docs/sdd/SDD-20261112-onboarding-leido.md` cuando exista el ticket.
- Uso real del onboarding: sin dato.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Estado: pass 1 FAIL → corregido en `<sha>`; pass 2 pendiente.
- Informe de la pasada 1 (sin editar): `.factory/evidence/NK-0156/sdd-gate-pass1.md` (3 MAJOR, 7 MINOR, 0 BLOCKER).
- Veredicto del gate (pasada 2): No revisado
- CA sin prueba posible o sin G-n: No revisado (este SDD no tiene PRD; los CA no citan G-n)
- [Por verificar] que sigue sin comprobarse: No revisado
- Contradicciones con el código o con decisiones previas: No revisado
- Lo que esta revisión NO demuestra: No revisado

### Decisiones del coordinador (Fede delegó la ejecución; 2026-11-12)
- **Decisión del coordinador (P-1):** se mantiene «Terminé de leer tus fuentes».
- **Decisión del coordinador (M2):** NK-0156 depende de NK-0164 (cliente y servidor limitados a 3 documentos por lectura) y se construye sobre `main` después de que NK-0164 se integre. Este SDD no afirma nada sobre más de 3 documentos.
- **Decisión del coordinador (M1):** el contador solo se muestra donde la regla compartida `findingsDependingOn` es fiable; la fuente web muestra «Sin recuento para webs» y no usa «Sin hallazgos propios». No se cambia `findingsDependingOn` ni el diálogo (contar por host haría discrepar fila y diálogo, o cambiaría el diálogo, que hoy da 0 para una web con ruta). Ticket hermano propuesto para afinar la coincidencia de la web.
- **Decisión del coordinador (M3):** CA-1, CA-2 y «Eliminado» (§6) se limitan a la cabecera y al estado de cada fuente; fixture «Leído: plan.md» obligatorio.

## 18. Delta de implementación (lo rellena el agente al entregar)
Pendiente.

## Lo que NO se afirma
- No se afirma dónde aporta valor un hallazgo a la estrategia, a qué bloque alimenta ni cuánto confía Nokko en él. Es NK-0157 y requiere que la lectura devuelva ese dato.
- No se afirma que Nokko «vio» o «entendió» una fuente: solo que algún hallazgo lleva esa fuente anotada. «Sin hallazgos propios» no es «no leída».
- No se afirma nada sobre cuántos hallazgos salieron de una web (sin cifra por diseño), ni sobre más de 3 documentos por lectura (NK-0164).
- No se afirma que los contadores sumen el total de hallazgos ni que cada hallazgo salga de una única fuente (§3.8).
- No se afirma el motivo de un fallo («sin acceso» se retira): el estado dice solo «Sin terminar»; el motivo, si existe, sigue siendo `job.error`.
- No se afirma ninguna mejora medida (sin dato), ni que la persona confirme más hallazgos por verlos agrupados.
- No se verifica nada en producción ni con datos reales; el análisis es sobre el código de `main` @ `ec5a813`.
