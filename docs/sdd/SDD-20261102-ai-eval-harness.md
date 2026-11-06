# SDD-20261102-ai-eval-harness · [Feature] Arnés de evaluación de las generaciones de IA (comprobaciones, juez y coste)

**Tipo:** Feature · **Prioridad propuesta:** Media (hoy nadie mide la calidad ni el coste de lo que genera la IA; sube a Alta antes de construir el plan con IA del SDD 5d)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-02
**PRD:** No aplica (mejora acotada de herramientas internas; no cambia producto ni datos) · **Depende de:** — · **Ticket:** sin número (propuesta: registrarlo en el ledger si Fede da el GO)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Origen: el análisis de gaps de GTM Lab (laboratorio aparte de Fede, 2026-11-01) frente a NOKKO. GTM Lab construyó un arnés de este tipo y midió una mejora clara tras iterar las instrucciones. Aquí se redacta de nuevo para NOKKO a partir de sus criterios y resultados, sin copiar sus archivos (ver §14, decisión 0003 de GTM Lab).

## 1. Resumen
Un arnés que ejecuta una generación de IA de NOKKO sobre casos ficticios y la puntúa en dos capas: comprobaciones automáticas gratis (cifras inventadas, español con «tú», muletillas de IA, validez frente a la app) y un juez de IA con rúbrica. Mide coste y latencia por caso y escribe un informe con lo que no demuestra. No cambia ninguna instrucción de producción: solo mide. El primer objetivo es la extracción del onboarding (`setup-extract`).

## 2. Problema y para quién
NOKKO tiene reglas de producto («nunca inventar cifras», «sin dato», español con «tú») pero ninguna medición de que las generaciones las cumplan, ni del coste por llamada. Para Fede, que decide instrucciones, modelo y esfuerzo sin datos, y para el gate, que hoy no puede probar la calidad de una generación.

## 3. Evidencia y por qué ahora
- **Código (leído el 2026-11-02, rama `feat/software-factory`):**
  - `ask(system, user, opts)` en `src/lib/ai-gateway.ts:11` es el punto único de llamada, con esfuerzo `low` por defecto y esquema JSON estricto opcional; usa la pasarela de Lovable y, como alternativa, claves propias (Gemini, OpenRouter).
  - `src/lib/setup-extract.server.ts` genera la configuración GTM con `ask(..., { effort: "low", schema })` (líneas 36-53).
  - No hay en `src`, `scripts` ni `docs/factory` nada parecido a un eval, un juez o casos de control (búsqueda de «holdout», «judge», «eval-checks», «golden set»: sin resultados).
  - `vitest` solo incluye `src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.ts:11`): la lógica pura del arnés debe vivir en `src/lib/` para tener tests.
- **Resultados de GTM Lab (informes de su `docs/evaluacion/`, leídos el 2026-11-01; los archivos ya no los tengo a mano):** 24 casos con proyectos ficticios, una ejecución por caso, juez calibrado contra otro modelo, no contra una persona. Tras tres iteraciones de instrucciones, «Accionable» pasó de 3,17 a 4,17 sobre 5, los casos que pasaban las comprobaciones de 0 a 22 de 24, el coste por sugerencia bajó un 35 % y la latencia mediana se redujo a la mitad. Sirven como motivo para construir el arnés, no como línea base de NOKKO. **[Por verificar]** si se quiere citarlos en otro documento.
- **Uso real y coste actual de las generaciones de NOKKO:** sin dato.

## 4. Resultado buscado
| Métrica | Fuente | Línea base |
|---|---|---|
| Casos de `setup-extract` que pasan las dos capas | Informe del arnés | sin dato (se mide en U-5) |
| Coste por generación (media, mediana, máximo) | Tokens medidos por el arnés y precios publicados del modelo | sin dato |
| Latencia por generación (mediana y máxima) | Medida por el arnés | sin dato |
| Coincidencia del juez con Fede en la calibración | 5 casos a ciegas | sin dato |

## 5. Alcance
**Incluye:** comprobaciones puras con tests; juez con rúbrica; ejecutor con tope de coste y modo sin API; informe en Markdown; 6 casos ficticios más 2 de control para `setup-extract`; primera medición.
**No incluye (movimientos prohibidos):**
- Cambiar instrucciones, modelo, esfuerzo o código de producción de ninguna generación. Si la medición pide cambios, van en otro SDD.
- Tablas, migraciones, RLS o pantallas nuevas.
- Leer la base de datos o datos de clientes, incluso para armar casos.
- Ejecutar el arnés en CI o de forma automática (gasta API; lo lanza una persona).
- Evaluar otras generaciones (reunión, llamada, sugerencias, plan con IA): cada una se añade con su SDD corto reutilizando el arnés.

## 6. Cambios de comportamiento (delta)
**Añadido:** `src/lib/ai-eval/` (comprobaciones, rúbrica, informe, coste), `scripts/eval/` (ejecutor y casos), evidencias sin versionar en `.factory/evidence/`.
**Modificado:** nada en producción.
**Eliminado:** nada.

## 7. Historias y criterios de aceptación
### H-1: Como Fede, quiero comprobaciones automáticas gratis para saber qué respuestas no se pueden usar sin mirar.
- **CA-1** Una cifra de la respuesta que no aparece en el texto que recibió el modelo se marca como «cifra nueva»; no cuentan los marcadores de enumeración («(1)», «2)»), «1.500» se lee como 1500 y los dígitos dentro de palabras («B2B») se ignoran · prueba: `src/lib/ai-eval/checks.test.ts`
- **CA-2** Una cifra dentro de «[propuesta: …]» no se marca; fuera de esa marca sí · prueba: `checks.test.ts`
- **CA-3** El texto con «usted» o voseo («elegí», «podés») falla la comprobación de idioma; texto en español con «tú» pasa; texto en inglés falla · prueba: `checks.test.ts`
- **CA-4** El texto con una muletilla de la lista cerrada de «AI slop» falla y la respuesta llana pasa; la lista la aprueba Fede (§15) · prueba: `checks.test.ts`
- **CA-5** Una respuesta que la validación de la app rechaza (campo obligatorio ausente, opción fuera del esquema) falla «válida»; una aceptada pasa · prueba: `checks.test.ts`
- **CA-6** Cada comprobación tiene un test con caso que debe fallar y caso que debe pasar (oráculo y nulo), y el test falla antes de existir el código (regla base 5) · prueba: `checks.test.ts`

### H-2: Como Fede, quiero un juez de IA con rúbrica fija para valorar la utilidad sin leer cada caso.
- **CA-7** El juez recibe solo el texto que recibió el generador y la respuesta, nunca el nombre del modelo generador, y devuelve JSON con esquema fijo (concreta, coherente y accionable de 1 a 5 con motivo, y marca de invención sí/no con motivo) · prueba: `src/lib/ai-eval/judge.test.ts` (con respuesta simulada)
- **CA-8** Un JSON del juez fuera del esquema o con nota fuera de 1 a 5 se rechaza con un error que dice qué falta; no se reintenta en silencio · prueba: `judge.test.ts`
- **CA-9** El modelo del juez es distinto del modelo del generador; si coinciden, el ejecutor se detiene antes de gastar · prueba: `scripts/eval/run.test.ts`

### H-3: Como Fede, quiero controlar el gasto antes y durante la ejecución.
- **CA-10** Con `--dry-run` el ejecutor imprime casos, modelos y coste proyectado, y no hace ninguna llamada de red · prueba: `run.test.ts`
- **CA-11** Si el coste acumulado supera el tope indicado, el ejecutor se detiene, guarda lo hecho y lo dice con el coste real · prueba: `run.test.ts`
- **CA-12** Cada caso guarda tokens de entrada (con y sin caché), tokens de salida, coste calculado, latencia y respuesta en `.factory/evidence/`, que no se versiona · prueba: `run.test.ts`
- **CA-13** Con `--recheck` las comprobaciones se recalculan sobre respuestas ya guardadas, sin llamar a la API · prueba: `run.test.ts`

### H-4: Como Fede, quiero un informe que diga si la generación llega al umbral y qué no demuestra la medición.
- **CA-14** El informe compara con el umbral aprobado (§15) condición por condición y muestra por paso: notas medias, invenciones, casos que pasan, coste y latencia · prueba: `src/lib/ai-eval/report.test.ts`
- **CA-15** El informe lista siempre sus límites: una ejecución por caso, casos ficticios, juez no calibrado contra una persona (si no lo está) y lo que las comprobaciones no detectan · prueba: `report.test.ts`
- **CA-16** Una cifra del informe sin archivo de evidencia detrás hace fallar la generación del informe (regla base 7) · prueba: `report.test.ts`

### H-5: Como Fede, quiero una primera medición de `setup-extract` con casos ficticios.
- **CA-17** Hay 6 casos de ajuste y 2 de control (los de control no se usan para ajustar nada) con empresas, webs y documentos inventados, sin ningún dato de clientes · prueba: `src/lib/ai-eval/cases.test.ts` (estructura y ausencia de dominios y correos reales)
- **CA-18** Se ejecuta una pasada con la configuración actual, sin cambiar nada de producción, y el informe queda en `docs/evaluacion/` · prueba: revisión de Fede de la entrega (no automática, porque gasta API)

## 8. Casos límite y errores
- Respuesta sin JSON o cortada: el caso queda como «no terminó bien» y no se ejecuta el resto de comprobaciones (CA-7, CA-12).
- El proveedor devuelve 402, 403 o 429: el ejecutor guarda lo hecho, dice qué pasó y qué hacer, y no reintenta en bucle (CA-11).
- Sin clave de IA en el entorno local: error claro antes de empezar, con `--dry-run` aún disponible (CA-10).
- Cifras escritas con letras («tres clientes»): no se detectan; se anota como límite (CA-15).
- Multitenant: no aplica, el arnés no toca la base de datos ni `org_id`.

## 9. Experiencia y copy
Es una herramienta de línea de comandos y un informe interno. Mensajes y informe en español con «tú»; errores con «qué pasó + qué hacer». Sin pantallas.

## 10. Datos, permisos y privacidad
Sin tablas, columnas, RLS ni GRANTs. Los casos son ficticios; el ejecutor no lee la base ni `.env` de producción. Las claves de IA se leen del entorno local de quien lo lanza y nunca se escriben en evidencias ni en el informe. `.factory/evidence/` ya está sin versionar. **[Por verificar]** que la ruta `.factory/evidence/` está en `.gitignore`.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Generador: la de `setup-extract` tal cual está hoy | regla → caché → modelo barato (ya existe) | el actual de producción, `low` | sin dato (se mide en U-5) |
| Juez de utilidad (nueva, solo en el arnés) | modelo caro justificado: valora a otro modelo y solo se lanza a mano | distinto del generador; esfuerzo `medium` (§15) | sin dato; el ejecutor lo proyecta con `--dry-run` y se aprueba antes de gastar |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Comprobaciones puras | CA-1 a CA-6 | `src/lib/ai-eval/checks.test.ts` |
| U-2 | Rúbrica y validación de la respuesta del juez | CA-7, CA-8 | `src/lib/ai-eval/judge.test.ts` |
| U-3 | Ejecutor con `--dry-run`, tope de coste, evidencias y `--recheck` | CA-9 a CA-13 | `scripts/eval/run.test.ts` |
| U-4 | Informe frente al umbral | CA-14 a CA-16 | `src/lib/ai-eval/report.test.ts` |
| U-5 | Casos ficticios y primera medición de `setup-extract` (con el OK de gasto de Fede) | CA-17, CA-18 | `src/lib/ai-eval/cases.test.ts` |

U-1 a U-4 no gastan API. U-5 gasta y necesita el OK de Fede con el coste proyectado delante.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- Lógica pura en `src/lib/ai-eval/` para entrar en el `include` de `vitest`; el ejecutor en `scripts/eval/` importa de ahí. **[Por verificar]** cómo ejecutar TypeScript desde un script con el tooling actual (bun está en `bun.lock` y `bunfig.toml`), y si `ask()` se puede llamar fuera del servidor de la app: depende de variables de entorno y de la pasarela de Lovable, así que el ejecutor puede necesitar `askOwn` con clave propia.
- Para CA-5, reutilizar la validación que ya use la app con el esquema `SETUP_EXTRACTION_SCHEMA`; si no existe una función pura, extraerla es la única modificación de producción posible y habría que declararla aquí antes de hacerla **[Por verificar]**.
- La fuente de cifras de CA-1 es solo el texto del paso (instrucción y contexto), no el system prompt general: en GTM Lab un dígito del system prompt dejaba pasar una cifra inventada.
- El juez debe ser de otra familia o, al menos, otro modelo que el generador (analogía de la regla base 4: el autor no califica su propio trabajo).
- Convención «[propuesta: …]» frente a «sin dato»: resuelve el choque entre «propón una meta» y «no inventes cifras» que GTM Lab midió. NOKKO no la usa hoy; adoptarla en producción sería otro SDD.

## 14. Riesgos y dependencias
- **Decisión 0003 de GTM Lab:** dice que reutilizar su metodología o su código en NOKKO deja de ser uso interno y exige revisión. Este SDD no copia archivos ni textos de GTM Lab: la rúbrica y las comprobaciones se redactan aquí desde los criterios. Aun así, recomiendo que Fede anote en la 0003 que el arnés de evaluación (código genérico) queda permitido.
- **Medición débil:** una ejecución por caso, casos ficticios y juez sin calibrar contra una persona pueden dar falsa seguridad. Mitigación: 2 casos de control, calibración con Fede y los límites siempre visibles en el informe (CA-15).
- **Sobreajuste:** iterar instrucciones sobre los mismos casos los favorece; por eso existen los de control.
- **Coste:** el juez y la pasada completa gastan API; topes y `--dry-run` (CA-10, CA-11).
- **Comprobaciones con lista cerrada** (voseo, muletillas): no ven formas nuevas. Se declara en el informe.
- **Sin dependencias** de la salida de Lovable ni de la torre de control.

## 15. Preguntas para Fede y para la revisión técnica
1. **Primera generación a medir.** Recomiendo `setup-extract`: tiene esquema estricto (se puede validar), escribe datos de configuración (una invención cuesta más aquí) y hoy no tiene casos. Alternativa: la preparación de llamada, pero devuelve Markdown libre y sin esquema.
2. **Modelo del juez.** Recomiendo uno de otra familia que el generador y el esfuerzo `medium`, porque un juez del mismo modelo tiende a premiar su propio estilo. Qué modelo concreto depende de qué claves tengas disponibles fuera de la pasarela de Lovable.
3. **Topes de gasto.** Recomiendo $1 para el piloto de 5 casos y $2 para la pasada completa de 8, con aprobación tuya antes de cada una. Son los órdenes de magnitud que usó GTM Lab; en NOKKO el coste es **sin dato** hasta el piloto.
4. **Umbral de «sirve tal cual».** Recomiendo el de GTM Lab como punto de partida: 0 rechazos, 0 invenciones, al menos 22 de 24 casos con comprobaciones (7 de 8 aquí) y media de 4 o más en cada criterio, sin ninguna nota de 2 o menos. Lo apruebas tú, porque es una decisión de calidad de producto.
5. **Lista de muletillas de «AI slop».** Recomiendo empezar con la de GTM Lab (palabras de moda, fórmulas de relleno, rayas, exclamaciones y emoji) y que la veas antes de fijarla.
6. **Calibración del juez.** Recomiendo que puntúes 5 casos a ciegas (15 notas) y que se acepte al juez si coinciden al menos 12 con ±1, ninguna difiere en 3 o más y la marca de invención coincide en los 5. Si prefieres delegarla, el informe lo dirá en sus límites.
7. **Dónde viven los informes.** Recomiendo `docs/evaluacion/` en el repo; si prefieres Drive, hay que crearlo en la carpeta de NOKKO con tu OK.

## 16. Pendiente de verificar
- Ejecutar TypeScript desde un script y llamar a `ask()` o `askOwn()` fuera de la app: lo comprueba quien implemente U-3.
- Existencia de una validación pura para `SETUP_EXTRACTION_SCHEMA`: lo comprueba U-1.
- `.factory/evidence/` ignorado por git: lo comprueba U-3.
- Cifras de GTM Lab (§3): proceden de sus informes, sin re-ejecutar.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
- Veredicto del gate: No revisado
- CA sin prueba posible o sin G-n: sin revisar (este SDD no tiene PRD, así que no hay G-n)
- [Por verificar] que sigue sin comprobarse: sin revisar
- Contradicciones con el código o con decisiones previas: sin revisar
- Lo que esta revisión NO demuestra: todo; no ha pasado el gate.

## 18. Delta de implementación (lo rellena el agente al entregar)
Sin empezar.
