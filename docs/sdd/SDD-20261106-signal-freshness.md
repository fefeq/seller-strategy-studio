# SDD-20261106-signal-freshness · [Mejora] Señales de cuenta con vigencia por tipo

**Tipo:** Mejora · **Prioridad propuesta:** Media
**Estado:** Borrador (decisiones de Fede cerradas el 2026-11-06, ver sección 15; falta su aprobación para ejecutar) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** No aplica (mejora acotada: sin tabla, sin migración, sin permisos nuevos) · **Depende de:** — · **Sustituye** la unidad U-2 de `SDD-20261106-frontal-rules-integration` (señales con ventana por tipo): esa unidad pasa a usar este módulo, ver sección 6

> Nivel elegido: SDD corto. Un PRD añadiría objetivos de negocio medibles, que hoy no existen porque no hay uso real (foto de la Fase A: 1 cuenta, 0 leads). Las secciones que no cambian el resultado van como «No aplica».

## 1. Resumen
Hoy una señal de cuenta (ronda, contrataciones, cambio de dirección…) cuenta como «novedad» durante 7 días desde que Nokko la encontró, sea del tipo que sea. Se añade una regla pura de vigencia por tipo con tres estados, **Gancho**, **Solo contexto** y **Caducada**, y una regla de señales apiladas. La misma función la leen el detector de sugerencias, la herramienta del agente y de MCP, y la ficha de cuenta, así que los tres dicen lo mismo de la misma señal.

## 2. Problema y para quién
El vendedor puede recibir como sugerencia una noticia publicada hace semanas solo porque Nokko la encontró hoy, y no puede distinguir una ronda de hace dos semanas (aún sirve para abrir un mensaje) de una de hace dos meses. El agente tampoco: tendría que calcular fechas por su cuenta.

## 3. Evidencia y por qué ahora
- El detector usa `found_at` y 7 días fijos para todos los tipos (`src/lib/proactive/detectors/account-signal.ts:8`).
- La ficha de cuenta calcula la edad con `published_at ?? found_at` (`src/components/web-research.tsx:89`). Detector y pantalla ya discrepan en la misma señal.
- La tabla ya guarda `kind`, `published_at` y `found_at` (migración `0031_account_signals.sql`): no falta ningún dato.
- La carga de señales para el detector es de 14 días, sin `order` y con `limit(200)` (`src/lib/org-data.ts:280-284`). Al ampliar la ventana, sin ordenar, el tope descartaría señales al azar. El índice `account_signals_recent (org_id, found_at desc)` (migración 0031, línea 19) ya sirve para ordenar.
- `list_account_signals` devuelve señales de los últimos 30 días sin decir si sirven (`src/lib/agent/tools/web.ts:22-34`).
- Las ventanas por tipo salen del skill `signal-detection` del repo público GTM OS de Frontal (`github.com/Frontal-so/gtm-os`, MIT). Sus cifras no traen fuente propia: se usan como punto de partida y se calibran con datos de cada empresa.
- `published_at` lo rellena el modelo al extraer la señal (campo «AAAA-MM-DD si se sabe», guardado a las 12:00 UTC; nulo si no se sabe o el formato no cuadra): `src/lib/web-research-core.ts:295-308` y esquema en la línea 199. Es un dato declarado por IA, no verificado.
- Sin dato de uso real. **[Por verificar]** cuántas señales hay hoy y de qué tipos (ver sección 16).

## 4. Resultado buscado
- Ninguna sugerencia `account_signal` nueva para una noticia cuya publicación supere la ventana de Gancho de su tipo. Línea base: sin dato.
- Detector, herramienta y pantalla dan el mismo estado a la misma señal (lo prueba un test de contrato, CA-10).
- Señales con sugerencia aprobada sobre señales con sugerencia: sin dato hoy; se mide tras 4 semanas de uso real.

## 5. Alcance
**Incluye:** módulo puro de vigencia y apilado; cambio del detector `account_signal`; carga ordenada y con ventana derivada de la tabla en el snapshot; campos nuevos en `list_account_signals` (y su título y manifest MCP); estado con palabra en la ficha de cuenta.
**No incluye (límite que el brief copia a «Movimientos prohibidos»):** tabla o columna nueva; ajuste de ventanas por empresa; señales de proveedor de datos (Fase B); cambios en la puntuación del lead; uso de señales en el brief de reunión, en borradores o en la revisión estratégica; envío de nada.

## 6. Cambios de comportamiento (delta)
**Relación con `SDD-20261106-frontal-rules-integration`:** ese SDD proponía `SIGNAL_WINDOWS` y `signalFreshness` en `web-research.ts` con otros nombres de estado. Decisión de Fede (2026-11-06): queda esta regla como única. Las jugadas de la biblioteca (su U-4) leen las ventanas de `src/lib/signal-freshness.ts`.

**Añadido:** `src/lib/signal-freshness.ts` y su test; `estado`, `edad_dias` y `lectura` en `list_account_signals`; etiqueta de estado en la ficha de cuenta.
**Modificado:**
- Detector: «encontrada hace ≤7 días» → «en estado Gancho según su tipo, con edad desde `published_at` si existe, si no `found_at`». Una ronda sigue siendo accionable hasta ~8 semanas; una noticia publicada hace 40 días y encontrada hoy deja de generar sugerencia (hoy sí la genera).
- Snapshot: ventana fija de 14 días → ventana igual a la mayor vigencia de la tabla, más recientes primero, tope 200.
- `list_account_signals`: por defecto no devuelve señales caducadas.
**Eliminado:** la constante `7 * DAY` del detector.

## 7. Historias y criterios de aceptación
### H-1: Como vendedor, quiero que Nokko me sugiera contactar solo por noticias que aún sirven, para no abrir un mensaje con una novedad vieja.
- **CA-1** La edad de una señal son los días enteros entre `now` y `published_at`; si `published_at` es nulo o posterior a `now`, entre `now` y `found_at`. · prueba: `src/lib/signal-freshness.test.ts`
- **CA-2** Cada señal tiene un estado: Gancho (edad ≤ días de gancho de su tipo), Solo contexto (≤ días de vigencia) o Caducada (más). Los límites son inclusivos y un tipo sin fila usa el valor por defecto. · prueba: `src/lib/signal-freshness.test.ts`
- **CA-3** El detector propone solo señales en estado Gancho: una señal publicada hace 40 días y encontrada hoy no genera sugerencia. · prueba: `src/lib/proactive.test.ts`
- **CA-4** La clave de dedupe sigue siendo `signal:<id>`: una señal descartada no vuelve. · prueba: `src/lib/proactive.test.ts`
- **CA-5** Señales apiladas: una cuenta con al menos dos señales de tipos distintos entre los accionables (sin `risk`), ninguna caducada y al menos una en Gancho, sube sus sugerencias de señal a prioridad 2 y el cuerpo nombra la otra señal. Una señal sola, o dos del mismo tipo, no apilan. · prueba: `src/lib/signal-freshness.test.ts` y `src/lib/proactive.test.ts`
- **CA-6** `signalLoadDays()` devuelve la mayor vigencia de la tabla de ventanas, y `loadSnapshot` la usa para cargar señales con `found_at` dentro de ese margen, las más recientes primero, con tope de 200 y con `published_at` en el `select`. · prueba: `src/lib/signal-freshness.test.ts` para la función pura. `loadSnapshot` no tiene hoy test propio: el orden y el `select` se comprueban en el recorrido local de la sección 12 (U-2).
- **CA-12** El detector emite como máximo 5 sugerencias de señal nuevas por ejecución y por empresa, las de mayor prioridad y más recientes primero; el resto espera a la siguiente ejecución sin perderse. El valor es la constante `MAX_SIGNAL_SUGGESTIONS_PER_RUN`. · prueba: `src/lib/proactive.test.ts`

### H-2: Como persona que habla con el agente, quiero que me diga qué señales puedo usar y cuáles no, sin que él calcule fechas.
- **CA-7** `list_account_signals` devuelve, por señal, `estado` (`gancho`, `solo_contexto`, `caducada`) y `edad_dias`; por defecto omite las caducadas, y `incluir_caducadas: true` las añade. Devuelve además `lectura`, un texto en español, conclusión primero, calculado por código, una frase por cuenta. · prueba: `src/lib/agent-tools.test.ts`
- **CA-8** La descripción nueva consta en `TITLES` y en `.lovable/mcp/manifest.json`, y la herramienta sigue marcada de solo lectura. · prueba: la prueba de estructura del manifest en `src/lib/agent-tools.test.ts`
- **CA-9** La herramienta solo devuelve señales de la empresa del llamante, también con el cliente privilegiado de Telegram o de cron. · prueba: `src/lib/agent-tools.test.ts`

### H-3: Como vendedor, quiero ver en la ficha de la cuenta si una noticia sirve de gancho, para decidir sin hacer cuentas.
- **CA-10** Detector, herramienta y ficha usan la misma función: un test recorre una lista de señales y comprueba que los tres entregan el mismo estado. · prueba: `src/lib/signal-freshness.test.ts`
- **CA-11** La ficha muestra el estado con palabra junto a la edad; la señal caducada se atenúa y no se oculta (las noticias no se borran). · prueba: etiquetas en `src/lib/signal-freshness.test.ts` y recorrido de `nokko-walkthrough` en móvil y escritorio, claro y oscuro

## 8. Casos límite y errores
- `published_at` nulo o en el futuro: se usa `found_at` (CA-1). `published_at` lo rellena el modelo y puede ser nulo (`src/lib/web-research-core.ts:295-308`).
- Tipo no listado (`case_study`, `results`, `risk`, `other`): valores por defecto (CA-2).
- Cuenta sin señales: `lectura` dice «Sin señales vigentes en esta cuenta.» (CA-7).
- Otra empresa: filtro explícito por `org_id` (CA-9).
- Día de corte: la edad se cuenta en días enteros UTC, como `ageText` en `src/lib/web-research.ts`.

## 9. Experiencia y copy
Estados: «Gancho», «Solo contexto», «Caducada». Ayuda corta junto al estado:
- Gancho: sirve para abrir el mensaje.
- Solo contexto: sigue siendo cierta; menciónala como fondo.
- Caducada: no la uses.

Ejemplos de `lectura` (datos ficticios):
- «Acme Demo tiene 2 señales independientes vigentes (Ronda o inversión y Contrataciones): buen momento para contactar, abre con la ronda.»
- «Beta Demo: su única señal es de hace 70 días y está caducada; no la uses como gancho.»

## 10. Datos, permisos y privacidad
Sin tablas, columnas ni migración. RLS de `account_signals` sin cambios (lectura para miembros de la empresa, migración 0031). La herramienta sigue siendo de lectura y sin roles, como hoy. Ningún dato de clientes en código, pruebas ni logs: fixtures ficticios.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Ninguna | regla determinista | — | — |

## 12. Unidades de trabajo
Cada unidad es un PR pequeño. U-2, U-3 y U-4 dependen de U-1 y son independientes entre sí; cada una se puede revertir sola.
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | `src/lib/signal-freshness.ts`: edad, estado, apilado y lectura | CA-1, CA-2, CA-5 (regla), CA-10 | `src/lib/signal-freshness.test.ts` |
| U-2 | Detector y snapshot | CA-3, CA-4, CA-5, CA-6, CA-12 | `src/lib/proactive.test.ts`, `src/lib/signal-freshness.test.ts` |
| U-3 | Herramienta, título y manifest MCP | CA-7, CA-8, CA-9 | `src/lib/agent-tools.test.ts` |
| U-4 | Estado en la ficha de cuenta | CA-11 | `src/lib/signal-freshness.test.ts` (etiquetas) + recorrido |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Patrón a seguir: `src/lib/stale.ts` (regla pura, la leen pantalla, detector y agente). Interfaz mínima para los tres consumidores: `readAccountSignals(signals, now) → { signals: (S & { state, ageDays })[], stacked, reading }`. Los consumidores no importan la tabla de ventanas.
- Tabla de ventanas como `Record<SignalKind, …>`: TypeScript obliga a decidir cada tipo nuevo. Ventana de carga = la mayor vigencia de la tabla, no un literal.
- Tabla inicial propuesta, **sin validar**:

| Tipo | Gancho hasta (días) | Vigente hasta (días) | Origen |
|---|---|---|---|
| `funding` Ronda o inversión | 56 | 90 | Frontal: ventana de semanas 2 a 8, vigencia 90 días |
| `hiring` Contrataciones | 30 | 60 | Frontal: ventana de 14 a 30 días, vigencia 60 |
| `leadership` Cambio de dirección | 30 | 90 | Frontal (nuevo directivo): días 14 a 30, vigencia 90 |
| `expansion` Expansión | 60 | 90 | Frontal da la ventana 30 a 90; el corte en 60 es propio |
| `launch` Lanzamiento, `partnership` Alianza | 30 | 60 | Frontal da la ventana 14 a 60; el corte en 30 es propio |
| `case_study`, `results`, `risk`, `other` | 30 | 60 | Sin referencia; valor propio |

- Decisión propia: Frontal empieza la ventana en el día 14 («demasiado pronto» antes). Nokko no lo modela: una señal de 3 días es Gancho, porque Nokko la ve días después de publicarse.
- Alternativas descartadas: guardar el estado en una columna (caduca cada día y exige un job y una migración); clasificar la vigencia con IA (no determinista y con coste); inyectar un bloque de señales en cada turno del agente (ver SDD `proven-findings`, sección 13).
- Paso siguiente natural, fuera de este SDD: override por empresa en `lead_settings.sla.signal_windows`, mezclando sobre la fila actual como hace `stale_deal_days`. Señales de proveedor (Fase B) añaden tipos nuevos: exigen ampliar el `check` de `kind` en `account_signals` con migración.

## 14. Riesgos y dependencias
- **Ráfaga al salir:** señales de entre 8 y 56 días sin sugerencia previa pasan a Gancho y generan sugerencias a la vez. El dedupe evita repeticiones, pero no el primer lote. Mitigación: medir antes con una consulta de solo lectura (pregunta 3).
- **Cifras sin validar:** el usuario ve palabras y edad en días, no probabilidades; aun así, conviene calibrar con las señales previas a deals ganados de cada empresa cuando existan.
- **Más filas por ejecución horaria:** la ventana de carga pasa de 14 a ~90 días con el mismo tope de 200.
- **`published_at` declarado por IA:** puede ser nulo o erróneo (p. ej. fecha de otra noticia). Si es nulo cae a `found_at`, que es el comportamiento de hoy; si es erróneo, la etiqueta de estado puede equivocarse. La ficha muestra la fecha usada para que la persona pueda comprobarla.

## 15. Decisiones y preguntas
Decididas por Fede el 2026-11-06:
1. Tabla inicial de ventanas de la sección 13: aceptada como valores por defecto declarados (no son un resultado medido).
2. Tope de 5 sugerencias de señal nuevas por ejecución y empresa (CA-12).
3. Esta regla sustituye a la U-2 de `frontal-rules-integration`.
Siguen abiertas (no bloquean la ejecución; hay valor por defecto):
4. ¿`risk` fuera de las señales apiladas? Por defecto: fuera (es amenaza, no motivo de compra).
5. ¿Ventanas ajustables por empresa desde Configuración? Por defecto: fijas hasta tener datos.
6. Para el gate: ¿cómo comprobar `loadSnapshot` sin test propio (CA-6)?

## 16. Pendiente de verificar
- Señales por empresa y por tipo: **sin dato**. No bloquea: CA-12 limita el lote del primer día a 5. Si Fede aporta los conteos agregados de NOKKO, se anotan aquí; Claude Code no consulta ninguna base de datos.
- Que el manifest MCP se regenera con `node node_modules/@lovable.dev/mcp-js/dist/cli/extract-manifest.cjs .` (comando citado por `frontal-rules-integration`; no comprobado aquí porque el clon no tiene dependencias instaladas): Claude Code corre `bun install` primero.
- Que existe script de tipos además de `vitest run` y `eslint .`: confirmar en `AGENTS.md`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: No revisado
- [Por verificar] que sigue sin comprobarse: No revisado
- Contradicciones con el código o con decisiones previas: No revisado
- Lo que esta revisión NO demuestra: No hay revisión todavía. Las referencias de la sección 3 las comprobó quien redactó, no un agente independiente.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin implementar.
