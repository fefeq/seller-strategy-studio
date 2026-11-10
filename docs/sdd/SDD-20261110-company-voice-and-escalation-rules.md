# SDD-20261110-company-voice-and-escalation-rules · [Feature] Voz de la empresa, regla «Escalar» y reglas por defecto

**Tipo:** Feature · **Prioridad propuesta:** Media (los plays que redactan hoy no tienen la voz de la empresa; las reglas por defecto reducen el riesgo de borradores fuera de tono o promesas sin base)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-10
**Ticket:** NK-0126 (iniciativa; este es su SDD 3)
**PRD:** `docs/prd/PRD-20261110-diagnostico-y-equipos-de-plays.md` (cubre G-4 y G-5) · **Depende de:** `SDD-20261106-agent-rules-reader.md` (NK-0087, Hecho), `SDD-20261109-rules-write-permissions.md` (NK-0095, Hecho en código; ver §14) y `SDD-20261109-rules-in-ai-readers.md` (NK-0096)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) tiene una prueba automática que lo nombra.

## 1. Resumen
Tres piezas sin pantalla nueva, sobre Conocimiento (`knowledge_docs`):
1. **Voz:** una sección «Voz» donde Owner y Sales Leader guardan tres mensajes reales de la empresa; los textos que redactan el agente y los plays la usan como molde.
2. **Escalar:** un tipo de regla («Escalar a una persona cuando…») dentro de las Reglas actuales, que el agente lee aparte para parar y preguntar.
3. **Reglas por defecto:** un conjunto base de reglas Nunca, Siempre y Escalar, redactado por nosotros y aprobado por Fede, que un Owner o Sales Leader puede añadir a su empresa con una acción explícita.

## 2. Problema y para quién
Los borradores de seguimiento, reunión y reactivación no conocen cómo escribe la empresa, y las Reglas solo dicen qué no hacer, no cuándo pasar el caso a una persona. Para Owner y Sales Leader, que escriben las reglas que el agente de todo el equipo obedece.

## 3. Evidencia y por qué ahora
Leído en `main` @ `aa368b62` (código de `d3eeba1`), el 2026-11-10:
- `src/lib/knowledge-rules.ts:18`: una regla es un documento de equipo con `mandatory` o de sección `rules` (`isMandatory`); `:56` el agente solo lee documentos de equipo vinculantes; `rulesBlock` (`:119`) los entrega al modelo como datos en `reglas_obligatorias`. No hay noción de tipo de regla.
- `src/lib/knowledge-rules.ts:30` (`BINDING_WRITERS = owner, sales_leader`) y `:43` (`canEditDoc`): solo esos roles escriben documentos vinculantes. La base de datos lo repite en la migración `0081_knowledge_binding_writers.sql`, que `docs/BASE-DE-DATOS.md:45` dice **no aplicada a la base real**. **[Por verificar]**
- `src/lib/screen-sections.ts:4-13`: `HUB_SECTIONS` = company, objections, playbooks, methodology, campaigns, skills, rules, drive. No existe «voz».
- `src/lib/playbooks/library-core.ts:20` (`createLibraryCore`) y `src/lib/playbooks.functions.ts`: precedente de una acción explícita, solo de Owner y Sales Leader, que inserta lo que falta en `knowledge_docs` sin duplicar por título. Se reutiliza el patrón para las reglas por defecto.
- NK-0095: «cualquier miembro puede escribir en Conocimiento» salvo lo vinculante; un documento de sección «voz» no es vinculante y hoy lo escribiría cualquier miembro (RLS de `0002_multitenant_organizations.sql:128`).
- La decisión 22 del PRD pone la voz en Conocimiento, solo equipo; la 23, «Escalar» como tipo de Regla; la 24, reglas por defecto redactadas por Claude y aprobadas por Fede.
- Sin datos de uso: líneas base «sin dato».

**Por qué ahora:** el diagnóstico (SDD 4 de la iniciativa) captura voz y reglas; sin este SDD no tendría dónde guardarlas ni cómo leerlas.

## 4. Resultado buscado
Referencia al PRD:
- G-4: empresas con reglas base aprobadas. Línea base: sin dato. Fuente: `knowledge_docs` (sección `rules`).
- G-5: empresas con tres mensajes de voz y borradores que la leen. Línea base: sin dato. Fuente: `knowledge_docs` (sección `voice`) y `play_runs`.

## 5. Alcance
**Incluye:**
- Sección `voice` en Conocimiento (documentos de equipo, no vinculantes) con aviso de privacidad.
- Escritura de la sección `voice` limitada a Owner y Sales Leader, en pantalla, en código y en base de datos.
- Lector `loadVoice` que entrega hasta tres ejemplos al agente y a los textos que redactan.
- Tipo de regla «Escalar»: convención de título más lectura aparte en `rulesBlock`.
- `defaultRules()` y la acción «Añadir reglas base» de Owner y Sales Leader, sin duplicar por título.
- Texto de las reglas por defecto para aprobación (§9).

**No incluye:** (es el límite que el brief copia a «Movimientos prohibidos»)
- El diagnóstico en chat o asistente guiado (SDD 4 y 5 de la iniciativa).
- Inferir la voz desde correos o publicaciones.
- Mostrar la voz fuera del equipo ni exportarla.
- Cambiar la columna `mandatory`, el esquema de `knowledge_docs` o las Reglas existentes.
- Aplicar reglas por defecto de forma automática o a empresas existentes sin acción de un líder.
- Pantallas nuevas.

## 6. Cambios de comportamiento (delta)
**Añadido:** sección Voz; lector de voz; regla «Escalar»; reglas por defecto y su acción.
**Modificado:** `HUB_SECTIONS` incluye `voice`; `rulesBlock` separa las reglas «Escalar» del resto; `canEditDoc` y la política de base de datos incluyen `voice` entre lo que escriben solo Owner y Sales Leader.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner o Sales Leader, quiero guardar tres mensajes reales de mi empresa para que los borradores suenen como nosotros.
- **CA-1** La sección «Voz» existe en Conocimiento y guarda documentos de equipo; no son reglas ni llegan al agente como obligatorias · cubre G-5 · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-2** Solo Owner y Sales Leader crean, editan o borran documentos de la sección `voice`; el resto los ve de solo lectura con el motivo en palabras · cubre G-5 · prueba: `src/components/hub/hub-screen.test.tsx` y `src/lib/knowledge-rules.test.ts`
- **CA-3** La base de datos aplica lo mismo que CA-2 (política restrictiva para `voice`), y el código que usa el cliente de servicio (Drive, segundo plano, agente) también lo comprueba · cubre G-5 · prueba: `src/lib/knowledge-voice-rls.test.ts`
- **CA-4** `loadVoice` devuelve como máximo tres ejemplos de la empresa activa, filtrados por empresa y de equipo, con el cliente de usuario y con el de servicio; un fallo de lectura se informa y no se interpreta como «sin voz» · cubre G-5 · prueba: `src/lib/knowledge-voice.test.ts`
- **CA-5** Los textos que redactan el agente (`draft_followup`, `prepare_meeting_brief`) y las generaciones de `ai-core` reciben la voz como datos de apoyo, nunca como instrucción de sistema, y el prompt dice que copie la forma, no el contenido · cubre G-5 · prueba: `src/lib/ai-core-rules.test.ts` y `src/lib/agent-tools.test.ts`
- **CA-6** Los logs, errores y evidencias nunca incluyen el texto de un ejemplo de voz · cubre G-5 · prueba: `src/lib/knowledge-voice.test.ts`

### H-2: Como Owner o Sales Leader, quiero reglas «Escalar» para que el agente pare y pregunte a una persona en los casos que decido.
- **CA-7** Un documento de Reglas cuyo título empieza por «Escalar» se trata como regla de escalado; el resto sigue como regla obligatoria · cubre G-4 · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-8** `rulesBlock` entrega las reglas de escalado en una lista aparte con la instrucción «si se da una de estas condiciones, no sigas: dilo y pide que lo decida una persona»; las escrituras siguen siendo propuestas que una persona confirma · cubre G-4 · prueba: `src/lib/knowledge-rules.test.ts`
- **CA-9** Los límites de lectura (`MANDATORY_LIMIT`, 4000 caracteres) cuentan las reglas de escalado dentro del mismo total, y el aviso de reglas truncadas sigue funcionando · cubre G-4 · prueba: `src/lib/knowledge-rules.test.ts`

### H-3: Como Owner o Sales Leader, quiero añadir reglas base seguras con una acción para no empezar de cero.
- **CA-10** `defaultRules()` devuelve exactamente las reglas del §9 (tres Nunca, tres Siempre, tres Escalar) en español, «tú», sin nombres ni datos de clientes · cubre G-4 · prueba: `src/lib/default-rules.test.ts`
- **CA-11** La acción «Añadir reglas base» solo la ejecutan Owner y Sales Leader, inserta solo las que faltan por título en la sección `rules` de la empresa activa y puede repetirse sin duplicar · cubre G-4 · prueba: `src/lib/default-rules.test.ts`
- **CA-12** Ninguna regla por defecto se crea sin esa acción: crear una empresa o abrir Conocimiento no inserta nada · cubre G-4 · prueba: `src/lib/default-rules.test.ts`
- **CA-13** Las tres reglas «Nunca» base cubren no enviar ni publicar sin confirmación, no inventar datos y no exponer datos de clientes, y ninguna regla base permite lo contrario de la salida solo-borrador de los plays (`outputs` del catálogo) · cubre G-4 · prueba: `src/lib/default-rules.test.ts`

## 8. Casos límite y errores
- **Otra empresa:** `loadVoice` y la acción filtran por `org_id`; un ejemplo de otra empresa nunca llega (CA-4, CA-11).
- **Menos de tres ejemplos:** se usan los que haya; con cero, los borradores siguen como hoy.
- **Más de tres:** se leen los tres más recientes **[Por verificar]** con Fede si se prefiere un orden manual.
- **Ejemplo muy largo:** se corta a un límite razonable y se avisa (el límite lo fija el SDD al implementar, sin inventar cifra aquí).
- **Título «Escalar» escrito distinto** («escalar», espacios): se compara sin distinguir mayúsculas y sin espacios iniciales (CA-7).
- **Fallo de lectura:** se avisa «No he podido leer la voz» y el borrador sale sin ella, nunca como si no existiera (CA-4).
- **Miembro sin rol cargado:** no escribe, como en `canEditDoc` (CA-2).
- **Migración 0081 sin aplicar:** la protección de base de datos de CA-3 depende de ella (§14).

## 9. Experiencia y copy
Textos propuestos; Fede los aprueba.
- Sección: «Voz». Pista: «Pega tres mensajes reales que hayáis escrito y que representen cómo habláis. Quita nombres y datos de personas antes de pegar.»
- Solo lectura: «Solo el Owner o un Sales Leader pueden escribir la voz de la empresa. Pídeselo a uno de ellos.»
- Botón: «Añadir reglas base». Resultado: «Se han añadido N reglas base. Revísalas y edítalas.»; si ya estaban: «Ya tenías todas las reglas base.»
- Error de voz: «No he podido leer la voz de tu empresa. Este borrador no la usa; reinténtalo.»

**Reglas por defecto propuestas** (para aprobación de Fede; título de cada documento en negrita):
- **Nunca enviar ni publicar:** nunca envíes, publiques ni cambies datos sin que una persona lo confirme; todo sale como borrador o sugerencia.
- **Nunca inventar:** nunca inventes cifras, testimonios, nombres ni fechas; si falta un dato, dilo.
- **Nunca exponer datos de clientes:** nunca pegues textos, correos ni nombres de clientes en ejemplos, borradores ni resúmenes que vaya a leer otra persona.
- **Siempre solo datos de la empresa:** usa solo lo que está en la empresa; si no está escrito, pregunta.
- **Siempre fuente y fecha:** cita de dónde sale cada dato y cuándo se publicó.
- **Siempre voz de la empresa:** redacta con la voz guardada y, ante la duda, más corto.
- **Escalar cuando haya precio, descuento o condiciones:** si el texto necesita una cifra o condición que no está escrita, para y pregunta a una persona.
- **Escalar ante una queja, un asunto legal o una baja:** si el contacto reclama, menciona un asunto legal o pide que no le escribas más, para y pasa el caso a una persona.
- **Escalar cuando falte el ICP:** si no puedes saber si la cuenta encaja, para y pide a una persona que decida.

## 10. Datos, permisos y privacidad
- **Sin columnas nuevas.** La voz es un documento de `knowledge_docs` con `section = 'voice'` y `scope = 'team'`. Una migración añade una política restrictiva para que solo `owner` y `sales_leader` inserten, actualicen o borren documentos de equipo de la sección `voice`, con `org_id` por `current_org()`, siguiendo el patrón de la 0081 **[Por verificar]** su contenido exacto antes de redactar la migración; los GRANTs ya existen para la tabla.
- Los documentos de equipo los ve todo miembro de la empresa (RLS actual): la voz queda visible para todo el equipo; el aviso de pegado pide quitar datos de personas.
- Un documento personal nunca llega al agente (`knowledge-rules.ts:56`); la voz es siempre de equipo.
- Ningún ejemplo real en código, pruebas, fixtures, logs ni evidencias: los tests usan ejemplos ficticios.
- La migración se aplica y verifica como indica `docs/sdd/EXECUTION.md`; no se toca la base real desde este SDD.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna nueva. La voz se añade como contexto a las llamadas que ya existen (`draft_followup`, `prepare_meeting_brief`, generaciones de `ai-core`) | regla → caché → modelo barato; sin cambios | Sin cambios | Sin dato; el contexto añadido aumenta los tokens de entrada **[Por verificar]** |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Sección `voice`, `canEditDoc` para `voice`, aviso y texto en `hub-screen` | CA-1, CA-2 | `src/lib/knowledge-rules.test.ts` y `src/components/hub/hub-screen.test.tsx` |
| U-2 | Migración con política restrictiva para `voice` y comprobación en código con cliente de servicio | CA-3 | `src/lib/knowledge-voice-rls.test.ts` |
| U-3 | `loadVoice` y su entrega a `draft_followup`, `prepare_meeting_brief` y `ai-core` | CA-4, CA-5, CA-6 | `src/lib/knowledge-voice.test.ts`, `src/lib/ai-core-rules.test.ts`, `src/lib/agent-tools.test.ts` |
| U-4 | Tipo «Escalar» en `knowledge-rules.ts` y `rulesBlock` | CA-7, CA-8, CA-9 | `src/lib/knowledge-rules.test.ts` |
| U-5 | `defaultRules()` y acción «Añadir reglas base» (patrón de `createLibraryCore`) | CA-10, CA-11, CA-12, CA-13 | `src/lib/default-rules.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Escalar como convención de título** (sin migración): alternativa descartada, una columna `kind` en `knowledge_docs`, porque exige migración y cambiar las políticas; si el gate ve fallos por títulos mal escritos, reconsiderarla.
- Reutiliza `isBindingDoc`/`BINDING_WRITERS`; añade `voice` en una lista `WRITER_ONLY_SECTIONS` junto a `rules`.
- `loadVoice` imita a `loadAgentRules`: filtra por empresa y alcance en consulta y en memoria, informa del fallo y no registra texto.
- Pantalla: la sección entra en `HUB_SECTIONS` y en `sectionOf`; no hay ruta nueva.
- Tras tocar herramientas del agente: `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` y `TITLES`.

## 14. Riesgos y dependencias
- **Voz visible a todo el equipo:** son mensajes reales; mitigación en el aviso, pero el riesgo existe (decisión abierta 2 del PRD, pregunta 1 de §15).
- **0081 sin aplicar:** hasta que se aplique en la base real, un miembro que no sea líder podría escribir reglas y, con la migración de esta SDD, también voz escribiendo directo. NK-0096 «no es efectivo» según el SDD de NK-0095. Hay que ordenar la aplicación de ambas migraciones.
- **Convención de título:** una regla «Escalar» con un título distinto se lee como regla obligatoria normal; sigue protegiendo, pero sin el aviso de parada.
- **Contexto más largo:** más tokens en cada redacción; sin dato de coste.
- **Reglas por defecto que se vuelven obsoletas:** versión única; se edita a mano.
- Coordina con el SDD 4 de la iniciativa, que usará `defaultRules()` y `loadVoice`.

## 15. Preguntas para Fede y para la revisión técnica
1. ¿La voz la lee todo el equipo (es lo que decidiste: «solo equipo»), o prefieres que solo la vean Owner y Sales Leader? Eso exige otra política de lectura.
2. ¿Apruebas los textos de las nueve reglas por defecto del §9, o los ajustas?
3. ¿Se aplica 0081 antes de entregar esta SDD?
4. Para el gate: ¿es suficiente la convención de título para «Escalar» o prefieres una columna?

## 16. Pendiente de verificar
- Estado real de la migración 0081 en la base viva (producción o Lovable Cloud).
- Contenido exacto de las políticas de 0081 para copiar su patrón.
- Coste de añadir la voz al contexto de las llamadas de IA.
- Cuántos ejemplos de voz conviene leer y cuánto cortar cada uno.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: —
- [Por verificar] que sigue sin comprobarse: —
- Contradicciones con el código o con decisiones previas: —
- Lo que esta revisión NO demuestra: —

## 18. Delta de implementación (lo rellena el agente al entregar)
—
