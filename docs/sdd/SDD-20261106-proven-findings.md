# SDD-20261106-proven-findings · [Mejora] «Lo comprobado»: patrones de pérdida y experimentos cerrados, legibles por el agente

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador (decisiones de Fede cerradas el 2026-11-06, ver sección 15; falta su aprobación para ejecutar) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**Coordinado con:** `SDD-20261106-plays-library-core` (comparte el registro de herramientas, `TITLES` y el manifest; se ejecuta después de fusionarlo; no es un play del catálogo). **PRD:** No aplica (mejora acotada: sin tabla, sin migración, sin permisos nuevos). · **Depende de:** — (independiente de `SDD-20261106-signal-freshness`)

> Nivel elegido: SDD corto. Las secciones que no cambian el resultado van como «No aplica».

## 1. Resumen
Nokko ya recoge dos fuentes de aprendizaje que nadie lee en conjunto: los motivos de pérdida de los deals y los experimentos cerrados con su aprendizaje. Se añade una regla pura que las convierte en «hallazgos» con nivel de evidencia (el que ya existe), y una herramienta de lectura para que el agente (y MCP) responda «¿qué sabemos que funciona o no?» sin calcular nada. **No se crea ninguna tabla de aprendizajes**: duplicaría `gtm_experiments`, `memories` y las decisiones estratégicas.

## 2. Problema y para quién
El vendedor o el responsable comercial pregunta al agente por qué se pierde o qué se probó, y el agente no tiene dónde mirarlo: `lossBreakdown` existe y solo lo usa su test, y no hay herramienta que lea experimentos. El conocimiento queda encerrado en pantallas.

## 3. Evidencia y por qué ahora
- `lossBreakdown` calcula el desglose de pérdidas (`src/lib/loss-reasons.ts:104-143`) y no tiene consumidores salvo su test (búsqueda en el repo a HEAD 47ec72c).
- El detector de pérdidas repetidas usa `MIN_LOSSES = 3` (`src/lib/proactive/detectors/strategy-losses.ts:7`) y `sample_size: lost.length`. Esa constante vive en el detector, no en la regla de pérdidas.
- La regla de nivel de evidencia ya existe: `evidenceLevel` (`src/lib/strategy-suggestions.ts:52`, menos de 5 bajo, 5 a 9 medio, 10 o más alto), `EVIDENCE_LEVEL_RULE` (:55), `levelLabel` (:56) y `evidenceLink` (:96, enlaza `gtm_experiments` a `/theory-u`).
- `gtm_experiments` tiene estados idea, running, learned, adopted, discarded y RLS por miembro de la empresa (`drizzle/migrations/0003_theory_u.sql:52-95`). Los motivos de pérdida están en `deals` desde la migración 0068.
- `list_deals` es de toda la empresa y no filtra por rol (`src/lib/agent/tools/core-read.ts:107`), así que una lectura agregada sin roles no abre datos nuevos.
- El agente recibe la memoria con tope de 3500 caracteres (`src/lib/memory.ts:49`, `src/lib/agent/agent.server.ts:60`), y el prompt del sistema está en `agent.server.ts:30-50`: no hay hueco para volcar hallazgos en cada turno.
- Inspiración: la «intelligence store» de Frontal (observado → validado → comprobado o refutado, repo GTM OS, MIT). En Nokko ese ciclo ya existe a medias en experimentos; lo que falta es leerlo. Frontal mide respuestas de correos enviados; Nokko no tiene métricas de envío, así que **no** se copia esa parte.
- Sin dato de uso real. **[Por verificar]** cuántos deals perdidos y experimentos cerrados hay hoy en producción.

## 4. Resultado buscado
- El agente responde preguntas sobre pérdidas y experimentos con la salida de la herramienta, sin cifras propias. Verificable con casos de `nokko-walkthrough`.
- Ningún hallazgo sin su nivel de evidencia ni su tamaño de muestra visible.
- Uso: número de llamadas a la herramienta por semana. Línea base: sin dato.

## 5. Alcance
**Incluye:** módulo puro de hallazgos; mover `MIN_LOSSES` a la regla de pérdidas; herramienta de lectura `get_proven_findings` (con título y manifest MCP); una línea en el prompt del agente que la nombra.
**No incluye (copiar a «Movimientos prohibidos» del brief):** tabla, columna o migración; cambios en `memories`; inyectar hallazgos en cada turno; usar hallazgos en `draft_followup`, brief de reunión, playbooks, informe semanal o revisión estratégica (siguiente paso, otro SDD); métricas de envío; marcar experimentos como «comprobados» automáticamente.

## 6. Cambios de comportamiento (delta)
**Añadido:** `src/lib/proven-findings.ts` y su test; herramienta `get_proven_findings`; una frase en el prompt del agente.
**Modificado:** `MIN_LOSSES` pasa de `strategy-losses.ts` a `loss-reasons.ts`; el detector lo importa (mismo valor, 3, mismo comportamiento).
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como responsable comercial, quiero preguntar al agente por qué perdemos y recibir un patrón con su nivel de evidencia.
- **CA-1** `provenFindings` agrupa los deals perdidos por motivo con `lossBreakdown` y devuelve un hallazgo por motivo con al menos `MIN_LOSSES` deals, con `muestra` (deals con ese motivo) y `nivel` calculado con `evidenceLevel` sobre el **total de perdidos**. · prueba: `src/lib/proven-findings.test.ts`
- **CA-2** Los deals perdidos sin motivo se cuentan como «sin dato» y no entran en ningún hallazgo; el resultado informa cuántos son. · prueba: `src/lib/proven-findings.test.ts`
- **CA-3** Si la empresa tiene menos de `MIN_LOSSES` deals perdidos, la lectura dice que aún no hay patrón y no devuelve hallazgos de pérdida. · prueba: `src/lib/proven-findings.test.ts`
- **CA-4** Un competidor nombrado en al menos `MIN_LOSSES` pérdidas genera un hallazgo propio; mismo nombre con otra capitalización o espacios cuenta una vez (regla de `lossBreakdown`). · prueba: `src/lib/proven-findings.test.ts`

### H-2: Como responsable comercial, quiero que lo aprendido en experimentos cerrados aparezca junto a las pérdidas.
- **CA-5** Los experimentos en estado learned, adopted o discarded **con aprendizaje escrito** (no vacío) se devuelven como hallazgos de tipo experimento, con estado, aprendizaje y enlace por `evidenceLink`. Sin nivel de evidencia (no hay muestra definida). Los idea y running no entran. · prueba: `src/lib/proven-findings.test.ts`
- **CA-6** Los experimentos discarded se muestran como «descartado»: lo refutado también es conocimiento y evita repetirlo. · prueba: `src/lib/proven-findings.test.ts`
- **CA-7** Máximo 10 hallazgos de cada tipo, los de mayor muestra o más recientes primero. · prueba: `src/lib/proven-findings.test.ts`

### H-3: Como persona que habla con el agente, quiero que me conteste con lo que Nokko sabe, sin que invente ni calcule.
- **CA-8** `get_proven_findings` es de lectura, filtra por la empresa del llamante (también con el cliente privilegiado de Telegram o cron) y devuelve `lectura` (español, conclusión primero), `hallazgos`, `no_cuenta` (cuántos perdidos sin motivo, experimentos sin aprendizaje) y `regla_nivel` (texto de `EVIDENCE_LEVEL_RULE`). · prueba: `src/lib/agent-tools.test.ts`
- **CA-9** Título en `TITLES`, espejo en `.lovable/mcp/manifest.json` y marca de solo lectura. · prueba: estructura del manifest en `src/lib/agent-tools.test.ts`
- **CA-10** El prompt del agente incluye una línea (máximo 200 caracteres, compartida con la de `frontal-rules-integration` CA-18: en el prompt hay una sola línea nueva por SDD y el test de herramientas nombradas las cubre todas) que dice cuándo usar la herramienta («qué hemos aprendido», «por qué perdemos», «qué probamos»), y un test comprueba que cada herramienta nombrada en el prompt existe en el registro. · prueba: `src/lib/agent-tools.test.ts`

## 8. Casos límite y errores
- Empresa sin deals ni experimentos: `lectura` = «Aún no hay pérdidas ni experimentos cerrados con aprendizaje para sacar conclusiones.»
- Deals perdidos con detalle libre: el texto libre **no** se devuelve (privacidad; puede nombrar personas).
- Experimento con aprendizaje en blanco: no es hallazgo; cuenta en `no_cuenta`.
- Motivo «Otro»: se muestra como «Otro» con su muestra, sin interpretarlo.
- Fallo de lectura: error claro en español, sin romper el turno del agente.

## 9. Experiencia y copy
La herramienta devuelve la frase; el agente la transmite. Ejemplos con datos ficticios:
- «Con 12 deals perdidos, el motivo más repetido es Precio (5): evidencia media. 4 pérdidas no tienen motivo registrado y no cuentan.»
- «Competidor: Demo Rival aparece en 3 pérdidas; evidencia baja, aún es pronto para tratarlo como patrón.»
- «Experimento «Mensaje corto a Dirección»: adoptado. Aprendizaje: …»
Línea de prompt propuesta: «Si preguntan qué hemos aprendido, por qué perdemos o qué probamos, usa get_proven_findings y transmite su lectura sin añadir cifras.»

## 10. Datos, permisos y privacidad
Sin tablas ni migración; RLS sin cambios. Solo lectura, sin roles, igual que `list_deals`. No se devuelven textos libres de deals ni nombres de personas; los nombres de competidores son datos de la propia empresa. Fixtures de test ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | regla determinista | — | — |

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `src/lib/proven-findings.ts`; `MIN_LOSSES` a `loss-reasons.ts` y detector importándolo | CA-1 a CA-7 | `src/lib/proven-findings.test.ts` |
| U-2 | Herramienta `get_proven_findings`, título y manifest | CA-8, CA-9 | `src/lib/agent-tools.test.ts` |
| U-3 | Línea en el prompt y test de herramientas nombradas | CA-10 | `src/lib/agent-tools.test.ts` |
U-2 depende de U-1; U-3 de U-2. Cada una se revierte sola.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Patrón: lo mismo que `get_setup_status` (la herramienta devuelve estado calculado más `mensaje` y el agente lo transmite). El módulo recibe filas ya cargadas (deals, experimentos) y no toca la base: el adaptador de la herramienta hace las dos lecturas con `org_id` explícito.
- Nivel de evidencia sobre el total de perdidos y no sobre cada motivo, igual que el detector de pérdidas repetidas, para no dar nivel alto a un motivo pequeño dentro de una muestra enorme ni al revés. Verificado: el detector pasa `sample_size: lost.length` (`strategy-losses.ts`).
- Alternativas descartadas: tabla nueva de aprendizajes (duplica `gtm_experiments`, `memories` y decisiones, y exige migración y RLS); ampliar `memories` con un tipo «hallazgo» (mezcla hechos dictados con cálculos que caducan y compite por los 3500 caracteres del prompt); inyectar los hallazgos en cada turno (cuesta contexto en conversaciones que no los necesitan; la herramienta bajo demanda y una línea de prompt bastan).
- Frontal añade estados «validado» y «comprobado» según repeticiones. Aquí el equivalente son los niveles bajo, medio, alto sobre la muestra existente; no se añade un estado nuevo.
- Siguiente paso, fuera de este SDD: que `draft_followup`, el brief de reunión y la revisión estratégica consuman `provenFindings`. Al ser una función pura, es un cambio de una línea por consumidor.

## 14. Riesgos y dependencias
- **Muestras pequeñas:** con 3 pérdidas hay hallazgo de nivel bajo; el texto lo dice. Riesgo de que se lea como verdad: mitigado por `lectura` y `regla_nivel`.
- **Motivos sin registrar:** si el equipo no rellena el motivo, la herramienta dirá «sin datos» y eso es lo correcto; no se estima.
- **Dependencia de disciplina de uso:** los experimentos solo aportan si se cierran con aprendizaje escrito.

## 15. Decisiones y preguntas
Decididas por Fede el 2026-11-06:
1. Se queda en SDD corto (sin PRD).
2. Mínimo de 3 deals perdidos para hablar de patrón (el valor del detector de hoy).
3. Se incluyen los experimentos descartados.
Siguen abiertas (no bloquean la ejecución):
4. Primer consumidor tras este SDD: borrador de seguimiento, brief de reunión o revisión estratégica (otro SDD).
5. Para el gate: ¿`get_proven_findings` exige rol o basta la lectura abierta como `list_deals`? Por defecto: abierta.

## 16. Pendiente de verificar
- Deals perdidos con y sin motivo, y experimentos cerrados con aprendizaje: **sin dato**. No bloquea. Si Fede aporta los conteos agregados de NOKKO, se anotan aquí; Claude Code no consulta ninguna base de datos.
- Columna del aprendizaje: `learning text not null default ''` (`0003_theory_u.sql:63`); verificada, «en blanco» = cadena vacía o solo espacios.
- Cómo se actualiza `.lovable/mcp/manifest.json` (a mano o con script).

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: No revisado
- [Por verificar] que sigue sin comprobarse: No revisado
- Contradicciones con el código o con decisiones previas: No revisado
- Lo que esta revisión NO demuestra: No hay revisión todavía. Las referencias de la sección 3 las comprobó quien redactó, no un agente independiente.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin implementar.
