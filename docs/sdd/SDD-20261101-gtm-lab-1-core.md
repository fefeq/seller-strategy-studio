# SDD-20261101-gtm-lab-1-core · [Feature] GTM Lab en NOKKO 1: núcleo, metodología y eval por OpenRouter con modelo fijo (sin base de datos)

**Tipo:** Feature · **Prioridad propuesta:** Alta (primer paso del PRD; no depende de la salida de Lovable)
**Estado:** Aprobado por Fede el 2026-11-02 (v5, tras cuatro pasadas del gate; sin quinta pasada, con los [Por verificar] del §16 que solo resuelve el piloto) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-01
**PRD:** `docs/prd/PRD-20261101-gtm-lab-en-nokko.md` (§8, paso 1) · **Depende de:** — · **Ticket:** NK-0048

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Si el PRD existe, cada CA-n cita el objetivo G-n que cubre.

## 1. Resumen
- Se copia a NOKKO el núcleo de GTM Lab (`packages/core` de `gtm-lab@44f385b`), con sus tests, y su metodología a `src/lib/gtm-lab/`.
- Se añade, en un archivo nuevo, una llamada a OpenRouter con **modelo fijo**. Devuelve el texto, la salida interpretada, el motivo de parada, el modelo que respondió, el uso y el coste.
- Se porta el eval de GTM Lab con el mismo juez y se mide en dos pasadas de 24 casos con el **mismo prompt**: una de referencia por Anthropic directo y otra por OpenRouter. Así solo cambia la ruta.
- **No hay pantallas, rutas, menú ni migraciones.** Es la base de los SDD 3 a 7 del PRD.

## 2. Problema y para quién
Del PRD §1: NOKKO evoluciona a GTM Lab. Antes de las tablas y las pantallas (que esperan a la salida de Lovable), el núcleo tiene que vivir en NOKKO y estar probado. Además, hay que demostrar que la IA de GTM Lab no empeora al pasar de Anthropic directo a OpenRouter (PRD E-3). Afecta al equipo que construye, no al usuario final.

## 3. Evidencia y por qué ahora
Leído el 2026-11-01 y el 2026-11-02. Lo confirman las cuatro pasadas del gate (§17).

**Núcleo de GTM Lab** (`~/gtm-lab/packages/core/src`, `44f385b`):
- 3.475 líneas en total y 1.455 sin tests.
- 14 archivos `*.test.ts`, con 174 llamadas `it(`/`test(` literales y 12 `it.each`.
- Imports: solo `yaml`, `zod`, rutas relativas sin extensión, `node:*` (en `node.ts` y en los tests) y `vitest`.
- `index.ts` exporta valores y tipos. Hay un segundo punto de entrada, `./node`.
- `formJsonSchema` genera `additionalProperties: false` y `required` completo (`ai.ts:56-79`).
- 12 de los 14 tests cargan la metodología con `new URL("../../../methodology/…", import.meta.url)`; 13 usan `import.meta.url` como ruta (contando `boundaries.test.ts`) y `ice.test.ts` no usa ninguno.
- 366 líneas pasan de 100 caracteres.

**Entorno de los tests en NOKKO** (`vitest.config.ts`): `environment: "jsdom"`. Lo reprodujo el gate:
- Con jsdom, `new URL(…, import.meta.url)` da `http://localhost:3000/…`, y `readFileSync(URL)` y `fileURLToPath` fallan.
- Con `// @vitest-environment node`, que NOKKO ya usa en `src/lib/migrations.pg.test.ts:1`, funcionan.
- `?raw` funciona con jsdom.

**Petición de la línea base** (`supabase/functions/_shared/anthropic.ts`):
- Anthropic directo con `claude-sonnet-5-5`, `effort: "low"`, `max_tokens: 16000`, el system con `cache_control`, salida estructurada y `fallbacks: "default"` (`:32-38`).
- La cabecera `anthropic-workspace-id` va si existe `ANTHROPIC_WORKSPACE_ID` (`:20-27`).
- La salida solo se interpreta si `stop_reason` es `end_turn` (`:42-50`).

**La línea base G-4 no usó el prompt de `44f385b`:**
- G-4 (4,17 y 22 de 24) y G-5 ($0,0059) salen de la pasada `instrucciones-ia-iter3`.
- Después, el commit `ee410ee` cambió las instrucciones: el `system` difiere en los 24 casos y `user` y `schema` son iguales.
- No hay ninguna pasada de 24 casos por Anthropic directo con el prompt actual (lo comprobó el gate).
- En iter3, el juez costó $0,6238 de $0,7651 en total (24 casos).

**Eval de GTM Lab** (`scripts/eval-suggest.mjs`, `eval-checks.mjs` y `eval-checks.test.mjs`):
- Tope por ejecución. Se comprueba después de cada llamada, y el juez se salta si la generación ya lo supera (`:302`, `:313`).
- En la pasada completa, `--cap` es obligatorio y la suma la lleva quien ejecuta (`:322-330`).
- El cuerpo del juez está dentro de `judgeCase` (`:182-192`), no se exporta.
- `eval-checks.test.mjs` (268 líneas) tiene ejemplos fijos, incluidos `stopReason: "refusal"` y `"max_tokens"` (`:62-71`).
- Umbral (`criterio.md` §5, `:58-62`), sobre 24 casos: ninguna negativa ni respuesta cortada, ninguna invención, al menos 22 que pasan, y media ≥ 4 en cada criterio sin notas ≤ 2.
- La generación de la línea base usa `@anthropic-ai/sdk`: `client.beta.messages.create` con `betas: ["server-side-fallback-2026-07-01"]` y `fallbacks: "default"` (`anthropic.ts:1-2`, `:31-39`). El eval original carga el SDK desde `supabase/package.json` (`eval-suggest.mjs:232-235`). NOKKO no tiene el SDK.
- Pasadas de 24 casos medidas en la evidencia de GTM Lab: entre $0,74 y $0,92 (la más cara, `usuarios-reales-b/full.json`). No hay ningún dato del ruido del juez entre ejecuciones: `instrucciones-ia-iter4` solo repite un caso 3 veces (4, 4, 4).
- Fixtures: sin emails, URLs ni teléfonos. **[Por verificar]**: que los nombres de producto no coincidan con empresas reales.

**NOKKO** (`origin/main`):
- `zod` ya es dependencia y `yaml` no lo es.
- `vite/client` tipa `*?raw`.
- `ai-gateway.ts` solo importa `@/lib/gemini`, que es puro.
- `ask()` devuelve solo el texto y recorre `aiProviders()`.
- `src/lib/AGENTS.md:38` dice que toda llamada de IA recorre `aiProviders()`.
- El lint del gate (`scripts/factory/gate.mjs:96-102`) solo mira `^(src|scripts)/`, con prettier: `ai-gateway.ts` ya da 24 errores y `gemini.ts`, 57.

**Uso real:** sin dato (es infraestructura).

## 4. Resultado buscado
Cubre el **PRD E-3** (la IA de GTM Lab no empeora fuera de Anthropic directo).
- **Se cierra con CA-19**, con el criterio del PRD: la pasada de 24 casos por OpenRouter alcanza el umbral de `criterio.md` §5.
- La **pasada de referencia de CA-18**, con el mismo prompt y el mismo juez por Anthropic directo, sirve para comparar. Si OpenRouter queda claramente por debajo, se marca para que Fede decida (márgenes en CA-19).
- **G-4 (iter3) no sirve como referencia**, porque usó otro prompt (§3).
- El piloto (CA-17) es solo una señal.
- CA-1 a CA-12 son requisitos previos (trazabilidad, no evidencia de calidad).
- También es la base de E-4: el registro de coste del SDD 4 reutilizará el uso que devuelve `askPinned`.

## 5. Alcance
**Incluye:**
- `src/lib/gtm-lab/core/`: el núcleo, sus tests y el test de fronteras, reformateados con prettier y con los cambios de forma de CA-2.
- `core/node.ts`: solo para los tests y el eval.
- `src/lib/gtm-lab/methodology/` (`framework.yaml` y `tasks.yaml`, idénticos a `44f385b`) y `src/lib/gtm-lab/methodology.ts` con `?raw`.
- `yaml` en `package.json` y `bun.lock`.
- `src/lib/ai-pinned.ts` (archivo nuevo) y la línea de excepción en `src/lib/AGENTS.md:38`.
- `src/lib/gtm-lab/suggest-request.ts`.
- El eval portado:
  - lógica pura en `src/lib/gtm-lab/eval/`: comprobaciones, tope y registro de gasto, cuerpo del juez (`judge-request.ts`), cuerpo de la referencia (`reference-request.ts`) y dry-run;
  - los fixtures `projects.json` y `holdout.json`, en `src/lib/gtm-lab/eval/fixtures/`;
  - la rúbrica, en `docs/gtm-lab/evaluacion/criterio.md`;
  - el script de ejecución en `scripts/gtm-lab/` y su `vitest.eval.config.ts`.
- Las pasadas piloto, de referencia y completa, cada una con el OK de Fede para su gasto.

**No incluye:**
- Migraciones, tablas o cambios en `src/integrations/supabase/types.ts`.
- Rutas, pantallas, `src/lib/nav.ts`, ⌘K, herramientas del agente o server functions.
- Cualquier llamada a IA desde la app (llega en el SDD 4).
- Cambios en `ai-gateway.ts`, `gemini.ts`, `ask()`, la cadena de proveedores o `vitest.config.ts`.
- Cambios en los textos de la metodología o en la lógica del núcleo.
- Tocar el repo `gtm-lab` (0005).

## 6. Cambios de comportamiento (delta)
**Añadido:**
- `src/lib/gtm-lab/`.
- `src/lib/ai-pinned.ts`.
- `scripts/gtm-lab/` y `vitest.eval.config.ts`.
- La dependencia `yaml`.
- Una línea en `src/lib/AGENTS.md`.

**Modificado:** ninguno en código existente.

**Eliminado:** ninguno.

## 7. Historias y criterios de aceptación
### H-1: Como equipo que construye NOKKO, quiero el núcleo de GTM Lab dentro de NOKKO y probado, para construir encima sin depender de otro repo.
- **CA-1** La lista de exportaciones de `src/lib/gtm-lab/core/index.ts` (valores **y** tipos), leída del archivo como texto, es igual a una **lista de referencia fijada en el test**. Esa lista se sacó de `packages/core/src/index.ts@44f385b` al copiar.
  - El punto de entrada `./node` pasa a ser `core/node.ts`.
  - Cada archivo copiado empieza con `// From gtm-lab@44f385b packages/core/src/<archivo>`.
  - · cubre E-3 (requisito previo) · prueba: `src/lib/gtm-lab/core/exports.test.ts`
- **CA-2** Pasan en el vitest de NOKKO los 14 archivos de test portados: 174 llamadas `it`/`test` literales y 12 `it.each`.
  - `test-count.test.ts` cuenta en estático y **se excluye a sí mismo**.
  - Cambios permitidos, y solo estos:
    1. la cabecera de procedencia de CA-1;
    2. `// @vitest-environment node` como primera línea de código de cada test que use `node:` o `import.meta.url` como ruta de archivo;
    3. las rutas de carga de la metodología;
    4. `fileURLToPath` en lugar de `.pathname` en `boundaries.test.ts`;
    5. que `packageDir` apunte a `core/`;
    6. el reformateo de prettier;
    7. `no-regex-spaces` en `forms.test.ts:60` (`  da:` pasa a ` {2}da:`, equivalente).
  - Ninguna aserción se elimina ni se debilita.
  - **Revisión:** el diff se compara contra `44f385b` **pasado por prettier con el `.prettierrc` de NOKKO**, no con `diff -w`.
  - · cubre E-3 (requisito previo) · prueba: los 14 `src/lib/gtm-lab/core/*.test.ts` y `test-count.test.ts`
- **CA-3** El núcleo solo importa `yaml`, `zod` y rutas relativas dentro de `core/`. `node:*` solo aparece en `core/node.ts` y en los tests.
  - Ningún archivo de `src/` fuera de `src/lib/gtm-lab/**/*.test.ts` importa `core/node.ts`.
  - Se mantiene el control positivo.
  - El test corre con `// @vitest-environment node` y funciona con espacios en la ruta.
  - · cubre E-3 (requisito previo) · prueba: `src/lib/gtm-lab/core/boundaries.test.ts`
- **CA-4** `framework.yaml` y `tasks.yaml` son byte a byte los de `44f385b`. Su SHA-256 está fijado en el test. · cubre E-3 (requisito previo) · prueba: `src/lib/gtm-lab/methodology.test.ts`
- **CA-5** `methodology.ts` exporta el framework y el catálogo ya validados, cargados con `?raw` y sin `node:fs`, en el entorno por defecto (jsdom). `tasksProblem` no devuelve ningún problema, y hay 7 fases, 98 tareas y 12 categorías. · cubre E-3 (requisito previo) · prueba: `src/lib/gtm-lab/methodology.test.ts`
- **CA-6** El gate pasa completo con todo el código nuevo.
  - No demuestra que `?raw` y `yaml` entren en el bundle del Worker (§16).
  - `vitest.eval.config.ts` y `scripts/gtm-lab/*.eval.ts` quedan **fuera de `tsc`** (no están en el `include` de `tsconfig.json`). Lo declaro aquí: el script solo orquesta, toda su lógica vive en `src/lib/gtm-lab/eval/`, que sí pasa por `tsc`, y el lint del gate sí cubre `scripts/`.
  - · cubre E-3 (requisito previo) · prueba: `scripts/factory/gate.mjs --ticket NK-0048`

### H-2: Como equipo, quiero llamar a un modelo concreto por OpenRouter y saber qué costó, qué modelo respondió y por qué paró, para que la IA de GTM Lab sea comparable y medible.
- **CA-7** `openrouterPinnedBody(model, system, user, opts)` (puro) construye un cuerpo con:
  - solo `model`, sin `models` de respaldo;
  - un único objeto `provider: { order: ["anthropic"], allow_fallbacks: false, require_parameters: true }`, para que responda Anthropic y no Bedrock ni Vertex. **No se reutiliza `openrouterRouting()`**, porque añade `models` (`gemini.ts:23-25`);
  - `reasoning: { effort }`, por defecto `"low"`;
  - `max_tokens`, por defecto 16000;
  - el system con `cache_control: { type: "ephemeral" }`;
  - `response_format` `json_schema` estricto si hay esquema;
  - `usage: { include: true }`.
  - **No hay respaldo de modelo ni de proveedor**: es una diferencia declarada con la línea base, que usaba `fallbacks: "default"` en Anthropic.
  - · cubre E-3, E-4 · prueba: `src/lib/ai-pinned.test.ts`
- **CA-8** `askPinned` devuelve `{ text, output, stopReason, model, provider, usage }`.
  - **`stopReason`:** es `native_finish_reason` cuando viene (los valores de Anthropic tal cual: `end_turn`, `max_tokens`, `refusal`…). Si no viene, se traduce `finish_reason`: `stop` → `end_turn`, `length` → `max_tokens` y `content_filter` → `refusal`. El resto se conserva tal cual.
  - **`output`:** es `JSON.parse(text)` solo si `stopReason` es `end_turn` y hay esquema. En cualquier otro caso es `null`, igual que en `anthropic.ts:42-50`.
  - **`model` y `provider`:** los que informa OpenRouter.
  - **`usage`:** `{ inputTokens, outputTokens, cacheReadTokens, costUsd, byok }`.
    - **Tokens:** `cacheReadTokens` = `prompt_tokens_details.cached_tokens` (0 si no viene); `inputTokens` = `prompt_tokens` − `cacheReadTokens`, con la misma semántica que `input_tokens` de Anthropic, que excluye la caché; `outputTokens` = `completion_tokens`. **[Por verificar]** en el piloto que `prompt_tokens` incluye la parte en caché. Si no la incluye, se corrige aquí antes de la pasada completa.
    - **BYOK:** se lee de `usage.is_byok`. Es una hipótesis sobre el nombre del campo que comprueba la primera llamada del piloto. `byok` es ese valor si es booleano; si no, `null`.
    - **Coste:**
      - con `byok === true`, `costUsd` = `cost_details.upstream_inference_cost`;
      - con `byok === false`, `costUsd` = `usage.cost`;
      - con `byok === null`, o si el valor que toca no viene o no es un número ≥ 0, `costUsd` = `null`. **No se cae de un campo a otro y nunca se estima.**
    - Fixtures del test: BYOK, no BYOK y sin marca.
  - **HTTP 200 con `error` en el cuerpo:** es un error del proveedor (lanza `ProviderError`, igual que `askOpenRouter`), nunca un fallo del modelo.
  - · cubre E-3, E-4 · prueba: `src/lib/ai-pinned.test.ts`
- **CA-9** Errores de `askPinned`:
  - **Sin `OPENROUTER_API_KEY`**, falla **sin llamar a la red** con «La IA no está configurada: falta la clave de OpenRouter (OPENROUTER_API_KEY).».
  - **Con un error HTTP**, usa `openrouterErrorMessage`, salvo el 404: este da «El modelo fijado (<modelo>) no está disponible en OpenRouter; revisa que tu clave del proveedor esté añadida en OpenRouter.», porque `OPENROUTER_MODEL` no se aplica aquí.
  - Nunca pasa a Gemini ni a Lovable.
  - · cubre E-3 · prueba: `src/lib/ai-pinned.test.ts`
- **CA-10** `ai-gateway.ts`, `gemini.ts`, `ai-fallback.test.ts` y `gemini.test.ts` no aparecen en el diff y sus tests pasan. `src/lib/AGENTS.md:38` añade la excepción de `askPinned`. · cubre E-3 · prueba: los dos tests existentes y la revisión del diff

### H-3: Como equipo, quiero la petición de sugerencia montada exactamente como en GTM Lab, para que el eval mida la ruta y no un prompt distinto.
- **CA-11** `buildSuggestCall(framework, deliverableId, saved)` devuelve `{ system, user, schema }` con `buildAiRequest` y `formJsonSchema`, sin texto añadido. Es una prueba de regresión. · cubre E-3 · prueba: `src/lib/gtm-lab/suggest-request.test.ts`
- **CA-12** Cada esquema de entregable con IA tiene `additionalProperties: false` y `required` completo en cada objeto. Es una prueba de regresión y no demuestra que OpenRouter lo acepte. · cubre E-3 · prueba: `src/lib/gtm-lab/suggest-request.test.ts`

### H-4: Como Fede, quiero comparar calidad y coste por OpenRouter cambiando una sola cosa: la ruta.
- **CA-13** Las comprobaciones de `eval-checks.mjs` están portadas como funciones puras y dan el mismo resultado sobre los ejemplos fijos de `eval-checks.test.mjs`, también `stopReason` `refusal` y `max_tokens`, que se portan con ellas. Las negativas se cuentan aparte para el umbral de `criterio.md` §5. · cubre E-3 · prueba: `src/lib/gtm-lab/eval/checks.test.ts`
- **CA-14** El tope sigue las reglas del original:
  - se comprueba **después** de cada llamada y la ejecución se detiene en cuanto el acumulado lo supera;
  - la llamada en curso puede rebasarlo;
  - el juez se salta si la generación ya lo supera.

  Además, cada pasada aprobada tiene un **registro propio** (`spend-<pasada>.json`):
  - **Importes aprobados:** son constantes en el módulo puro (`APPROVED_USD = { pilot: 1, reference: 1.5, full: 2 }`). No se pueden cambiar por variable de entorno ni por parámetro del script. Cambiarlos exige un cambio de código con el OK de Fede.
  - **Regla de inicio:** si lo que queda (lo aprobado menos lo acumulado) es ≤ 0, o el registro está en «sin dato», la ejecución **no empieza** y no hace ninguna llamada.
  - **Tope de una ejecución:** lo que queda por gastar. Con la regla de inicio, la suma de todas las ejecuciones de una pasada nunca supera lo aprobado más el coste de una llamada.
  - **Escritura:** el registro se actualiza después de cada llamada.
  - **Una sola ejecución a la vez por pasada:** se toma un bloqueo creando un archivo en exclusiva (`spend-<pasada>.lock`), que guarda el pid y la hora.
    - El bloqueo se libera en un `finally`.
    - Si al empezar ya existe un bloqueo (por ejemplo, tras un `kill`), la ejecución no empieza y el mensaje dice el pid, la hora y el archivo que hay que borrar a mano tras comprobar que esa ejecución ya no corre.
  - **Coste nulo:** deja el registro de la pasada en «sin dato» y la bloquea. Solo se levanta anotando en el registro un coste manual con su fuente (el panel de OpenRouter o el de Anthropic), quién lo aprobó y la fecha, con un comando del script (`GTM_LAB_EVAL_MODE=record-cost`). El informe copia esas anotaciones.
  - **Ruta del registro:** se pasa como parámetro a la lógica pura. El test usa un directorio temporal y solo el script resuelve `FACTORY_DIR/evidence/NK-0048/`.
  - **Límites declarados:** el registro no se versiona (`evidence/` está ignorado), así que borrarlo, o cambiar `FACTORY_DIR` (`scripts/factory/paths.mjs:9`), lo pone a cero. El informe de cada pasada copia el total.
  - Hay un test para cada regla: inicio con saldo ≤ 0, inicio en «sin dato», bloqueo existente, liberación en `finally` y anotación manual.
  - · cubre E-3, E-4 · prueba: `src/lib/gtm-lab/eval/budget.test.ts`
- **CA-15** El modo de dry-run (`GTM_LAB_EVAL_MODE=dry-run`, con cualquier `GTM_LAB_EVAL_PASS`) construye todas las peticiones de los fixtures sin red ni clave. Desde el script escribe en `FACTORY_DIR/evidence/NK-0048/<pasada>/` y desde el test, en un directorio temporal. · cubre E-3 · prueba: `src/lib/gtm-lab/eval/dry-run.test.ts`
- **CA-16** **El juez y el prompt son iguales en las dos rutas.**
  - El cuerpo del juez (`JUDGE_SYSTEM`, `JUDGE_SCHEMA`, `max_tokens` 8000 y `output_config`) vive en un módulo puro, sin efectos al importar: `src/lib/gtm-lab/eval/judge-request.ts`.
  - Lo usan el script y el test, contra una copia literal del de `eval-suggest.mjs:182-192` fijada en el test.
  - El juez es `claude-opus-5-5` por Anthropic directo, con la misma traducción a HTTP que CA-18 (sin la cabecera beta, porque el original usa `client.messages.create`). Su coste se calcula con la tabla `PRICES` del original, como en la línea base.
  - La llamada de red del juez solo está en el script (`scripts/gtm-lab/`).
  - · cubre E-3 · prueba: `src/lib/gtm-lab/eval/judge-request.test.ts`
- **CA-17** **Piloto por OpenRouter** (5 casos, $1, con el OK de Fede).
  - El informe en `FACTORY_DIR/evidence/NK-0048/pilot/` da, por caso: la nota, si pasa, `stopReason`, el modelo y el proveedor que respondieron, el coste y la latencia.
  - Los errores del proveedor (por ejemplo, un esquema rechazado) van aparte de los fallos del modelo.
  - Es una señal y no cierra E-3.
  - · cubre E-3 · prueba: manual con evidencia (U-7)
- **CA-18** **Pasada de referencia por Anthropic directo** (24 casos, prompt de `44f385b`, mismo juez, $1,50, con el OK de Fede).
  - El cuerpo de la generación lo arma un módulo puro, `src/lib/gtm-lab/eval/reference-request.ts`:
    - modelo `claude-sonnet-5-5`, `max_tokens` 16000;
    - `output_config` con esfuerzo `low` y formato JSON con el esquema;
    - el system con `cache_control`;
    - la cabecera `anthropic-beta: server-side-fallback-2026-07-01` y `fallbacks: "default"`;
    - la regla de salida de `anthropic.ts:42-50` (solo con `end_turn`).
  - Su test lo compara con una copia literal de `anthropic.ts:31-39` y `:42-50`, fijada en el test, pasada por la **traducción del SDK a HTTP**. Es la que hace `@anthropic-ai/sdk` 1.3.0 (`gtm-lab/supabase/package.json:8`):
    - `POST https://api.anthropic.com/v1/messages`;
    - cabecera `anthropic-version: 2026-10-21` (`client.js:972`);
    - `betas` sale del cuerpo y va como cabecera `anthropic-beta`, con los valores separados por comas (`messages.js:36`, `beta-messages-request.js:20`);
    - `fallbacks` y `output_config` van en el cuerpo;
    - cabeceras `x-api-key` y, si existe `ANTHROPIC_WORKSPACE_ID`, `anthropic-workspace-id`.
  - La llamada va con **`fetch`**: no se añade `@anthropic-ai/sdk` a NOKKO. Solo vive en el script.
  - **Sin reintentos.** El SDK reintenta 2 veces por defecto (`client.js:168`); aquí un error del proveedor detiene la ejecución (§8). Es una diferencia declarada.
  - Se registra el modelo que respondió. Si un respaldo responde con otro modelo, el caso se marca, se cobra con su precio de `PRICES` y, si no lo tiene, la pasada se detiene con «sin dato».
  - · cubre E-3 · prueba: `src/lib/gtm-lab/eval/reference-request.test.ts` para el cuerpo; manual con evidencia (U-8) para la pasada
- **CA-19** **Pasada completa por OpenRouter** (24 casos, $2, con el OK de Fede). Reglas fijadas antes de ejecutar:
  - **Qué ejecución cuenta:** la primera que termina los 24 casos. Todas las ejecuciones aparecen en el informe.
  - **Denominador:** 24 casos. Un caso sin nota (negativa o respuesta cortada) cuenta como «no pasa» y se lista aparte. Un error del proveedor detiene la ejecución (§8), que entonces no cuenta como completa. Las medias de **cada** criterio de `criterio.md` §5 se dan sobre los casos con nota, indicando cuántos son.
  - **Cierre de E-3**, con el criterio del PRD (`PRD:50`): la pasada alcanza el umbral de `criterio.md` §5. Nada más.
  - **Comparación con CA-18:** es informativa. Marca «requiere decisión de Fede» si OpenRouter pasa al menos 2 casos menos que la referencia, o si su media en accionable queda al menos 0,25 por debajo. Ninguna nota suelta decide.
  - Estos márgenes son una decisión, no una medida: no hay datos del ruido del juez (§3).
  - Si no alcanza el umbral, o si salta la marca, no se empieza el SDD 4 sin una decisión de Fede.
  - · cubre E-3 · prueba: manual con evidencia (U-9)

CA-17, CA-18 y CA-19 son manuales porque gastan dinero y necesitan claves. Es una excepción declarada a «cada CA con prueba automática» (`docs/sdd/EXECUTION.md:31`). Su lógica (tope, comprobaciones, juez y dry-run) sí tiene prueba automática en CA-13 a CA-16.

## 8. Casos límite y errores
- **YAML inválido o con referencias rotas:** lo cubren CA-2 y CA-5.
- **Tests de rutas de archivo con jsdom:** lo cubre la pragma `node` (CA-2 y CA-3).
- **Espacios en la ruta del repo:** CA-3.
- **`node:fs` en el bundle de la app:** CA-3. El Worker, en §16.
- **OpenRouter sin acceso al modelo (BYOK ausente, 404 o 401):** CA-9. La pasada se detiene y el error se informa como error del proveedor.
- **Negativa del modelo:** `stopReason` `refusal` (CA-8), contada aparte (CA-13).
- **Coste ausente:** se detiene y da «sin dato» (CA-14).
- **Esquema rechazado por el modo estricto:** error del proveedor en el piloto (CA-17).
- **Repetir una pasada tras un error:** el registro acumulado de CA-14 impide pasarse de lo aprobado.
- **Multitenant:** no aplica.

## 9. Experiencia y copy
No aplica: no hay pantallas. Textos:
- los errores de CA-9;
- los mensajes de `openrouterErrorMessage`, que ya existen;
- la salida del script de eval, en español.

## 10. Datos, permisos y privacidad
- Sin tablas, columnas, RLS ni GRANT nuevos.
- Los fixtures son ficticios. El gate no encontró emails, URLs ni teléfonos. **[Por verificar]**: los nombres de producto (§16).
- Las claves (OpenRouter para generar; Anthropic para la referencia y el juez, más `ANTHROPIC_WORKSPACE_ID` si aplica) se leen de un `.env.local` ignorado por git o de variables de entorno.
  - Nunca se escriben en la evidencia ni en los logs.
  - No se toca `.env` ni ninguna variable `VITE_`.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Generación por OpenRouter (piloto y completa) | Modelo barato fijado: es la llamada que usará la app y la que se mide | `anthropic/claude-sonnet-5.5` por OpenRouter, esfuerzo bajo, `max_tokens` 16000, system en caché, esquema estricto | Sin dato por OpenRouter. Por Anthropic directo (iter3, prompt anterior): unos $0,141 por 24 casos |
| Generación de referencia por Anthropic directo | Igual que la línea base: solo en el eval | `claude-sonnet-5-5`, esfuerzo bajo, petición de CA-18 (`fetch`, con la cabecera beta y `fallbacks`) | En iter3, con otro prompt: unos $0,141 por 24 casos |
| Juez del eval | Excepción declarada a «modelo caro solo en A fondo»: solo en el eval, mismo instrumento en todas las pasadas | `claude-opus-5-5` por Anthropic directo, petición de CA-16 | iter3: $0,6238 en 24 casos. Piloto de `usuarios-reales-b`: $0,1983 en total |

Total aprobable: $1 (piloto) + $1,50 (referencia) + $2 (completa).
- Las pasadas de 24 casos ya medidas costaron entre $0,74 y $0,92 (§3). Por eso la referencia sube a $1,50: con $1, el margen sería de solo el 8 % al 26 %.
- Si una pasada se detiene en el tope antes de terminar, no cuenta para CA-19, y E-3 queda abierto hasta que Fede decida.
- La app no hace ninguna llamada nueva.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Núcleo copiado con su procedencia, la pragma, el reformateo de prettier (en un commit aparte) y `yaml` en las dependencias | CA-1, CA-2 | `src/lib/gtm-lab/core/exports.test.ts` |
| U-2 | Metodología y `methodology.ts` | CA-4, CA-5 | `src/lib/gtm-lab/methodology.test.ts` |
| U-3 | Test de fronteras adaptado | CA-3 | `src/lib/gtm-lab/core/boundaries.test.ts` |
| U-4 | `ai-pinned.ts` y la línea de `AGENTS.md` | CA-7 a CA-10 | `src/lib/ai-pinned.test.ts` |
| U-5 | `buildSuggestCall` | CA-11, CA-12 | `src/lib/gtm-lab/suggest-request.test.ts` |
| U-6 | Eval portado: comprobaciones, tope con registro por pasada, juez, referencia, dry-run, fixtures y script | CA-13 a CA-16, CA-18 (cuerpo) | `src/lib/gtm-lab/eval/budget.test.ts` |
| U-gate | Gate completo en verde | CA-6 | No aplica |
| U-7 | Piloto por OpenRouter ($1, con OK) | CA-17 | No aplica (manual) |
| U-8 | Referencia por Anthropic directo ($1,50, con OK) | CA-18 | No aplica (manual) |
| U-9 | Completa por OpenRouter ($2, con OK) | CA-19 | No aplica (manual) |

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Copia, no paquete:** `moduleResolution: "Bundler"` resuelve los imports sin extensión.
- **Reformateo de prettier** en un commit aparte que solo reformatea. La revisión de CA-2 compara contra `44f385b` formateado con el `.prettierrc` de NOKKO.
- **Pragma de entorno por archivo, sin tocar `vitest.config.ts`.** Alternativa descartada: `environmentMatchGlobs` en `vitest.config.ts`, porque saca del alcance un archivo compartido.
- **`ai-pinned.ts`** importa `OPENROUTER_BASE` de `gemini.ts` y `openrouterErrorMessage` de `ai-gateway.ts`. Este último solo importa `@/lib/gemini`, que es puro, así que no arrastra código de servidor.
- **Script de eval:**
  - se ejecuta con `vitest.eval.config.ts`: entorno `node`, alias `@`, `include` solo de `scripts/gtm-lab/*.eval.ts`, `testTimeout` de 30 minutos e `import { it } from "vitest"`;
  - el modo y la pasada van por variables de entorno, porque vitest rechaza las opciones que no conoce. **El tope no**: sale de las constantes de CA-14.
    - `GTM_LAB_EVAL_MODE`: `dry-run`, `run` o `record-cost`.
    - `GTM_LAB_EVAL_PASS`: `pilot`, `reference` o `full`.
    - Cualquier otro valor detiene el script con un mensaje;
  - se lanza a mano, por ejemplo: `GTM_LAB_EVAL_MODE=run GTM_LAB_EVAL_PASS=pilot npx vitest run --config vitest.eval.config.ts`;
  - sin top-level await ni `process.exit` en los módulos que importan los tests: la lógica vive en `src/lib/gtm-lab/eval/` y el script solo orquesta.

## 14. Riesgos y dependencias
- **BYOK de Anthropic en OpenRouter:** **[Por verificar]** por Fede.
- **Coste con BYOK:** CA-8 prefiere `upstream_inference_cost`. Se comprueba con la primera llamada del piloto contra el panel de OpenRouter.
- **Equivalencia de `reasoning.effort` y de las negativas en OpenRouter:** no comprobada. La miden el piloto y la completa frente a la referencia.
- **Desvío de la letra del PRD:** el PRD dice «por `ai-gateway`» (§6.1 y E-3). Aquí es un archivo hermano, `ai-pinned.ts`, para no tocar el lint heredado ni `ask()`. Pide aprobación explícita (§15).
- **Criterio de CA-19:** el cierre de E-3 sigue la letra del PRD (solo el umbral). La comparación con la referencia, con sus márgenes (2 casos y 0,25), es una salvaguarda nueva que no está en el PRD. Pide aprobación (§15).
- **Lovable sincroniza `main`:** el trabajo va en `feat/gtm-lab-1-core` y nunca a `main` sin orden de Fede.
- **Divergencia con `gtm-lab`:** congelado (0005). El hash de CA-4 avisa.

## 15. Preguntas para Fede y para la revisión técnica
1. **Gasto en tres pasos, cada uno con su OK:**
   - piloto por OpenRouter, **$1**;
   - referencia por Anthropic directo con el prompt actual, **$1,50**;
   - completa por OpenRouter, **$2**.

   ¿Apruebas los tres? Recomendación: sí. Sin la referencia, el resultado mezclaría el cambio de ruta con el cambio de prompt.

2. **`ai-pinned.ts` fuera de `ai-gateway.ts`:** ¿lo apruebas como lectura válida de «por `ai-gateway`» del PRD? Recomendación: sí. Es el mismo proveedor y la misma clave, sin tocar `ask()`.
3. **Márgenes de CA-19** (2 casos menos o 0,25 menos en accionable para pedir tu decisión): ¿los apruebas? Recomendación: sí. No bloquean E-3, solo te avisan, y son lo bastante anchos para que una nota suelta no decida.
4. **Claves en local:**
   - una de OpenRouter, aparte, con un límite de $5 en su panel (solo acota la generación);
   - para la referencia y el juez, la de Anthropic que usó la línea base, con `ANTHROPIC_WORKSPACE_ID` si la tienes en un workspace con límite.

**Respuestas de Fede (2026-11-02):** aprueba las cuatro recomendaciones.
1. **Gasto:** piloto $1, referencia $1,50 y completa $2. Cada pasada sigue empezando solo cuando la lanza Fede.
2. **`ai-pinned.ts`:** se acepta como archivo hermano de `ai-gateway.ts`.
3. **Márgenes de CA-19:** 2 casos o 0,25.
4. **Claves:**
   - una de OpenRouter aparte, con un límite de $5;
   - la de Anthropic de la línea base, más `ANTHROPIC_WORKSPACE_ID` si aplica.

## 16. Pendiente de verificar
- **Nombres de producto de los fixtures:** que no coinciden con empresas reales. «VeriDoc API» sí coincidía (VeriDoc Global) y se sustituyó por «Zafrelio API» en NK-0065; el resto, sin coincidencias en una búsqueda rápida y sin garantía.
- **Acceso de la cuenta de OpenRouter a `anthropic/claude-sonnet-5.5`**, y si es BYOK o saldo. Lo comprueba Fede.
- **Coste en OpenRouter:** `usage.cost` y `cost_details.upstream_inference_cost`. Se comprueba con la primera llamada del piloto.
- **Negativas en OpenRouter:** qué `finish_reason` y `native_finish_reason` da ante una negativa de Anthropic. Lo recoge el piloto si aparece alguna; si no, queda sin comprobar.
- **Parámetros de la petición:** que OpenRouter respeta `reasoning.effort`, `cache_control` y el esquema estricto con `require_parameters`. Lo miden el piloto y la completa.
- **`ANTHROPIC_WORKSPACE_ID`:** si la clave de Anthropic lo necesita. Lo sabe Fede.
- **Proveedor que responde en OpenRouter:** que `provider.order` y `allow_fallbacks: false` dejan que responda Anthropic con BYOK. Lo registra el piloto (CA-8: modelo y proveedor).
- **Cómo marca OpenRouter una llamada BYOK:** la hipótesis es `usage.is_byok`, booleano (CA-8). Se comprueba con la primera llamada del piloto. Si el campo es otro, se corrige CA-8 antes de la pasada completa.
- **Fallo de la clave BYOK:** si OpenRouter pasa al saldo compartido cuando falla la clave BYOK. Lo decide un ajuste de cada clave en OpenRouter, no `allow_fallbacks`. Fede lo revisa en el panel. El informe marca por caso el valor de `byok`, así que un cambio de modo de cobro dentro de una pasada queda visible.
- **Tokens en OpenRouter:** si `prompt_tokens` incluye `cached_tokens` (CA-8). Se comprueba en el piloto.
- **Que la API de Anthropic acepta la petición hecha con `fetch`** igual que la del SDK (CA-18). La primera llamada de la referencia lo demuestra o lo desmiente.
- **Bundle del Worker:** que `?raw` y `yaml` entran en él. Se comprueba en el SDD 3.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
**Primera pasada, sobre la v1 (2026-11-01). Informe copiado sin editar. La v2 de este documento corrigió sus objeciones.**

- Veredicto del gate: Objeciones

- CA sin prueba posible o sin G-n:
  - **CA-16**: es manual (U-7) y no puede cerrar E-3. El umbral de `criterio.md` §5 (gtm-lab `docs/evaluacion/criterio.md:58-62`) se define «en los 24 casos» (rechazos, ≥22 que pasan, media ≥4 sin notas ≤2). Un piloto de 5 casos no alcanza ni refuta E-3. §4 dice «Cubre el PRD E-3», pero el SDD no incluye la pasada `--all`.
  - **CA-1**: «los mismos nombres exportados, ni uno más ni uno menos» no se puede probar en tiempo de ejecución para los tipos. `packages/core/src/index.ts:1-77` exporta unos 40 nombres que solo son tipos (`type Framework`, `type Step`…) y que `Object.keys(import(...))` no ve. Además, el paquete tiene un segundo punto de entrada `./node` (`packages/core/package.json` → `exports`). El test tiene que decir cómo compara los tipos (parsear `index.ts` o hacer una comprobación de tipos).
  - **CA-2**: el recuento no cuadra. En `core/src` hay 174 llamadas `it(`/`test(` literales, pero en **14** `*.test.ts`, no 13: `boundaries.test.ts` aporta 2. Hay además 12 bloques `it.each` que se expanden en tiempo de ejecución (`boundaries.test.ts:40,45`, `ai.test.ts:47,287`, `forms.test.ts:51,74`, entre otros). «Cuenta como mínimo 174 casos» no dice si cuenta en estático o en ejecución.
  - **CA-6**: no prueba lo que dice. `vite build` solo empaqueta lo que se alcanza desde las rutas o entradas. Un `methodology.ts` importado «solo desde un test, sin entrar en ninguna ruta» no entra en el bundle, así que ni `?raw` ni `yaml` pasan por el build SSR/Cloudflare.
  - **CA-1 a CA-6 y CA-10**: citan E-3 de forma nominal. Son requisitos previos y no miden «la IA no empeora». Se acepta como trazabilidad, pero no aportan evidencia para E-3.
  - **CA-12**: se cumple por construcción. `formJsonSchema` y `fieldSchema` (gtm-lab `packages/core/src/ai.ts:56-79`) emiten `additionalProperties: false` y `required` con todas las propiedades en cada objeto, incluidos los campos que en el formulario son opcionales (`forms.ts:11,20`, `required?: boolean`). Sirve como test de regresión, pero no dice nada de si OpenRouter o Anthropic aceptan el esquema.
  - **CA-11**: también es casi tautológico (envuelve `buildAiRequest`, `ai.ts:142-164`).

- [Por verificar] que sigue sin comprobarse:
  - **Semántica de los campos de OpenRouter** (no se puede comprobar sin red ni documentación). `reasoning.effort` puede no equivaler a `output_config.effort: "low"` de Anthropic, que es lo que usó la línea base (gtm-lab `supabase/functions/_shared/anthropic.ts:36`). Tampoco consta si `usage: { include: true }` sigue vigente, ni si `provider.require_parameters` combinado con `reasoning` y `response_format` estricto deja algún endpoint de Anthropic disponible.
  - **Coste con BYOK**: no consta si `usage.cost` refleja el coste real del modelo o solo la comisión de OpenRouter. Si es lo segundo, CA-8 y CA-14 registrarían un coste falso pero no nulo, y el «nunca se estima» no lo detectaría. No verificable.
  - **`?raw` + `yaml` en el build SSR de TanStack Start/nitro para Cloudflare**: no verificable aquí y CA-6 no lo ejercita. Sí está comprobado lo siguiente:
    - el tipado de `*?raw` existe en `vite/client` 8.1.5 (`node_modules/vite/client.d.ts:249`);
    - `tsconfig.json` incluye `vite/client`;
    - no hay ningún `?raw` en `src/` de `origin/main`.
  - **Fixtures**: en `scripts/eval/projects.json` y `scripts/eval/holdout.json` no hay emails, URLs ni teléfonos. Los nombres de producto parecen inventados, pero no puedo descartar sin red que alguno coincida con una empresa real (aparecen varios en los dos archivos). Se cita una marca real como herramienta (`projects.json:9-28`). No hay nombres de personas detectados.
  - **Acceso a `anthropic/claude-sonnet-5.5` y `anthropic/claude-opus-5.5` en la cuenta de OpenRouter, y su modo (BYOK o saldo)**: sin comprobar.
  - **Líneas sin tests**: medidas 1.455 (`wc -l` de los `.ts` que no son test), frente a «unas 1.380» del SDD. El resto de §3 se confirma:
    - 3.475 líneas en total;
    - dependencias `yaml ^2.9.1` y `zod ^4.6.7`;
    - imports solo `yaml`, `zod`, relativos, `node:` (en `node.ts` y en los tests) y `vitest` (en los tests);
    - `PRICES` en `eval-suggest.mjs:114`, juez `claude-opus-5-5` (`:111`), topes de $1 y $2 (`:109-110`);
    - 7 fases, y 98 tareas en 12 categorías;
    - línea base 4,17 y 22 de 24 (PRD-completo `:51`), $0,0059 en G-5;
    - `gemini.ts:16`, `:23` y `:75`; `ask()` devuelve solo texto (`ai-gateway.ts:11-13,78`); el esfuerzo no se envía a OpenRouter (`ai-gateway.ts:62-67`).

- Contradicciones con el código o con decisiones previas:
  1. **El lint del gate rompe U-1 y U-4.** `scripts/factory/gate.mjs:96-102` pasa eslint con prettier (`.prettierrc` con printWidth 100) sobre cada archivo tocado. Con la config de NOKKO:
     - el núcleo copiado da **322 errores de prettier** y 1 `no-regex-spaces` (`forms.test.ts:60`);
     - `eval-suggest.mjs` da 25, y `eval-checks.mjs`, 7;
     - **`ai-gateway.ts` de `origin/main` ya da 24** y `gemini.ts`, 57.

     Añadir `askPinned` a `ai-gateway.ts`, o el constructor a `gemini.ts`, hace fallar el lint del gate salvo que se reformatee el archivo entero. Reformatear el núcleo choca con «solo cambian las rutas de carga» (CA-2).
  2. **`boundaries.test.ts` copiado tal cual falla en NOKKO.** Usa `new URL(".", import.meta.url).pathname` (`:6`), que deja `%20` en la ruta. Los worktrees viven en `NOKKO GTM BRAIN/…`, con espacios, y `readdirSync` da ENOENT (comprobado con node 26.7.0). Además `packageDir = resolve(srcDir, "..")` (`:7`) permitiría imports relativos a todo `src/lib/gtm-lab/`, no «solo dentro de `core/`» como pide CA-3.
  3. **`askPinned` contradice una regla vigente.** `src/lib/AGENTS.md:38` dice que «every AI call … walks aiProviders()». La PRD §6.1 (IA) autoriza saltarse la cadena, pero el SDD no incluye actualizar `src/lib/AGENTS.md` y deja la regla en falso.
  4. **El eval portado no puede ejecutar la comprobación `finished`.** `eval-checks.mjs:19-20` exige `stopReason === "end_turn"`, y CA-8 define que `askPinned` devuelve solo `{ text, usage }`, sin motivo de parada. Haría falta devolver `finish_reason` y mapearlo, o todos los casos fallan o se saltan esa comprobación.
  5. **La generación no queda «igual que en GTM Lab» (H-3).** La línea base usó:
     - `max_tokens: 16000`;
     - `cache_control` en el system;
     - `fallbacks: "default"` del lado de Anthropic (`anthropic.ts:32-38`).

     CA-7 no fija `max_tokens` ni el caché del system, así que el piloto mezcla el cambio de ruta con cambios de petición. Además el **juez** también pasa de Anthropic directo (`eval-suggest.mjs:183-190`, `output_config`) a OpenRouter: cambian a la vez el generador y el medidor frente a la línea base.
  6. **CA-14 cambia la semántica del tope.** El original lo comprueba después de cada llamada (`eval-suggest.mjs:302,313`). «Antes de cada llamada» no puede impedir que la última llamada lo supere, porque no hay tabla de precios para estimarla. Y «se comprueba antes» choca con «se detiene al superarlo».
  7. **CA-9**: `openrouterErrorMessage` (`ai-gateway.ts:85-91`) no tiene mensaje para «falta la clave». Sin definir el estado, el 401 diría «La clave no es válida», que es engañoso.
  8. **La evidencia de CA-15 queda en una ruta compartida.** `dry-run.json` en `.factory/evidence/NK-0048/…` desde un test unitario escribe en el `.factory` compartido del worktree principal (`scripts/factory/paths.mjs`) cada vez que corre la suite completa.
  9. **El juez Opus es un «modelo caro» fuera de «A fondo»** (`docs/sdd/EXECUTION.md:32`). Está declarado como solo del eval (§11), así que se acepta como excepción explícita, no como contradicción.

  Sin conflicto: no hay proveedor nuevo (OpenRouter y los modelos de Anthropic ya están en `DEFAULT_OPENROUTER_MODELS`; `yaml` es una librería). `.env.local` lo ignora `*.local` en `.gitignore` y `.env` no se toca.

- Lo que esta revisión NO demuestra:
  - No se ejecutó ningún test ni `vite build`, ni el núcleo dentro de NOKKO, ni el vitest de gtm-lab. El 174 es un recuento estático.
  - No se llamó a OpenRouter: la semántica de `reasoning`, `usage`, `cost` con BYOK y la aceptación del esquema estricto quedan sin comprobar.
  - El lint se midió con eslint por stdin, usando el `node_modules` y la config del checkout `seller-strategy-studio` (difiere de `origin/main` solo en 2 líneas de react-hooks, que no afectan a prettier). No con el gate.
  - La revisión de fixtures se hizo por patrones, sin validar contra registros reales.
  - No se revisaron `tasks.yaml` ni los textos de la metodología a fondo.

**Correcciones aplicadas en la v2** (autor, 2026-11-01): todas las propuestas por el gate.
- `askPinned` en un archivo nuevo, `ai-pinned.ts` (CA-7 a CA-10).
- Ampliados `max_tokens`, el caché, `finishReason` y el coste con BYOK (CA-7, CA-8).
- El juez sigue por Anthropic directo (CA-16).
- E-3 lo cierra la pasada completa (CA-18) y el piloto es solo una señal (CA-17).
- Recuento y cambios permitidos en CA-2, con el reformateo de prettier.
- CA-6 sin afirmar lo del bundle del Worker, que pasa a §16.
- Exportaciones comparadas como texto (CA-1).
- El tope se comprueba después de cada llamada (CA-14).
- Mensaje para la falta de clave (CA-9).
- Evidencia del test en un directorio temporal (CA-15).
- `src/lib/AGENTS.md` dentro del alcance (CA-10).

**Segunda pasada, sobre la v2 (2026-11-01). Informe copiado sin editar. La v3 de este documento corrigió sus objeciones.**

- **Veredicto del gate: Objeciones.** La v2 resuelve la mayoría de las objeciones de la primera pasada. Las correcciones introducen o dejan al descubierto dos fallos bloqueantes: los tests portados no pueden pasar en el entorno jsdom de NOKKO con los cambios que permite CA-2, y la línea base G-4 se midió con otro prompt de sistema, así que «solo cambia el generador» (CA-16) es falso.

- **Objeciones de la primera pasada:**
  - CA-16 / E-3 con 5 casos: **resuelta.** CA-18 hace la pasada de 24 casos y CA-17 queda como señal.
  - CA-1 (tipos y `./node`): **resuelta en lo esencial.** «El test lee los dos archivos» choca con «lista de referencia fijada en el test». Un test de NOKKO no puede leer `~/gtm-lab`. Además, la cabecera `// From gtm-lab@…` en los tests no está entre los cambios permitidos de CA-2.
  - CA-2 (recuento): **resuelta.** Medido: 14 `*.test.ts`, 174 `it(`/`test(` literales y 12 `it.each`. El arreglo de `forms.test.ts:60` (`/forms:\n  da:\n…/` pasa a `\n {2}da:`) es exactamente equivalente.
  - CA-6 (bundle): **resuelta.** Pasa a §16.
  - CA-1 a CA-6 y CA-10 citados de forma nominal: **aceptada** (§4).
  - CA-11 y CA-12 tautológicos: **resueltas.** Quedan declaradas como regresión.
  - Lint del gate: **resuelta** con el archivo nuevo y prettier. El método de revisión de CA-2, en cambio, no funciona (ver contradicciones).
  - `boundaries.test.ts` con `%20`: **no resuelta.** `fileURLToPath` tampoco funciona bajo jsdom (ver contradicciones).
  - `src/lib/AGENTS.md:38`: **resuelta** (CA-10). Queda una tensión con el PRD (ver contradicciones).
  - `finished` sin motivo de parada: **resuelta a medias.** Mapear `stop` y `length` no cubre la negativa, y ningún CA define el paso de `text` a `output` (`anthropic.ts:42-50`).
  - Petición igual a la de GTM Lab: **resuelta** para `max_tokens`, caché y juez. Sigue sin declararse que se pierde `fallbacks: "default"` (`anthropic.ts:34-35`). Aparece una diferencia nueva y mayor: el prompt.
  - CA-14 (tope): **resuelta.** Faltan dos detalles (ver contradicciones).
  - CA-9 (falta la clave): **resuelta.**
  - CA-15 (ruta compartida): **resuelta**, con directorio temporal.
  - Juez Opus fuera de «A fondo»: **aceptada** como excepción (§11).

- **CA sin prueba posible o sin G-n:**
  - CA-17 y CA-18 son manuales, y está declarado. Aun así, `EXECUTION.md:31` exige prueba automática para cada CA.
  - CA-10 depende en parte de una revisión manual del diff.
  - CA-16: `judge-request.test.ts` solo puede comparar contra una copia literal fijada. El cuerpo original vive dentro de `judgeCase` (`eval-suggest.mjs:182-192`), no se exporta y está en otro repo. Además, CA-16 dice que el juez «vive solo en el script, fuera de `src/`», pero su test está en `src/`. Si el script conserva la estructura del original (top-level await y `process.exit`, `eval-suggest.mjs:18-21,73-77`), no se puede importar desde un test.
  - CA-13 sí se puede probar: `scripts/eval-checks.test.mjs` existe (268 líneas) y sus ejemplos son entradas fijas, incluidos `stopReason: "refusal"` y `"max_tokens"` (`:62-71`).
  - Todos los CA citan E-3 o E-4. Correcto según el PRD (`:50-51`).

- **[Por verificar] que sigue sin comprobarse:**
  - Qué `finish_reason` devuelve OpenRouter ante una negativa de Anthropic (`stop` o `content_filter`), y si trae `native_finish_reason`. Sin red no se puede comprobar.
  - `reasoning.effort`, `cache_control` y el esquema estricto con `require_parameters`; `usage.cost` frente a `upstream_inference_cost` con BYOK; acceso a `anthropic/claude-sonnet-5.5`. Todo bien declarado en §16.
  - Si la clave de Anthropic del juez necesita `ANTHROPIC_WORKSPACE_ID`. El original envía la cabecera `anthropic-workspace-id` (`anthropic.ts:20-27`) y la v2 (§13, `fetch`) no la menciona.
  - Fixtures (nombres de producto) y bundle del Worker: siguen en §16, correcto.

- **Contradicciones con el código o con decisiones previas:**
  1. **Los tests portados fallan con el vitest de NOKKO.** `vitest.config.ts` (origin/main) usa `environment: "jsdom"`. Lo reproduje con vitest 4.1.11 en el scratchpad:
     - bajo jsdom, `new URL("./x", import.meta.url)` da `http://localhost:3000/x`;
     - `readFileSync(URL)` y `fileURLToPath` fallan con «The URL must be of scheme file»;
     - con `// @vitest-environment node`, que NOKKO ya usa en `src/lib/migrations.pg.test.ts:1`, pasan.

     A esto le afectan 13 de los 14 tests del núcleo (`loadFrameworkFile(new URL("../../../methodology/…", import.meta.url))`), `boundaries.test.ts:6` y `eval-checks.test.mjs:22`. La pragma no está entre los 5 cambios permitidos de CA-2, así que CA-2 y CA-3 («funciona con espacios», §8) no se pueden cumplir tal como están escritos. `?raw` sí funciona bajo jsdom (comprobado).
  2. **La línea base G-4 no usó el prompt de `44f385b`.** G-4 (4,17 y 22 de 24) y G-5 ($0,0059) salen de `.factory/evidence/instrucciones-ia-iter3/full.json` (01:56; 22/24, accionable 4,17 y generación $0,1413/24 recalculados). Después, `ee410ee` (02:16, «Tighten AI suggestion instructions») cambió las instrucciones. Comparé `instrucciones-ia-iter3/dry-run.json` con `plan-dry-old2/dry-run.json` (10:09): el `system` difiere en 24 de 24 casos; `user` y `schema` son iguales. No hay ninguna pasada de 24 casos por Anthropic directo con el prompt posterior (`instrucciones-ia-iter4` tiene 6). CA-16 («solo cambia el generador») y CA-18 (comparar con G-4) cambian a la vez la ruta y el prompt.
  3. **El método de revisión de CA-2 no sirve.** El núcleo tiene 366 líneas de más de 100 caracteres y prettier (`.prettierrc` con printWidth 100) las va a partir. `git diff -w` no ignora los saltos de línea, así que el diff «ignorando los espacios» no queda limpio.
  4. **Tensión con el PRD.** La fila «IA» de §6.1 y E-3 (`PRD:50,70`) dicen «por `ai-gateway`». La v2 crea `ai-pinned.ts` fuera de `ai-gateway.ts` y cita §6.1 como autorización (CA-10). Técnicamente no hay problema: `ai-gateway.ts:4` solo importa `@/lib/gemini`, que es puro, así que importar `openrouterErrorMessage` no arrastra código de servidor. Pero el desvío respecto al PRD aprobado no está declarado. Además, el mensaje del 404 (`ai-gateway.ts:89`) remite a `OPENROUTER_MODEL`, que `askPinned` ignora.
  5. **CA-14 no recoge dos detalles del original.**
     - El juez se salta si la generación ya supera el tope (`eval-suggest.mjs:302`).
     - El tope es **por ejecución**, y en la completa `--cap` es obligatorio («lleva tú la suma», `:322-330`).

     CA-18 promete un «tope de $2» total, pero nada impide repetir la pasada tras un error del proveedor y pasarse de lo aprobado.
  6. **§11 dice «sin dato aparte» para el juez, pero el dato existe.** En iter3, el juez costó $0,6238 de $0,7651 (24 casos). En el piloto de `usuarios-reales-b`, el total fue $0,1983 y el caso más caro, $0,0518.
  7. **El gasto cabe.** Las cifras medidas (≈ $0,20 el piloto y ≈ $0,77 la completa, con el juez en torno al 80 %) caben en $1 + $2, aunque la generación por OpenRouter costara bastante más. El límite de $5 de la clave de OpenRouter (§15.2) solo acota la generación, no el juez.
  8. **Huecos menores.**
     - `projects.json` y `holdout.json` no figuran en el Alcance (§5), aunque CA-15 los necesita.
     - `vitest.eval.config.ts`, en la raíz, no lo lintea el gate (regex `^(src|scripts)/`, `gate.mjs:97`) ni lo comprueba `tsc` (`tsconfig.json` include). No falla, pero CA-6 no lo cubre.
     - El script tiene que fijar `environment: "node"` y el alias `@` para resolver `ai-pinned.ts`.

- **Lo que esta revisión NO demuestra:**
  - No se ejecutaron el núcleo ni el gate en NOKKO. Lo de jsdom se reprodujo con un test mínimo en el scratchpad, con vitest 4.1.11 de otro checkout de NOKKO (origin/main pide `^4.1.10`).
  - No hubo llamadas a OpenRouter ni a Anthropic.
  - El prompt de `44f385b` no se recalculó directamente. La diferencia de prompt se infiere de los dry-run de iter3 frente a los de las 10:09 y del commit `ee410ee`.
  - No se revisaron los textos de la metodología.

**Correcciones aplicadas en la v3** (autor, 2026-11-01): las seis propuestas del gate.
- `// @vitest-environment node` y la cabecera de procedencia entre los cambios permitidos (CA-2, CA-3).
- Revisión de CA-2 contra `44f385b` formateado.
- `test-count` se excluye a sí mismo.
- CA-1 sin «lee los dos archivos».
- Pasada de referencia por Anthropic directo con el prompt actual (CA-18), contra la que compara la completa (CA-19).
- `native_finish_reason`, `output`, modelo y proveedor (CA-8).
- 404 propio (CA-9).
- Juez en un módulo puro con cabeceras y `PRICES` (CA-16).
- Tope con el salto del juez y registro acumulado entre ejecuciones (CA-14).
- Costes medidos en §11.
- Desvío de «por `ai-gateway`» declarado para aprobación (§14, §15).
- Fixtures y `vitest.eval.config.ts` en el Alcance.
- Pérdida de `fallbacks` declarada (CA-7).

**Tercera pasada, sobre la v3 (2026-11-01). Informe copiado sin editar. La v4 de este documento corrigió sus objeciones.**

- **Veredicto del gate: Objeciones.** La v3 resuelve en el cuerpo (§1–16) casi todo lo de la segunda pasada. Pero lo nuevo deja tres huecos que bloquean:
  - la llamada de referencia «exactamente como `anthropic.ts`» (CA-18) no tiene módulo, dependencia ni test;
  - el registro acumulado de CA-14 no impide pasarse de lo aprobado tal como está escrito;
  - el criterio de cierre de CA-19 no tiene en cuenta el ruido del juez ni fija qué ejecución cuenta.

- **Objeciones de la segunda pasada:**
  - Contradicción 1 (jsdom): **resuelta.** Está en CA-2 punto 2 (`:118`) y en CA-3 (`:130`). Lo reproduje con vitest 4.1.11: con la cabecera en la línea 1 y la pragma en la línea 2, el test corre en `node`. El motivo es que vitest busca la pragma en todo el archivo (`node_modules/vitest/dist/chunks/cli-api.CnMVyzaz.js:100`, `content.match(/@(?:vitest|jest)-environment\s+…/)`).
  - Contradicción 2 (prompt de G-4): **resuelta en el diseño** (CA-18 y CA-19, §4 `:67-68`). Falta cómo se implementa CA-18 (ver contradicciones).
  - Contradicción 3 (método de revisión de CA-2): **resuelta** (`:125`, §13 `:251`).
  - Contradicción 4 (desvío del PRD y mensaje del 404): **resuelta** (§14 `:262`, §15.2, CA-9 `:158`).
  - Contradicción 5 (detalles del tope): **resuelta a medias.**
    - El salto del juez está (`:172`) y el registro acumulado también (`:175`).
    - Pero no se dice que el tope de cada ejecución sea lo que queda por gastar, y sin eso el registro no evita pasarse.
  - Contradicción 6 (coste del juez en §11): **resuelta.** Recalculado de la evidencia:
    - iter3: juez $0,6238, generación $0,1413 y total $0,7651;
    - piloto de `usuarios-reales-b`: $0,1983.
  - Contradicción 7 (el gasto cabe): **resuelta, con matiz.** Hay una pasada medida de 24 casos que costó $0,9235 (`usuarios-reales-b/full.json`). Ver «Contradicciones».
  - Contradicción 8 (huecos menores):
    - los fixtures están en el Alcance (`:83`), resuelto;
    - entorno `node` y alias `@` en §13 (`:255`), resuelto;
    - `vitest.eval.config.ts` está declarado, pero la afirmación sobre `tsc` es falsa (ver contradicciones).
  - CA-1 («lee los dos archivos» y la cabecera en los tests): **resuelta** (`:110`, CA-2 punto 1).
  - `finished`, negativa y `output`: **resuelta** (CA-8 `:151-152`).
  - Pérdida de `fallbacks`: **resuelta** (CA-7 `:148`).
  - CA-16 (módulo puro del juez y top-level await): **resuelta** (`:179-182`, §13 `:256`).
  - `ANTHROPIC_WORKSPACE_ID`: **resuelta** (CA-16 `:181`, §10 `:222`).
  - CA-17 y CA-18 manuales frente a `EXECUTION.md:31`: **aceptada** como excepción declarada (`:199`).
  - CA-10 en parte manual: **sigue igual**, se acepta.

- **CA sin prueba posible o sin G-n:**
  - **CA-18:** ninguna prueba automática fija el cuerpo de la generación de referencia. CA-16 solo cubre el juez y CA-11 solo `{system, user, schema}`. «Exactamente como en `anthropic.ts`» queda sin comprobar.
  - **CA-19:** «no queda por debajo de CA-18» no está bien definido.
    - La media de 24 notas enteras se mueve de 0,042 en 0,042. Un solo punto de diferencia en un caso decide si se cierra E-3.
    - No hay ningún dato del ruido entre ejecuciones. `instrucciones-ia-iter4` solo repite un caso 3 veces (4, 4, 4).
    - No se define sobre cuántos casos se calcula la media (el juez se salta los casos que fallan `finished`, `eval-suggest.mjs:302`).
    - No se dice qué ejecución cuenta si hay varias (CA-14 permite repetir hasta $2), así que se podría quedar la mejor.
  - **CA-14:** no dice que `budget.test.ts` use un registro en un directorio temporal (CA-15 sí lo dice para el dry-run). Si la lógica pura resuelve `FACTORY_DIR`, el test escribiría en el registro real.
  - Todos los CA citan E-3 o E-4. Correcto.

- **[Por verificar] que sigue sin comprobarse:**
  - Lo de §16 sigue igual:
    - nombres de los fixtures;
    - acceso o BYOK a `anthropic/claude-sonnet-5.5`;
    - `usage.cost` frente a `upstream_inference_cost`;
    - `finish_reason` y `native_finish_reason` ante una negativa;
    - `reasoning.effort`, `cache_control` y esquema estricto;
    - `ANTHROPIC_WORKSPACE_ID`;
    - bundle del Worker.
  - Nuevo: qué proveedor sirve la generación. CA-7 no fija `provider.order` ni `allow_fallbacks: false`, así que OpenRouter podría responder desde Bedrock o Vertex, o con saldo en lugar de BYOK. Cambiaría la ruta y el coste sin que CA-19 lo detecte.
  - Nuevo: qué hace CA-8 si `upstream_inference_cost` viene como `0` o `null` sin BYOK. «Si existe» no lo define.
  - Nuevo: qué hace CA-8 con un HTTP 200 que trae el error en el cuerpo. Se contaría como fallo del modelo y no del proveedor (CA-17 `:186`).

- **Contradicciones con el código o con decisiones previas:**
  1. **CA-18 frente al Alcance.** `anthropic.ts` no tiene código de Deno: solo importa tipos de `./core.gen.js` y de `@anthropic-ai/sdk` (`:1-2`). Aun así, la llamada usa el SDK: `client.beta.messages.create`, `betas: ["server-side-fallback-2026-07-01"]` y `fallbacks` (`:31-39`).
     - El eval original carga el SDK desde `supabase/package.json` (`eval-suggest.mjs:232-235`).
     - NOKKO no tiene `@anthropic-ai/sdk` en `package.json`, y §5 solo añade `yaml` (`:78`).
     - Para que sea «exactamente igual» hay que añadir el SDK o rehacer la llamada con `fetch` y la cabecera `anthropic-beta`. §3 (`:37`) ni siquiera menciona `betas`.
     - Con `fallbacks: "default"` puede responder otro modelo, y entonces `costUsd` del original lanza «Sin precio» (`eval-suggest.mjs:121-122`).
  2. **CA-6 (`:136`) es falso en lo de `tsc`.** `vitest.config.ts` sí está en el `include` de `tsconfig.json` y el gate pasa `npx tsc --noEmit` (`gate.mjs`, «typecheck»). Además, `eslint .` (`package.json` «lint») lintea los archivos de la raíz. `vitest.eval.config.ts` y `scripts/gtm-lab/*.eval.ts` quedan fuera de `tsc`. No hay conflicto de `include`:
     - el `include` principal es `src/**/*.{test,spec}.{ts,tsx}`;
     - `.eval.ts` no cuenta como test para las guardias del gate (`gate.mjs:68`);
     - el lint del gate sí lo cubre (`scripts/`).
  3. **El script de §13 no funciona tal como está descrito con vitest.** Lo reproduje:
     - el `testTimeout` por defecto de 5 s corta la ejecución («Test timed out in 5000ms»);
     - `vitest run --config vitest.eval.config.ts --pilot` falla con «CACError: Unknown option `--pilot`», y lo mismo pasaría con `--dry-run` y `--cap` (CA-15 `:177`). El modo y el tope tienen que ir por variables de entorno;
     - sin `globals`, hace falta importar `it`.

     `import.meta.dirname`, que usa `paths.mjs`, sí funciona bajo vitest con entorno `node` (comprobado).
  4. **CA-19 es más estricto que el PRD sin declararlo.** El PRD E-3 (`PRD:50`) solo exige alcanzar el umbral. El «no por debajo de CA-18» es un criterio nuevo y §14 no lo pide aprobar.
  5. **CA-14 y el registro compartido.**
     - `FACTORY_DIR` es el `.factory` del worktree principal, sea cual sea el worktree desde el que se ejecute (`scripts/factory/paths.mjs:5-9`). Ese worktree es hoy `seller-strategy-studio`, en `feat/software-factory`, y `evidence/` está ignorado (`.factory/.gitignore:1`).
     - El registro es un único `spend.json` que se lee y se reescribe, sin bloqueo. Dos pasadas a la vez pierden una de las escrituras.
     - No está versionado: borrar `evidence/` lo pone a cero.
     - Que «se niega a empezar si ya alcanzó lo aprobado» no impide pasarse. Una ejecución que empieza con $0,90 de $1 acumulados tiene un tope propio de $1 y puede llegar a unos $1,9.
     - No dice qué pasa con el acumulado si un coste nulo detiene la pasada.
  6. **§11 (`:233`) solo cita la pasada barata.** Hay pasadas de 24 casos medidas en $0,74, $0,76, $0,77 y $0,92. Con $1 para la referencia, el margen va del 8 % al 26 %. Si la referencia se detiene en el tope, CA-19 se queda sin comparación y E-3 no puede cerrarse. Esto no está dicho.
  7. **Erratas de §3.**
     - `:28`: son 12 tests, no 13, los que cargan la metodología; 13 usan `import.meta.url` como ruta (contando `boundaries.test.ts`) y `ice.test.ts` no usa ninguno.
     - `:52` resume el umbral sin «respuesta cortada», sin «ninguna invención» y sin «en cada criterio» (`criterio.md:60-62`).
     - El resto se confirma: 3.475 y 1.455 líneas, 14 tests, 174 llamadas y 12 `it.each`, 366 líneas largas, y las referencias `anthropic.ts:20-27,32-38,42-50` y `eval-suggest.mjs:182-192,302,313,322-330`.
  8. **Sin conflicto real entre CA-1 y CA-2 punto 2.** «Primera línea de código» frente a «empieza con la cabecera» es solo de redacción: la pragma funciona en la línea 2.

- **Lo que esta revisión NO demuestra:**
  - No se ejecutaron el núcleo, el gate ni ninguna llamada a OpenRouter o Anthropic.
  - Lo de vitest (pragma, timeout, opciones de la línea de comandos y `import.meta.dirname`) se reprodujo en el scratchpad con vitest 4.1.11 de otro checkout de NOKKO.
  - No comprobé que `buildAiRequest` de `packages/core@44f385b` dé lo mismo que el `core.gen.js` que usa el eval original. `buildSuggestCall` solo devuelve `{system, user, schema}`: el `cache_control` lo pone quien llama.
  - No medí el ruido del juez ni de la generación.
  - No consulté la documentación de OpenRouter.

**Correcciones aplicadas en la v4** (autor, 2026-11-01): las seis propuestas del gate.
- **CA-18:** módulo puro `reference-request.ts`, con su test contra la copia literal de `anthropic.ts:31-39` y `:42-50`. La llamada va con `fetch` y la cabecera beta, sin añadir el SDK. Se registra el modelo que responde.
- **CA-14:**
  - el tope de cada ejecución es lo que queda de lo aprobado;
  - un registro y un bloqueo por pasada;
  - el registro se escribe después de cada llamada;
  - un coste nulo bloquea la pasada;
  - la ruta del registro se pasa como parámetro y el test usa un directorio temporal.
- **CA-19:**
  - cuenta la primera ejecución completa, y todas van al informe;
  - el denominador es de 24 casos;
  - el cierre de E-3 sigue la letra del PRD;
  - la comparación con la referencia pasa a ser una marca informativa, con márgenes declarados como decisión y llevados a §14 y §15.
- **§13:** variables de entorno, `testTimeout` e `import { it }`.
- **CA-6:** se declara qué queda fuera de `tsc`.
- **§3:** corregidos los 12 tests, el umbral completo, el SDK de la línea base y el rango de coste.
- **CA-7:** se fija el proveedor (`order: ["anthropic"]`, `allow_fallbacks: false`).
- **CA-8:** BYOK, coste inválido y HTTP 200 con error.
- **Referencia:** sube a $1,50, y queda dicho qué pasa si se detiene en el tope.

**Cuarta pasada, sobre la v4 (2026-11-02). Informe copiado sin editar. La v5 de este documento corrige sus objeciones. No hay quinta pasada.**

- **Veredicto del gate: Objeciones.** La v4 resuelve en el cuerpo (§1–16) casi todo lo de la tercera pasada. Quedan tres huecos bloqueantes, los tres en CA-14 y CA-8:
  - con la comprobación «después de cada llamada», CA-14 no dice que una ejecución no empieza si ya no queda saldo, así que la cota «lo aprobado más una llamada» (`:183`) no se cumple;
  - no hay forma definida de desbloquear una pasada: ni el bloqueo que deja una ejecución que se cae, ni el bloqueo por coste nulo. Además, ese coste nulo es justo lo que se espera en la primera llamada del piloto (§14 `:288`, §16 `:317`);
  - «OpenRouter marca la llamada como BYOK» (`:159`) no nombra ningún campo, así que no se puede probar con fixtures. Si falla, cae en `usage.cost` sin avisar.

- **Objeciones de la tercera pasada:**
  - CA-18 sin módulo, dependencia ni test: **resuelta**. Están `reference-request.ts`, `fetch` y el test (`:202-212`). Falta la regla de traducción del SDK a HTTP (ver contradicciones) y §5 `:85` no menciona el módulo.
  - CA-14, el registro no impide pasarse de lo aprobado: **resuelta a medias**. El tope de cada ejecución ya es lo que queda (`:183`). Pero se perdió la regla de la v3 «se niega a empezar si ya alcanzó lo aprobado»: en §1–16 no hay ninguna coincidencia de «niega» ni de «empezar».
  - CA-14, test con directorio temporal: **resuelta** (`:187`).
  - CA-19, ruido del juez y qué ejecución cuenta: **resuelta** (`:214-218`).
  - Contradicción 2 (CA-6 y `tsc`): **resuelta** (`:139`).
  - Contradicción 3 (script con vitest): **resuelta** (§13 `:281-284`). Pero «el tope por variable de entorno» (`:282`) choca con CA-14.
  - Contradicción 4 (CA-19 más estricto que el PRD): **resuelta**. El cierre sigue `PRD:50` (`:216`) y los márgenes van a aprobación (§14 `:291`, §15.3).
  - Contradicción 5 (registro compartido): **resuelta** en lo de un registro por pasada, la escritura y el bloqueo. Sigue abierto que borrar `evidence/` lo pone a cero: está declarado (`:188`) y se acepta.
  - Contradicción 6 (coste de §11): **resuelta** (`:256-258`).
  - Contradicción 7 (erratas de §3): **resuelta** (`:28`, `:52`).
  - Proveedor sin fijar: **resuelta** (CA-7 `:151`, §16 `:316`).
  - `upstream_inference_cost` a `0` o `null`: **resuelta** (`:161`).
  - HTTP 200 con `error` en el cuerpo: **resuelta** (`:162`). Coincide con `ai-gateway.ts:77`.

- **CA sin prueba posible o sin G-n:**
  - **CA-8 (BYOK):** `ai-pinned.test.ts` no puede construir un fixture «BYOK» porque el SDD no dice qué campo lo indica. §16 `:317` lo admite.
  - **CA-14:** sin una regla para desbloquear, el caso «coste nulo bloquea hasta que Fede decida» no tiene salida que se pueda probar.
  - CA-17, CA-18 (la pasada) y CA-19 son manuales: es una excepción declarada (`:222`) y se acepta. CA-10 es en parte manual y se acepta.
  - Todos los CA citan E-3 o E-4.

- **[Por verificar] que sigue sin comprobarse:**
  - Lo de §16 sigue igual: nombres de los fixtures, acceso y BYOK a `anthropic/claude-sonnet-5.5`, `cost` frente a `upstream_inference_cost`, negativas, `reasoning.effort`, caché y esquema estricto, `ANTHROPIC_WORKSPACE_ID` y bundle del Worker.
  - Nuevo, sin comprobar y sin red: si OpenRouter, cuando falla la clave BYOK, pasa a su saldo compartido. Eso lo decide un ajuste de cada clave en OpenRouter, no `allow_fallbacks`. No cambia la ruta (sigue siendo Anthropic), pero sí el modo de cobro dentro de una misma pasada.
  - Nuevo: cómo se pasan los tokens de OpenRouter a `inputTokens` y `cacheReadTokens`. Por ejemplo, si `prompt_tokens` incluye la parte en caché. CA-8 no lo dice, y E-4 lo reutilizará.

- **Contradicciones con el código o con decisiones previas:**
  1. **CA-14, regla de inicio.** El tope se comprueba después de cada llamada (`:178`, igual que `eval-suggest.mjs:302,313`). Una ejecución que empieza con saldo ≤ 0 hace al menos una llamada antes de pararse, y cada repetición añade otra. Eso contradice «nunca supera lo aprobado más el coste de una llamada» (`:183`).
  2. **CA-14 frente a §13.** §13 `:282` dice que «el modo, el tope y la pasada van por variables de entorno». CA-14 calcula el tope a partir de lo aprobado menos lo acumulado, y no dice dónde viven los importes aprobados ($1, $1,50 y $2). Si el tope o lo aprobado se pueden cambiar por variable de entorno, el registro no acota nada.
  3. **CA-14, bloqueo que queda tras una caída.** «Si existe, la ejecución no empieza» (`:185`), pero no se dice quién lo libera ni cuándo: tras un `Ctrl-C`, el `testTimeout` de 30 min o un `kill`. Tampoco se dice cómo se levanta el «sin dato» (`:186`). Además, `FACTORY_DIR` se puede cambiar por variable de entorno (`scripts/factory/paths.mjs:9`): con otro valor sale otro registro, que empieza a cero.
  4. **CA-18, equivalencia en HTTP.** Existe, pero no es la copia literal:
     - el SDK 1.3.0 (`supabase/package.json:8`, `^1.3.0`) saca `betas` del cuerpo (`resources/beta/messages/messages.js:36`) y lo envía como cabecera `anthropic-beta`, separando los valores con comas (`lib/internal/beta-messages-request.js:20`);
     - fija `anthropic-version: 2026-10-21` (`client.js:972`);
     - `fallbacks` y `output_config` son campos del cuerpo (`messages.d.ts:7148`, `:3994`);
     - el calificador `beta` solo lo usa el middleware y no añade ningún parámetro a la URL (`lib/middleware.js:146`);
     - el SDK reintenta 2 veces por defecto (`client.js:168`) y un `fetch` no.

     CA-18 y CA-16 dicen «`anthropic-version`», pero sin el valor, y el test «contra la copia literal de `:31-39`» necesita esa traducción escrita. El juez original también va por el SDK (`client.messages.create`, `eval-suggest.mjs:183-190`).
  5. **CA-7, redacción.** `provider` aparece en dos viñetas (`:145`, `:151`). Tiene que ser un solo objeto: `{ order: ["anthropic"], allow_fallbacks: false, require_parameters: true }`. Es coherente con `openrouterRouting` (`gemini.ts:23-25`, que solo pone `require_parameters`), siempre que **no** se reutilice esa función, porque añade `models`.
  6. **Restos de la v3 e incoherencias menores:**
     - §5 `:85` no incluye `reference-request.ts`;
     - `GTM_LAB_EVAL_MODE` toma `pilot` (`:283`) y `dry-run` (`:190`), y además está `GTM_LAB_EVAL_PASS`, sin decir qué valores admite cada una;
     - §8 `:229` dice que un error del proveedor detiene la pasada, y CA-19 `:215` cuenta «error» como caso sin nota dentro de una ejecución que termina los 24: con «la primera que termina» eso no puede pasar;
     - CA-19 solo define la media en accionable, pero `criterio.md:60-62` exige una media ≥ 4 en **cada** criterio;
     - §3 `:20` cita solo la primera y la segunda pasada.
  7. **Gasto y búsqueda de restos (sin conflicto):**
     - $1 + $1,50 + $2 = $4,50, igual en §11 `:256` y §15 `:297-299`;
     - las pasadas de 24 casos medidas cuestan entre $0,7364 y $0,9235 y duran entre 4,5 y 6,3 min (`.factory/evidence/*/full.json`), así que caben en los 30 min y en $2 (unas dos ejecuciones);
     - el límite de $5 de OpenRouter solo acota la generación, y la referencia y el juez los acota solo el registro (declarado en §15.4);
     - en §1–16 no aparece ninguno de estos restos: «no queda por debajo», «$1 (referencia)», «13 de los 14», «spend.json», «--pilot» ni «--dry-run». `--cap` solo aparece en `:49`, y ahí describe el original (correcto).

- **Lo que esta revisión NO demuestra:**
  - No se ejecutó nada: ni tests, ni el gate, ni el bloqueo con creación exclusiva, ni ninguna llamada a OpenRouter o Anthropic.
  - La forma del SDK se leyó en el código de `@anthropic-ai/sdk` 1.3.0 instalado en `gtm-lab/supabase/node_modules`. No se comprobó que la API acepte la misma petición hecha con `fetch`.
  - No consulté la documentación de OpenRouter. El nombre del campo BYOK y lo que pasa cuando falla la clave BYOK son de memoria, no están verificados.
  - No medí el ruido del juez.

**Correcciones aplicadas en la v5** (autor, 2026-11-02): las seis propuestas del gate.
- **CA-14:**
  - regla de inicio: si no queda saldo o el registro está en «sin dato», no se hace ninguna llamada;
  - los importes aprobados son constantes de código y el tope ya no va por variable de entorno;
  - el bloqueo guarda el pid y la hora, se libera en `finally` y, si queda tras una caída, se indica cómo borrarlo a mano;
  - el «sin dato» solo se levanta con una anotación manual de coste, con su fuente y quién la aprobó (`record-cost`);
  - se declara el límite de `FACTORY_DIR`;
  - hay un test para cada regla.
- **CA-8:**
  - BYOK por `usage.is_byok`, como hipótesis que comprueba el piloto, sin pasar de un campo de coste a otro;
  - fixtures con BYOK, sin BYOK y sin marca;
  - traducción de los tokens.
- **CA-18 y CA-16:** traducción del SDK a HTTP escrita (versión, cabecera beta, cuerpo y cabeceras), sin reintentos y declarado así. `reference-request.ts` entra en §5.
- **CA-7:** un solo objeto `provider`, sin reutilizar `openrouterRouting`.
- **§13 y CA-15:** valores definidos de `GTM_LAB_EVAL_MODE` y `GTM_LAB_EVAL_PASS`.
- **CA-19:** un error del proveedor ya no cuenta en el denominador y se dan las medias de cada criterio.
- **§3:** cita las cuatro pasadas.
- **§16:** cuatro comprobaciones nuevas para el piloto.

## 18. Delta de implementación (lo rellena el agente al entregar)
**Estado: Entregado** (2026-11-06). U-1 a U-9 hechas en `feat/gtm-lab-1-core` @ `f854d61` (rebasada sobre `main`; `base_commit` real `47ec72c`, no `991051192db6`), sin push; integrada en `7d8c53a` (`integration/20261106`) con gate independiente PASS. Paquete de resultado: `.factory/evidence/NK-0048/result.md`.
- **CA-3:** la regla «nada de `src/` fuera de los tests importa `core/node.ts`» va en `src/lib/gtm-lab/node-entry.test.ts`, para no tocar `boundaries.test.ts` más allá de los 7 cambios de CA-2.
- **Módulos puros añadidos a los de §5:** `eval/anthropic-http.ts` (cabeceras, versión, `PRICES`, `costUsd`), `eval/cases.ts` (fixtures con `?raw`, `CALIBRATION`, modelo fijado, nombre de esquema `suggestion`) y `eval/report.ts` (umbral de `criterio.md` §5 y comparación de CA-19, donde «pasan» son las comprobaciones automáticas).
- **`costUsd`:** devuelve `null` para un modelo sin precio, en lugar de lanzar un error como el original, así que la pasada queda en «sin dato».
- **`record-cost`:** usa `GTM_LAB_EVAL_COST_USD`, `_SOURCE`, `_APPROVED_BY` y `_DATE` (por defecto, hoy).
- **Claves:** `.env.local` del worktree desde el que se lanza, o el entorno.
- **Gate:** los 2 fallos de la base `9910511` (`migrations-journal`, 0073 duplicada, y `field-coverage`, `platform_admins`) los cubrió NK-0049, ya en `main`. Tras el rebase, PASS sobre `0a290d0` y sobre el merge de integración `7d8c53a`.
- **§16, fixtures:** «VeriDoc API» coincidía con una empresa real (VeriDoc Global). Fede decidió renombrarlo; NK-0065 lo cambia por el nombre ficticio «Zafrelio API» (búsqueda web rápida sin coincidencias, sin garantía).
- **Pasadas reales (U-7 a U-9, lanzadas por Fede el 2026-11-06):** gasto medido $1,6616 en total ($0,1670 piloto de $1; $0,7386 referencia de $1,50; $0,7560 completa de $2), sin «sin dato». Comprobado en real: modelo fijado y esquema estricto con `require_parameters`, proveedor Anthropic sin respaldo, `prompt_tokens` incluye la caché y la API de Anthropic acepta la petición con `fetch`.
- **E-3 / CA-19:** la pasada completa dio 21 de 24 (mínimo 22) y 2 casos menos que la referencia, así que salta la marca «requiere decisión de Fede». Fede lo aceptó el 2026-11-06 con 21/24: aceptado por decisión, no por umbral.
- **Sigue sin comprobar (§16):** rama BYOK=true (solo se vio `is_byok=false`), `reasoning.effort`, fallo de la clave BYOK al saldo compartido, negativas (no apareció ninguna), cuadre del coste del juez con la consola de Anthropic y bundle del Worker con `?raw` y `yaml` (SDD 3). Sin pasada de pago para BYOK ni `reasoning.effort`.
- **Pruebas del autor:** el fail-first del autor no se archivó; lo sustituye la prueba independiente del gate de `f854d61`.
- **Seguimiento:** las objeciones bajas 2 a 6 del gate y este cambio de fixture van en NK-0065.
