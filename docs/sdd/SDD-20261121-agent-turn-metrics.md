# SDD-20261121-agent-turn-metrics · [Mejora] Medir cada turno del agente: cómo acaba, cuánto tarda y cuánto cuesta

**Tipo:** Mejora · **Prioridad propuesta:** Alta dentro de la iniciativa (es la condición del criterio de descarte del PRD: sin esta medición no se lanza el Inicio conversacional)
**Estado:** En curso desde el 2026-11-22 (construido en la rama `feat/agent-turn-metrics`, pendiente de revisión, gate y aprobación de entrega). Aprobado por Fede el 2026-11-22 (versión corregida tras la pasada 1 del gate; sin segunda revisión del gate) · **Pide:** Fede (2026-11-21) · **Aprueba:** Fede · **Fecha:** 2026-11-21
**PRD:** `docs/prd/PRD-20261121-inicio-conversacional.md` (Aprobado el 2026-11-21) · **Depende de:** —
**Ticket:** NK-0191 (LOGGED el 2026-11-22; bug derivado: NK-0192)
**Base de lectura:** `origin/main` @ `cc4a0cd2` (2026-11-21), solo lectura. Producción consultada el 2026-11-21 con consultas de esquema y de conteo.

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Nivel elegido: SDD completo de una mejora, porque añade una tabla con RLS y toca el turno del agente que comparten la app y Telegram.

## 1. Resumen
Cada turno del agente deja una fila con su canal, proveedor, modelo, duración, pasos, tokens, coste medido (o «desconocido», nunca estimado) y cómo acabó. Las llamadas a herramientas y las acciones propuestas de ese turno llevan el identificador del turno. Una función pura resume esas filas para poder aplicar el criterio de descarte del PRD. No cambia nada de lo que ve la persona.

## 2. Problema y para quién
Hoy no se sabe lo que cuesta ni cómo acaba una petición al agente (PRD, sección 3). Para Fede, que tiene que decidir a las dos semanas si el Inicio conversacional se queda (PRD, sección 9).

## 3. Evidencia y por qué ahora
- `runAgent` devuelve solo `{ text, pending }` y solo lee `result.text` de `streamText` (`src/lib/agent/agent.server.ts:90-201`, `:360`).
- Un turno que falla lanza un error tras guardar el mensaje de la persona; no queda rastro de que falló (`agent.server.ts:119-121`, `:163-179`). Hay fallos que ni pasan por ese `catch`: «La IA no está configurada» (`:107-108`), las lecturas previas (`:110-131`) y los guardados finales (`:188-194`).
- Solo dos sitios llaman a `runAgent`: la app (`src/lib/agent.functions.ts:129-137`) y Telegram (`src/routes/api/public/telegram/webhook.ts:238-246`). Ningún cron, trabajo ni MCP. Ninguno pasa señal de cancelación.
- Si el modelo no devuelve texto, la persona recibe un texto fijo: «No he podido generar respuesta.» (`agent.server.ts:181-184`).
- Existe traza por llamada a herramienta: `agent_tool_calls`, sin argumentos ni texto (`drizzle/migrations/0108_agent_tool_calls.sql`; `src/lib/agent/tool-trace.ts`). No tiene identificador de turno.
- Esa traza está vacía en producción (0 filas, medido el 2026-11-21) porque se añadió el 2026-11-18 (commit `fe53af38`) y el último mensaje al agente es del 2026-11-15. No es un fallo.
- Las acciones propuestas (`agent_pending_actions`) no llevan el turno que las propuso. También las insertan el piloto automático (`src/lib/autopilot.server.ts:57-65`) y la aprobación de sugerencias (`agent.functions.ts:474-480`), fuera de cualquier turno.
- El AI SDK instalado (`ai` 5.0.277, `@ai-sdk/openai` 2.0.135 según `bun.lock`) expone en el resultado de `streamText` el uso total, los pasos y el modelo. Los tokens son opcionales, y el total cuenta como 0 el paso sin dato. El SDK ya pide el uso al proveedor, pero **descarta el coste**: no llega por el uso ni por los metadatos del proveedor (leído en tipos y código compilado, no ejecutado).
- Hay un patrón para leer el coste de OpenRouter sin estimar: `usageOf` en `src/lib/ai-pinned.ts:81-98` (no exportada) y `usage: { include: true }` en `:65`.
- El libro de gasto distingue `measured`, `estimate` y `unknown`; «desconocido» es coste nulo, nunca cero (`drizzle/migrations/0102_integration_usage_ledger.sql`; `src/lib/AGENTS.md`).
- Cadena de proveedores (`src/lib/gemini.ts:44-55`): OpenRouter si hay clave, luego Gemini directo; con OpenRouter configurado la pasarela de Lovable solo entra con `AI_LOVABLE_FALLBACK=on`, y `AI_PROVIDER=lovable` la fuerza sola. **[Por verificar]** cuál responde en producción.
- Hay un atajo sin modelo solo en la app: las peticiones sobre el umbral del piloto se responden con una regla dentro del handler de `sendAgentMessage` (`agent.functions.ts:94-127`). En Telegram no existe.
- Líneas base medidas el 2026-11-21: 7 turnos, mediana de 3 s entre el mensaje y la respuesta guardada; coste: sin dato.

## 4. Resultado buscado
Cubre G-5 del PRD (coste y tiempo registrados por turno) y deja medibles G-2 y G-3. Tras entregarlo, cada turno nuevo tiene su fila; la línea base de coste deja de ser «sin dato» en cuanto haya un turno con un proveedor que lo informe.

## 5. Alcance
**Incluye:**
- Registro de un turno por cada mensaje a `sendAgentMessage` y por cada turno de Telegram, también los que fallan en cualquier punto, los rechazados por parecer un secreto, los que no generan texto y los que resuelve la regla del umbral.
- Coste medido cuando el proveedor lo informa; tokens cuando los informa.
- Identificador de turno en sus llamadas a herramientas y en sus acciones propuestas.
- Una función pura que resume turnos (resultado, tiempos, coste) y la consulta de solo lectura que la alimenta.

**No incluye:**
- Ninguna pantalla, panel, aviso ni herramienta del agente para ver estos datos.
- Topes, límites o bloqueos por coste.
- Estimar un coste a partir de tokens y tarifas.
- Guardar el texto de la petición, de la respuesta, argumentos, resultados o mensajes de error.
- El resultado «esto no lo hago aquí»: lo define el SDD 3 del PRD y se medirá por la traza de herramientas, sin añadir un valor a `outcome`.
- Medir las llamadas de asistentes externos por MCP, ni las acciones del piloto automático o de sugerencias: no son turnos.
- El gasto de un intento que falla antes de que responda otro proveedor (se cuenta el intento, no su coste).
- Cambiar de proveedor o de modelo, o el orden de la cadena.
- Mostrar el progreso de la respuesta (SDD 2 del PRD).
- Rellenar hacia atrás los 7 turnos anteriores.
- El título de la conversación guardado antes de la comprobación de secreto (hallazgo del gate; ticket aparte, sección 14).

## 6. Cambios de comportamiento (delta)
**Añadido:**
- Una fila por turno en una tabla nueva de turnos del agente.
- Columna de turno en la traza de herramientas y en las acciones propuestas.
- Módulo puro de resumen de turnos.

**Modificado:**
- Lectura del stream del agente: solo texto → también uso, pasos, modelo y, donde el proveedor lo envíe, coste.
- Turno fallido: no deja rastro → deja una fila con resultado «fallido», sin texto.
- La regla del umbral del piloto sale del handler a una función exportada, sin cambiar lo que responde.

**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Owner, quiero que cada petición al agente deje registrado cuánto tardó y cuánto costó, para decidir con datos.
- **CA-1** Un turno que responde deja exactamente una fila con canal, modo, proveedor que respondió, duración en milisegundos y número de pasos · cubre G-5 · prueba: `src/lib/agent/turn-record.test.ts`
- **CA-2** Si el proveedor informa del coste, la fila guarda ese importe en USD con clase `measured`; si no lo informa, el coste es nulo con clase `unknown`. Nunca se guarda un coste calculado a partir de tokens · cubre G-5 · prueba: `src/lib/agent/turn-record.test.ts`
- **CA-3** En un turno con varios pasos, los tokens y el coste son la suma de todos los pasos. Si a algún paso le falta el coste, el coste del turno es nulo con clase `unknown`; si a algún paso le faltan los tokens, los tokens del turno son nulos. Nunca una suma parcial · cubre G-5 · prueba: `src/lib/agent/turn-record.test.ts`
- **CA-4** Si un proveedor falla y responde el siguiente de la cadena, la fila nombra al que respondió y cuenta los intentos · cubre G-5 · prueba: `src/lib/agent/turn-record.test.ts`

### H-2: Como Owner, quiero saber cómo acabó cada petición, para medir cuántas se resuelven.
- **CA-5** El resultado del turno es uno de un conjunto cerrado, con este orden de prioridad: `failed` (no pudo responder, aunque antes hubiera propuesto algo), `refused` (el mensaje parecía un secreto y no se envió al modelo), `proposed` (propuso al menos un cambio), `empty` (el modelo no devolvió texto ni propuso nada y la persona recibió el texto fijo), `answered` (respondió sin proponer cambios) · cubre G-2 · prueba: `src/lib/agent/turn-record.test.ts`
- **CA-6** Un turno que falla en cualquier punto (sin IA configurada, lecturas previas, proveedor, guardados finales) deja su fila con `failed`, el proveedor del último intento o `none` si no llegó a ninguno, y el código HTTP del error o nulo si no lo hay. Ni la fila ni los logs llevan el texto del error · cubre G-2 · prueba: `src/lib/agent/turn-wiring.test.ts`
- **CA-7** Cada acción propuesta en un turno y cada llamada a herramienta de ese turno llevan el identificador del turno, y proponer una acción sigue funcionando aunque la fila del turno aún no exista · cubre G-2, G-3 · prueba: `src/lib/agent/turn-wiring.test.ts`
- **CA-8** El resumen de turnos devuelve, para un periodo: turnos por resultado; propuestas con identificador de turno confirmadas, descartadas, fallidas y sin decidir (las del piloto automático y de sugerencias no cuentan); mediana y percentil 90 de duración; coste medido total y cuántos turnos tienen coste desconocido. Con cero turnos devuelve «sin dato», no ceros · cubre G-2, G-3, G-5 · prueba: `src/lib/agent/turn-metrics.test.ts`

### H-3: Como persona que usa el agente, quiero que medir no me cambie nada.
- **CA-9** Si guardar la fila del turno falla, la persona recibe su respuesta igual y el error solo queda en el log, sin texto de cliente · cubre G-5 · prueba: `src/lib/agent/turn-wiring.test.ts`
- **CA-10** `runAgent` devuelve la respuesta sin esperar a que termine el guardado de la fila · cubre G-5 · prueba: `src/lib/agent/turn-wiring.test.ts`
- **CA-11** La fila del turno no contiene el texto de la petición ni de la respuesta, ni argumentos, resultados o mensajes de error; sus columnas son las de la sección 10 y ninguna más · cubre G-5 · prueba: `src/lib/agent-turns.pg.test.ts`
- **CA-12** Una persona solo lee sus propios turnos, y solo de empresas de las que es miembro; una persona de otra empresa no lee ninguno; `anon` no tiene ningún permiso sobre la tabla · cubre G-5 · prueba: `src/lib/agent-turns.pg.test.ts`
- **CA-13** La petición que resuelve la regla del umbral del piloto deja fila con proveedor `none`, tokens nulos y coste 0 con clase `measured` · cubre G-5 · prueba: `src/lib/agent/turn-wiring.test.ts`
- **CA-14** Un turno de `runAgent` con canal `telegram` deja fila con ese canal, con el mismo contenido que uno de la app · cubre G-5 · prueba: `src/lib/agent/turn-wiring.test.ts`
- **CA-15** Las pruebas existentes del agente, que simulan el stream solo con texto, siguen pasando sin tocar sus aserciones: si faltan uso o pasos, la fila los guarda nulos · cubre G-5 · prueba: `src/lib/agent/agent-rules.test.ts` (existente)

## 8. Casos límite y errores
- **Proveedor que no informa de tokens o de coste:** nulos, no cero (CA-2, CA-3).
- **Turno fallido:** pasos y tokens nulos si no se llegaron a conocer (CA-6).
- **Turno que el entorno corta antes de terminar** (límite de tiempo): no deja fila, porque se guarda al final. Los fallidos pueden contarse de menos; el resumen lo declara como límite.
- **Guardado de la fila falla** (red, RLS, tabla ausente porque la migración aún no está aplicada): el turno sigue (CA-9). Permite fusionar el código antes de aplicar la migración.
- **Doble envío:** dos mensajes son dos turnos; no hay deduplicación.
- **Cambio de empresa a mitad de turno:** la fila lleva la empresa del contexto con que empezó.
- **Acción propuesta fuera de un turno** (piloto automático, aprobación de una sugerencia, MCP): su columna de turno queda nula y no entra en el resumen (CA-8).
- **Regla del umbral:** es un turno de la app sin modelo y sí deja fila (CA-13); la acción que propone lleva su identificador de turno.
- **Otra empresa:** RLS por persona y pertenencia (CA-12).

## 9. Experiencia y copy
No aplica: no hay ningún cambio visible ni texto nuevo.

## 10. Datos, permisos y privacidad
**Tabla nueva `agent_turns`** (migración `0109`, aditiva):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid, clave | lo genera el servidor al empezar el turno |
| `org_id` | uuid, no nulo | referencia a `organizations`, borrado en cascada; el código lo inserta explícito (Telegram usa el cliente privilegiado) |
| `user_id` | uuid, no nulo | |
| `conversation_id` | uuid | referencia a `agent_conversations`, borrado en cascada |
| `channel` | texto, no nulo | `CHECK`: `app`, `telegram` |
| `mode` | texto, no nulo | `CHECK`: `chat`, `interview` |
| `provider` | texto, no nulo | `CHECK`: `openrouter`, `gemini`, `lovable`, `none` |
| `model` | texto | el que informa el proveedor, recortado a 200 caracteres; nulo si no lo informa |
| `attempts` | entero, no nulo | proveedores intentados; 0 si no se llegó a ninguno |
| `steps` | entero | nulo si no se conoce |
| `duration_ms` | entero, no nulo | del inicio del turno a la respuesta o al fallo |
| `input_tokens`, `output_tokens` | entero | nulos si no se informan o si falta algún paso |
| `cost_usd` | numérico | nulo si no se informa |
| `cost_kind` | texto, no nulo | `CHECK`: `measured`, `unknown` (vocabulario del libro de gasto; aquí no existe `estimate`) |
| `outcome` | texto, no nulo | `CHECK`: `answered`, `proposed`, `empty`, `failed`, `refused` |
| `error_status` | entero | solo en `failed`; nulo si el error no trae código HTTP |
| `proposed_count` | entero, no nulo | acciones propuestas en el turno |
| `created_at` | fecha y hora, no nula | |

- **Índices:** `(org_id, created_at desc)` y `(conversation_id)`, como en la 0108.
- **Columnas nuevas:** `turn_id uuid` nulo en `agent_tool_calls` y en `agent_pending_actions`, **sin clave foránea** y con índice. Motivo: la acción se inserta durante el turno y la fila del turno al final; una referencia rechazaría el insert y rompería toda herramienta de escritura.
- **RLS y permisos:** `SELECT` e `INSERT` para `authenticated` con `user_id = auth.uid() AND is_org_member(org_id)`; todo para `service_role`; sin `UPDATE` ni `DELETE` para personas. La migración **revoca de forma explícita** todo a `anon` (la 0108 no lo hace y los permisos por defecto se lo conceden).
- **Coste cero en la regla del umbral (decisión explícita):** `measured` con 0 porque se sabe que no hubo llamada. No contradice «desconocido es nulo, nunca cero»: aquí el dato se conoce.
- **Moneda:** el coste de IA va en USD y no se suma al límite en EUR ni a otros costes.
- **Privacidad:** `model` es el único texto que viene de fuera, es un identificador del proveedor y va recortado. Ninguna columna de texto libre de personas. Los logs de fallo usan `safeErrorLog`.
- **Catálogo de campos:** las columnas nuevas se enlazan en `src/lib/field-catalog.ts` reutilizando los conceptos que ya existen (`coste_ia_usd`, `tokens_ia`, `proveedor_ia`, `duracion_ms`); `turn_id` se cataloga, no va a la línea base; cada concepto nuevo necesita su entrada en `SHOWN_IN`.
- **Tipos generados:** `src/integrations/supabase/types.ts` se edita en el mismo commit que la migración, como hizo `fe53af38`. **[Por verificar]** si Lovable lo regenera o lo pisa después.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna nueva | — | — | — |

La llamada existente del agente no cambia de modelo ni de esfuerzo. Para leer el coste de OpenRouter hay que pedírselo en la petición. **[Por verificar]** con una llamada real que eso no cambia el precio ni la respuesta.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Módulo puro que convierte el resultado de un turno (pasos, uso, intentos, error) en la fila: prioridad de resultados, suma sin parciales y coste nunca estimado | CA-1 a CA-5 | `src/lib/agent/turn-record.test.ts` |
| U-2 | Migración `0109`: tabla, `CHECK`, índices, columnas `turn_id`, RLS, revocación a `anon`, tipos y catálogo de campos | CA-11, CA-12 | `src/lib/agent-turns.pg.test.ts` |
| U-3 | Cableado en `runAgent`: identificador de turno, envoltura del turno entero para los fallos, lectura de uso y coste, guardado sin esperar, turno en traza y acciones | CA-6, CA-7, CA-9, CA-10, CA-14, CA-15 | `src/lib/agent/turn-wiring.test.ts` |
| U-4 | Regla del umbral extraída a una función exportada, con su fila de turno | CA-13 | `src/lib/agent/turn-wiring.test.ts` |
| U-5 | Módulo puro de resumen y consulta de solo lectura documentada en `src/lib/AGENTS.md` | CA-8 | `src/lib/agent/turn-metrics.test.ts` |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Uso, pasos y modelo:** `totalUsage`, `steps` y `response` del resultado de `streamText`. Como `totalUsage` cuenta 0 el paso sin dato, la suma sin parciales de CA-3 se hace recorriendo `steps`, no leyendo el total.
- **Coste en OpenRouter:** no llega por el uso ni por los metadatos, porque el esquema del proveedor en el SDK lo descarta. Vía recomendada por el gate: `includeRawChunks: true` y `onChunk` de tipo `raw`, sin envolver el `fetch`. El envoltorio de `fetch` que ya existe (`agent.server.ts:305-315`) sirve para añadir `usage: { include: true }` al cuerpo. La regla de qué campo es el coste es la de `usageOf` (`ai-pinned.ts:81-98`): hay que exportarla y reutilizarla, no escribir otra. **[Por verificar]** en ejecución.
- **Gemini directo y pasarela de Lovable:** tokens si los informan, coste nulo y `unknown`. No se añade tabla de tarifas.
- **Guardado:** `afterResponse`, como la traza y la memoria; un solo `insert`.
- **Fallos:** envolver el turno entero, no solo el bucle de proveedores, para cubrir los caminos de la sección 3.
- **Pruebas de base de datos:** el test crea `agent_conversations` y `agent_pending_actions`, que el arnés no trae, como hace `src/lib/autopilot-threshold.pg.test.ts:16-20`.
- **Telegram:** `agentReply` no se exporta y ningún test ejercita el webhook; por eso CA-14 se prueba en `runAgent`.
- **Alternativa descartada:** columnas de coste en `agent_messages`. Mezcla contenido con medición y no cubre los turnos fallidos.
- **Alternativa descartada:** usar `integration_usage`. Su límite es en EUR; el coste de IA en USD lo marcaría como presupuesto incompleto.

## 14. Riesgos y dependencias
- **Sin entorno de pruebas:** la migración se aplica en producción. Es solo aditiva y el código tolera que falte la tabla.
- **Coste no disponible:** si en producción responde Gemini directo o la pasarela, todos los turnos saldrán con coste `unknown`. Lo mismo pasa con cualquier turno en que OpenRouter falle y responda otro. En ese caso se activa el criterio «si el coste por turno no se puede registrar, no se lanza» del PRD y decide Fede (pregunta 1).
- **Leer el coste del stream** añade una pieza en el camino de la respuesta. Debe fallar hacia «coste desconocido», nunca hacia un turno roto.
- **Fallidos contados de menos:** un turno cortado por el entorno no deja fila.
- **Filas insertables por la propia persona:** como en `agent_tool_calls`. Es dato de diagnóstico, no de facturación.
- **Permisos en producción:** `agent_tool_calls` tiene permisos para `anon` que su migración no concede (leído el 2026-11-21). RLS protege porque no hay política para `anon`. Corregirlo en esa tabla queda fuera de este SDD.
- **Hallazgo del gate, fuera de alcance:** en una conversación nueva de la app, el título guarda los primeros 80 caracteres del mensaje antes de la comprobación de secreto (`agent.functions.ts:87` frente a `agent.server.ts:104-105`), lo que contradice «No he guardado ese mensaje». Merece ticket propio.
- **Journal de migraciones:** `0109` va al final, con `when` mayor que el de `0108` (`1794873481331`); si `main` gana otra migración antes de fusionar, se re-sella.
- **SDD 3:** si al final «esto no lo hago aquí» necesitara un valor propio en `outcome`, hará falta otra migración.

## 15. Preguntas para Fede y para la revisión técnica
**Para Fede** (con mi recomendación)
1. **Si en producción no responde OpenRouter, el coste saldrá siempre «desconocido». ¿Qué hacemos entonces?** *Recomiendo: lanzar la medición igual y decidir con el primer turno real, que dirá qué proveedor responde.* Porque cambiar de proveedor para poder medir es una decisión de coste y calidad que no toca tomar a ciegas. ¿Sabes si la clave de OpenRouter está configurada en Lovable Cloud?
2. **¿Quieres ver estos datos en alguna pantalla?** *Recomiendo: no ahora; a las dos semanas los saco con la consulta de solo lectura.* Porque eres el único usuario y una pantalla es alcance que no ayuda a decidir.
3. **¿Quién lo construye: la factory de Claude o Lovable directo en `main`?** *Recomiendo: la factory, con rama y gate.* Porque toca el turno del agente y una migración con RLS.
4. **¿Abro ticket para el título que se guarda antes de la comprobación de secreto?** *Recomiendo: sí, como bug aparte.* Porque es una promesa al usuario que hoy no se cumple y no tiene que ver con medir.

**Decisiones de Fede (2026-11-22, «Apruebo el SDD», con las cuatro recomendaciones):** 1) se lanza la medición y se decide con el primer turno real qué hacer si el coste sale «desconocido»; 2) sin pantalla por ahora; 3) lo construye la factory, con rama y gate; 4) el título guardado antes de la comprobación de secreto va como bug aparte. Aprobar el SDD habilita `nokko-brief`; no autoriza construir ni aplicar la migración sin orden expresa.

**Para la revisión técnica**
5. ¿El stream de OpenRouter trae `cost` e `is_byok` en una petición con herramientas hecha por el SDK?
6. ¿Hace falta que los líderes lean los turnos de su equipo, o basta con los propios mientras haya un solo usuario?

## 16. Pendiente de verificar
- Qué proveedor y modelo responden en producción (Fede, o el primer turno tras entregar).
- Que pedir el coste a OpenRouter no cambia precio ni respuesta, y que llega por los fragmentos en bruto del SDK (una llamada real, que gasta).
- Si Gemini directo y la pasarela de Lovable informan de tokens (una llamada real).
- Si Lovable regenera o pisa `types.ts` tras un cambio manual (Fede o Lovable).
- Permisos efectivos de la tabla nueva en producción tras aplicar la migración (consulta de solo lectura).
- Qué hace el entorno publicado con el trabajo pendiente cuando un turno se corta o agota el tiempo.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Pasada 1, 2026-11-22, sobre la primera versión de este borrador. Informe copiado sin editar. Las correcciones que provocó están en las secciones 3 a 16; **la versión corregida no ha pasado una segunda revisión**.

- Veredicto del gate: **Objeciones**

- CA sin prueba posible o sin G-n:
  - **G-n:** ninguno falta. Todos los CA citan G-2, G-3 o G-5, que existen (`docs/prd/PRD-20261121-inicio-conversacional.md:74-77`). Comprobado.
  - **CA-7:** no puede pasar con la sección 10 tal como está. La acción propuesta se inserta durante el stream (`src/lib/agent/agent.server.ts:239-250`) y la fila del turno se guarda al final, así que una clave foránea rechaza el insert y `runTool` devuelve `{ error }` (`:251`). Comprobado el orden. La variante «diferible» de la sección 13 tampoco sirve porque cada llamada del cliente es su propia transacción (inferencia). Solo es probable sin clave foránea, que es lo que recomienda la sección 13 y contradice la 10.
  - **CA-13:** sin prueba con los patrones actuales. La regla del umbral vive dentro del handler de `createServerFn` (`src/lib/agent.functions.ts:94-127`) y los tests sustituyen `createServerFn` por un proxy (`src/lib/agent/agent-rules.test.ts:50-53`). Ningún test invoca `sendAgentMessage`. Comprobado. Exige extraer la rama a una función exportada, y el SDD no lo dice.
  - **CA-14:** solo probable a nivel de `runAgent` con `channel: "telegram"`. `agentReply` no se exporta (`src/routes/api/public/telegram/webhook.ts:217`) y ningún test ejercita el webhook. Comprobado.
  - **CA-10:** no es observable como está redactado. `afterResponse` arranca el trabajo de inmediato y solo evita esperarlo (`src/lib/after-response.server.ts:12-14`). Lo comprobable es «`runAgent` no espera al insert». En Telegram la respuesta a la persona es el `sendText` posterior (`webhook.ts:250`). Comprobado.
  - **CA-3:** falta la regla para tokens parciales. `totalUsage` del SDK cuenta como 0 el paso sin dato (`ai/dist/index.mjs:1745-1747`, leído en un worktree hermano). Daría una suma parcial sin avisar, justo lo que el CA prohíbe para el coste. Comprobado.
  - **CA-5:** el conjunto cerrado no dice qué gana en dos casos comprobados. Uno: el turno falla después de proponer (`agent.server.ts:170`, `:177-178`), con `failed` y `proposed_count > 0`. Dos: el modelo no devuelve texto y se responde «No he podido generar respuesta.» (`:181-184`), que hoy sería `answered` e infla G-2.
  - **CA-6 y sección 8 («abortado: `failed` con código 0»):** no alcanzable. Ningún llamador pasa `signal` (`agent.functions.ts:129-137`, `webhook.ts:240-246`). Comprobado. Además el código 0 ya significa «error sin estado HTTP» (`agent.server.ts:165`), así que no distingue nada.
  - **CA-12 («nada para `anon`»):** solo pasa si la migración revoca de forma explícita. El harness imita los permisos por defecto de Supabase (`src/test/pg-harness.ts:38-41`) y la 0108, que el SDD toma de modelo, no revoca (`drizzle/migrations/0108_agent_tool_calls.sql:18-19`). Comprobado.
  - **CA-1, CA-2, CA-4, CA-8, CA-9, CA-11:** tienen prueba posible con los patrones de `src/lib/agent/tool-trace.test.ts` y `src/test/pg-harness.ts`. El test de base de datos debe crear `agent_conversations` y `agent_pending_actions`, que el harness no trae, como hace `src/lib/autopilot-threshold.pg.test.ts:16-20`.

- [Por verificar] que sigue sin comprobarse:
  - Qué proveedor y modelo responden en producción. No consultado.
  - Las cifras de producción de la sección 3 y de la 14 (0 filas de traza, 7 turnos, mediana de 3 s, permisos de `anon`). No consultadas.
  - Que `usage: { include: true }` no cambia precio ni respuesta, y que el último fragmento de OpenRouter trae `cost` e `is_byok` con herramientas (pregunta 4). Necesita una llamada real.
  - Si Gemini directo (tras `fixGeminiStream`) y la pasarela de Lovable informan de tokens. Necesita una llamada real.
  - **Nombres del AI SDK: resuelto, con una salvedad.** Este worktree no tiene `node_modules` y no lo instalé. Leí `seller-strategy-studio-pr161/node_modules`, con las mismas versiones que fija `bun.lock:112,920` (`ai` 5.0.277, `@ai-sdk/openai` 2.0.135). El resultado de `streamText` expone `totalUsage`, `usage` (último paso), `steps` y `response` con el modelo (`ai/dist/index.d.ts:2091-2140`). El uso trae `inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens` y `cachedInputTokens`, todos opcionales (`@ai-sdk/provider/dist/index.d.ts:1116-1139`).
  - **Tipos de Supabase: resuelto a medias.** El precedente es editarlo a mano en el mismo commit (`fe53af38` tocó `src/integrations/supabase/types.ts`, 57 líneas). Sigue sin comprobar si Lovable lo regenera o lo pisa después.
  - Permisos efectivos de la tabla nueva en producción tras aplicar la migración.

- Contradicciones con el código o con decisiones previas:
  - **Sección 10 contra sección 13 (interna, bloquea el brief):** la 10 pide `turn_id` con referencia a `agent_turns`; la 13 recomienda no ponerla. Con referencia, toda herramienta de escritura falla (ver CA-7).
  - **Sección 13, «hay que observar el stream»:** incompleto. El coste no llega por `usage`, `totalUsage` ni `providerMetadata`, porque el esquema del proveedor descarta `cost`, `is_byok` y `cost_details` (`@ai-sdk/openai/dist/index.mjs:498-511`, `:1083-1100`). Sí puede llegar por el SDK con `includeRawChunks: true` y `onChunk` de tipo `raw` (`index.mjs:1059-1061`; `ai/dist/index.d.ts:1272-1276`, `:1428`), sin envolver el `fetch`. Comprobado en tipos y código, no en ejecución.
  - **Secciones 6 y 11, «sin datos de uso → los pide»:** el SDK ya envía `stream_options.include_usage` (`index.mjs:1019-1021`). Lo nuevo sería solo el coste. Comprobado.
  - **Sección 13, «el `catch` de `runAgent` ya tiene proveedor y estado»:** no cubre todos los fallos. Quedan fuera «La IA no está configurada» (`agent.server.ts:107-108`), las lecturas previas (`:110-131`), los guardados finales (`:188-194`) y, en `sendAgentMessage`, los errores de la rama del umbral (`agent.functions.ts:100-108`, `:117`, `:125`). «También los que fallan» exige envolver el turno entero y fijar `provider = none` en esos casos. Comprobado.
  - **Sección 10, columnas que no se pueden rellenar con verdad:** en un turno fallido `steps` y `totalUsage` se rechazan con el stream, y `steps` no nulo obligaría a guardar un 0 falso (inferencia sobre el SDK). Un turno que el runtime corta no deja fila, porque se inserta al final; los fallidos se contarán de menos (inferencia).
  - **Sección 10, «ninguna columna de texto libre»:** `model` es texto que dicta el proveedor, sin lista cerrada ni límite. La sección tampoco declara los `CHECK` de los conjuntos cerrados ni ningún índice, que la 0108 sí tiene (`0108:8-17`).
  - **CA-13 contra la regla del libro de gasto:** «coste cero medido» sin llamada choca con «desconocido es nulo, nunca cero» (`src/lib/AGENTS.md:74`). Es defendible, pero hay que decidirlo de forma explícita. Inferencia.
  - **Sección 8, acciones fuera de un turno:** omite el piloto automático (`src/lib/autopilot.server.ts:57-65`, `source: "autopilot"`, confirmadas solas). La aprobación de sugerencias inserta con el `source` por defecto `'agent'` (`agent.functions.ts:474-480`; `drizzle/migrations/0011_agent_channel_mcp.sql:3`). El resumen de CA-8 debe contar solo acciones con `turn_id`, o G-3 mezclará propuestas que no son del agente. Comprobado.
  - **Sección 8, «regla del umbral cuando no hay turno»:** contradice CA-13, que le da fila. En Telegram esa regla no existe y todo pasa por `runAgent` (`webhook.ts:209`, `:238`). Comprobado.
  - **Sección 3, cadena de proveedores:** simplificada. Con OpenRouter configurado la pasarela de Lovable no entra salvo `AI_LOVABLE_FALLBACK=on`, y `AI_PROVIDER=lovable` la fuerza sola (`src/lib/gemini.ts:44-55`). Si hay reintento, quien responde nunca es OpenRouter, así que ese turno sale `unknown` y el gasto del intento fallido se pierde. Comprobado.
  - **Catálogo de campos:** `field-coverage.test.ts` lee `types.ts` (`src/lib/field-coverage.test.ts:9-10`), así que solo obliga si `types.ts` se edita en el mismo commit. `agent_pending_actions.turn_id` debe catalogarse, no ir a la línea base (`src/lib/field-baseline.ts:2`, `:17-18`). Cada concepto nuevo necesita un archivo en `SHOWN_IN` (`field-coverage.test.ts:83-90`). Ya existen `coste_ia_usd`, `tokens_ia`, `proveedor_ia` y `duracion_ms` (`src/lib/field-catalog.ts:235`, `:329`, `:606`, `:614`). Comprobado.
  - **Citas con línea desviada (el contenido existe):** `ai-pinned.ts:60` es `:65`; `usageOf` está en `:81-98` y no se exporta; `agent.functions.ts:93-126` es `:94-127`. Las demás citas de las secciones 3 y 13 coinciden, incluidas `agent.server.ts:90-201`, `:119-121`, `:163-179`, `:305-315`, `:360`, el `when` de la 0108 (`_journal.json`, `1794873481331`) y la fecha de `fe53af38`.
  - **Tests existentes:** simulan `streamText` como `{ text }` (`agent-rules.test.ts:19-27`). El código nuevo debe tolerar que falten `steps` y `totalUsage`, o habrá que tocar esos tests bajo el guard de aserciones (`scripts/factory/gate.mjs:124-131`). Inferencia.
  - **Fuera de alcance, pero toca a `refused`:** en una conversación nueva de la app, el título guarda los primeros 80 caracteres antes de la comprobación de secreto (`agent.functions.ts:87` frente a `agent.server.ts:104-105`). Contradice «No he guardado ese mensaje» (`src/lib/agent/secret-guard.ts:22`). Comprobado; merece ticket aparte.
  - **Sin contradicción encontrada:** llamadores de `runAgent` (solo la app y Telegram; ningún cron, job ni MCP), journal (0109 al final), guards de `gate.mjs` y privacidad de logs con `safeErrorLog`.

- Lo que esta revisión NO demuestra:
  - No se ejecutó nada: ni tests, ni typecheck, ni build, ni `scripts/factory/gate.mjs`, ni la app.
  - No se consultó producción ni se llamó a ningún proveedor. Todo lo que el SDD dice de producción y del contenido real del stream de OpenRouter, Gemini o Lovable sigue sin verificar.
  - Lo del AI SDK sale de leer tipos y código compilado en un worktree hermano con las versiones del lockfile, no de este worktree ni de una ejecución.
  - No se probó que la migración 0109 aplique ni que su RLS aísle. Es revisión de diseño; no existe SQL que revisar.
  - No se revisó el PRD en sí, ni el encaje con los SDD 2 a 4 más allá de que `outcome` cerrado a cuatro valores obligará a otra migración para «esto no lo hago aquí».
  - No se comprobó cómo se comporta el `waitUntil` del runtime publicado cuando el turno se corta o agota el tiempo.
  - `src/lib/AGENTS.md` y `.claude/agents/nokko-gate.md` se leyeron parcialmente (la salida se truncó); las reglas citadas se comprobaron por búsqueda.

## 18. Delta de implementación (lo rellena el agente al entregar)
Entregado el 2026-11-22 en la rama `feat/agent-turn-metrics` (U-1 a U-5). Lo que difiere del texto de arriba o lo concreta:

- **Coste 0 `measured` solo en la regla del umbral.** Un turno rechazado por parecer un secreto y un turno que falla antes de llegar a ningún proveedor tampoco llaman a un modelo, pero el SDD solo decide el cero para la regla del umbral (sección 10). Esos turnos guardan coste nulo y `unknown`, así que el resumen los cuenta como «coste desconocido». **Pregunta abierta para Fede:** ¿deben contar como 0 medido?
- **Tokens de entrada y de salida se evalúan por separado.** Si a un paso le falta solo uno de los dos, se vacía ese total y el otro se suma entero. Nunca hay suma parcial (CA-3).
- **Coste por paso.** Se guarda una entrada por cada fragmento en bruto que trae `usage`; solo se emparejan con los pasos si hay exactamente una por paso. Si no cuadra, el coste del turno es `unknown`. Solo se piden fragmentos en bruto a OpenRouter; Gemini y la pasarela no cambian.
- **`usage: { include: true }` va en todas las peticiones del agente a OpenRouter.** Sigue [Por verificar] con una llamada real que no cambia precio ni respuesta (sección 16).
- **`model`** sale de `response.modelId` del AI SDK. Si el proveedor no informa del modelo, el SDK deja ahí el identificador que se pidió, así que la columna puede traer el modelo pedido y no el que respondió. No se ha podido distinguir sin una llamada real.
- **`error_status`** solo guarda un entero de 100 en adelante y solo en `failed`; el 0 que el código usa para «sin estado» se guarda como nulo.
- **Migración 0109, más estricta que la tabla de la sección 10:** `CHECK` de no negativos, `model` de 200 caracteres como máximo, y `cost_kind = 'measured'` si y solo si `cost_usd` no es nulo. Revoca todo a `anon` **y a `authenticated`** antes de conceder `SELECT` e `INSERT`, para que los permisos por defecto no dejen `UPDATE` ni `DELETE`.
- **`turn_id` en la traza** solo se envía cuando hay turno; las llamadas por MCP no lo mandan y la columna queda nula.
- **Catálogo de campos:** además de los cuatro conceptos reutilizados (más `calidad_coste`, `clave_registro`, `clave_empresa`, `clave_usuario` y `alta_sistema`), hicieron falta ocho conceptos nuevos: `canal_turno`, `modo_turno`, `modelo_ia`, `intentos_turno`, `pasos_turno`, `resultado_turno`, `estado_http_error` y `propuestas_turno`.
- **Regla del umbral:** vive en `autopilotChatTurn` (`src/lib/agent.functions.ts`). Si la regla lanza un error (rol sin permiso, otra moneda, fallo al guardar), deja fila `failed` con proveedor `none`.
- **Resumen (`summarizeTurns`):** cuenta las propuestas de los turnos del periodo (por `turn_id`), declara el límite de los turnos cortados en `limits` y devuelve el coste medido total como nulo si ningún turno tiene coste medido. No se añadió función de lectura: la consulta está documentada en `src/lib/AGENTS.md` y nada de la app la llama.
- **Sección 16:** ningún [Por verificar] se ha podido comprobar; todos necesitan producción o una llamada real a un proveedor, que no están autorizadas. La migración solo se ha probado en PGlite.
