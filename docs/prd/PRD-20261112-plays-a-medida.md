# PRD-20261112-plays-a-medida · [Iniciativa] Plays a medida

**Tipo:** Iniciativa · **Prioridad propuesta:** Media-alta (reutiliza catálogo, estado por empresa, puertas, herramientas del asistente y conectores que ya existen; el coste es de ingeniería y de IA por propuesta; no depende de proveedores nuevos en la tanda 0; sin datos de uso, es una apuesta declarada)
**Estado:** Borrador · **Pide:** Fede (entrevista, 2026-11-12) · **Aprueba:** Fede · **Fecha:** 2026-11-12
**Ticket:** NK-0171 (LOGGED, `.factory/ledger.json`, registrado el 2026-11-12)
**SDD que lo desarrollan:** pendiente (sección 8)
**Cola del sprint siguiente (decidida por Fede, 2026-11-12):** NK-0156, esta iniciativa, NK-0167, NK-0168

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
Hoy NOKKO tiene 28 plays fijos en código, escritos de forma general, y solo 12 se pueden construir con datos que ya guarda; los demás están bloqueados. Una empresa cuya estrategia pide otra cosa (otro nicho, otra señal, otra zona) no tiene dónde ponerlo: no puede pedir un play pensado para su ICP, su oferta y su mercado, ni sabe si la señal en la que se apoya es verificable, está fresca o se puede probar con una muestra pequeña antes de escalar.

Fede quiere replicar la **estructura** del catálogo público de plays de Glider (63 plays, cada uno con disparador, fuentes por paso, evidencia citada, entregable, verificación manual y prueba) y usarla como base para **crear plays nuevos alineados con la estrategia de cada empresa**, dentro del flujo de NOKKO. Límite duro: se replican estructura y patrones con palabras propias; no se copia ningún nombre, hook ni mensaje de ejemplo de Glider.

## 2. Para quién
- **Owner y Sales Leader** de cada empresa: proponen, aprueban, activan y pausan plays a medida (igual que hoy con `set_play_enabled`, `src/lib/plays/status.ts:39`).
- **Resto de miembros:** ven los plays y reciben sus sugerencias; no aprueban.
- Mercado global, con clientes de nicho y B2B general (decisión 7). No se diseña para un solo sector.

## 3. Evidencia y por qué ahora
**Qué se ha leído** (solo lectura, `main` @ 48f05ff, 2026-11-12):
- Análisis de los 63 plays: `docs/prd/annex/glider-plays-analysis-20261112.md`. **Lo hizo un modelo pequeño resumiendo páginas**, no es lectura literal; solo se comprobó el texto en 2 páginas. Los recuentos de abajo son suyos y valen como orden de magnitud, no como dato.
- Código a reutilizar: `src/lib/plays/{types,catalog,teams,gating,gates,run-log,recommend,status}.ts`; migración `drizzle/migrations/0077_plays_library_core.sql` (`play_states`, `play_runs`); herramientas `src/lib/agent/tools/plays.ts`; reglas de `src/lib/AGENTS.md` (nunca inventar datos, cada handler filtra por `org_id`, la IA propone y el código puro valida y ordena, nada se envía solo).
- **Diagnóstico de plays** (`src/lib/plays/diagnosis.ts`, `src/lib/agent/tools/play-diagnosis.ts`, SDD-20261112-diagnosis-in-chat): **no está en `main` todavía**; existe en la rama `integration/sprint8b-diagnosis-20261112`. Esta iniciativa lo trata como dependencia suave: [Por verificar] su estado de integración antes de redactar el SDD 3.

**Lo que el análisis dice del formato de Glider (y por qué sirve):**
1. Cada play arranca de un **evento verificable** (un cambio público), no de un segmento.
2. Cada dato del mensaje lleva el **número del paso** donde se obtuvo: el mensaje es auditable.
3. Antes de escribir se construye un **artefacto útil** (una página, una comparativa, una lista); la petición es pequeña.
4. Hay un **paso de verificación manual** con riesgos concretos.
5. Hay un **test definido antes de enviar**, con muestra y umbral.

**Lo que el análisis dice que falla en Glider y aquí se corrige:**
- Solo 17 de 61 declaran una ventana de frescura; en 25 de 61 la muestra del test no coincide con la base del umbral; ninguna página da resultados reales (todo son metas). Son cifras de un resumen automático.
- Portabilidad: 17 de 63 plays serían portables tal cual a mercado hispanohablante o UE (grado A), 30 necesitan fuente local equivalente (B) y 16 son solo de EE. UU. (C). La portabilidad depende del tipo de fuente: web abierta, reseñas y foros salen A; registros oficiales salen B o C.

**Lo que NOKKO no tiene y esta iniciativa define** (comprobado en el código leído):
| Falta | Hoy | Consecuencia |
|---|---|---|
| Cadena de evidencia con cita por paso | `play_runs` guarda solo ids y un motivo corto de descarte (`run-log.ts:21`) | No se puede auditar de dónde sale cada afirmación de un mensaje |
| Entregable de una página como borrador | `OUTPUTS` = suggestion, task, draft (`catalog.ts`); no hay un tipo de borrador «página» | El valor previo al contacto no tiene dónde vivir |
| Verificación manual explícita | No existe como paso | Un humano aprueba el borrador, pero no hay lista de riesgos concretos por play |
| Diseño de prueba (muestra y umbral) | No existe | No hay forma de decidir qué es éxito antes de escalar |
| Parámetros por empresa (zona, oficio, umbrales) | `play_states.settings` es jsonb libre, sin validar | Un play general no se adapta |
| Ventana de frescura obligatoria | Las señales de cuenta tienen fecha, pero ningún play obliga a declarar una | Una señal vieja puede parecer actual |
| Comprobación de fuente contra los conectores de la empresa | El estado `bloqueado` es una etiqueta fija en código (`BLOCKERS`) | No se calcula contra lo que la empresa tiene conectado |
| Planes propios de la empresa | El catálogo es código y solo guarda estado por empresa | No se puede crear un play que no esté en el código |

**Por qué ahora:** el catálogo, el estado por empresa, las puertas y el diagnóstico ya existen o están a punto; añadir el molde y la creación a medida es más barato antes de que se construya la lógica de cada uno de los 28 plays bloqueados. Sin datos de uso: todas las líneas base son «sin dato».

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que las empresas tengan plays creados para ellas y en uso | Empresas con al menos un play «Creado para tu empresa» activado | Sin dato (no existe) | Tabla nueva de plays por empresa (estado activado, por `org_id`), tras el lanzamiento |
| G-2 | Que las propuestas del asistente sean útiles | Propuestas aprobadas frente a descartadas por empresa | Sin dato (no existe) | `agent_pending_actions` (`tool`, `status`, `decided_at`; ya existe y registra confirmaciones y cancelaciones), con apoyo de la tabla nueva |
| G-3 | Que los plays se prueben antes de escalar | Plays activados con resultado de prueba registrado (muestra, éxitos, fecha) | Sin dato (no existe) | Tabla nueva (campos de prueba y resultado) |
| G-4 | Que un play mal definido no se pueda guardar | Planes guardados con muestra y umbral incoherentes, sin ventana de frescura o con un paso sin fuente | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la validación pura |
| G-5 | Que un play sin fuente conectada nunca finja | Plays activados cuya fuente no está conectada en esa empresa | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la comprobación de fuentes |
| G-6 | Que ninguna afirmación de un mensaje salga sin cita | Borradores guardados con una afirmación sin paso de evidencia, o que cita un paso inexistente o más viejo que la ventana | Sin dato; se verifica por prueba: debe ser 0 | Prueba automática de la validación de borradores |
| G-7 | Conocer el coste real de IA por propuesta y por empresa antes de poner un tope (la tanda 0 está abierta a todas las empresas y sin tope: decisión 15) | Coste real (tokens y coste) de cada propuesta y de cada ejecución, **por empresa**, en la tanda 0; toda propuesta debe dejar su registro | Sin dato (no se mide hoy por play) | `integration_usage` (`service`, `need`, `cost`, `created_at`; migración 0041), [Por verificar] si registra las llamadas de IA o solo las de proveedores |

Nunca hay línea base estimada. G-4, G-5 y G-6 son invariantes de seguridad: se prueban, no se miden con datos de uso. **Las medidas G-1 a G-3 y G-7 incluyen el coste de IA por empresa**, para poder decidir después el tope con datos reales.

## 5. No-objetivos
- **Copiar texto de Glider:** nombres, hooks, mensajes de ejemplo y títulos quedan fuera. Solo estructura y patrones (decisión 9).
- **Enviar o publicar nada solo.** Un play produce sugerencia, tarea o borrador; lo aprueba una persona (reglas de `src/lib/AGENTS.md`).
- **Inventar la fuente que falta.** Si la empresa no tiene la herramienta conectada, el play queda bloqueado por fuente externa con el motivo.
- **Tope o freno de coste de IA en la tanda 0:** Fede eligió solo registrar el coste, sin freno (decisión 15). No se inventa ninguna cifra; el tope, si llega, se decide después con el coste medido.
- **Motor de envío (decisión de posicionamiento confirmada por Fede, 2026-11-12):** NOKKO no construye un motor de envío. Decide y prepara; otras herramientas envían.
- **Plays basados en registros oficiales** (P1 a P7 del análisis) en la tanda 0: dependen de fuentes por país sin verificar. Son SDD 4+.
- **Cambiar los 28 plays existentes** ni migrarlos al molde nuevo.
- **Contacto verificado propio:** NOKKO sigue usando Clay y Apollo para encontrar contacto; no se construye un proveedor de contactos.
- **Pantalla nueva de creación** en la tanda 0: la propuesta y la aprobación ocurren en el asistente y en la vista de plays que ya existe.
- **Presentar una receta como análisis o puntuación de perfiles de personas:** nunca. Una receta trata de una señal pública y un motivo para escribir (decisión 12). Las recetas sobre perfiles públicos de LinkedIn están permitidas por Fede (decisión 12), pero no están entre las tres de la tanda 0 (decisión 11). [Por verificar] si la decisión 12 supera a la D2 del PRD de plays; no se toca aquí.
- **Aplicar a Postin:** NOKKO y Postin son productos separados.

## 6. Decisiones tomadas y abiertas
Decididas por Fede en la entrevista del 2026-11-12 (origen: NK-0171):
| # | Tema | Decisión | Quién y cuándo |
|---|---|---|---|
| 1 | Almacenamiento | Tabla por empresa con `org_id` y RLS (migración). La biblioteca de referencia vive en código y es solo lectura | Fede, 2026-11-12 |
| 2 | Quién propone y aprueba | Owner y Sales Leader | Fede, 2026-11-12 |
| 3 | Fuente no conectada | El play queda bloqueado por fuente externa con el motivo; nunca finge | Fede, 2026-11-12 |
| 4 | Tanda 0 | Molde validado por código + 3 recetas horizontales con herramientas ya disponibles + herramienta del asistente para proponer y guardar un play con aprobación | Fede, 2026-11-12 |
| 5 | Coste de IA | Medir en la tanda 0 y poner un tope después; sin cifra inventada | Fede, 2026-11-12 |
| 6 | Éxito | Empresas con al menos un play a medida activado; propuestas aprobadas frente a descartadas; plays con resultado de prueba | Fede, 2026-11-12 |
| 7 | Mercado | Global, clientes de nicho y B2B general | Fede, 2026-11-12 |
| 8 | Vocabulario | Todo es «play». Se distingue solo por origen: «De la biblioteca» o «Creado para tu empresa». Sin nombres nuevos tipo «recetas» en la interfaz | Fede, 2026-11-12 |
| 9 | Texto de Glider | No se copia: solo estructura y patrones, con palabras propias (límite del coordinador, confirmado por Fede) | Fede / coordinador, 2026-11-12 |
| 10 | Cola | NK-0156, esta iniciativa, NK-0167, NK-0168 | Fede, 2026-11-12 |
| 11 (antes Q-1) | Recetas de la tanda 0 | Las tres recetas R-1, R-2 y R-3 quedan confirmadas | Fede, 2026-11-12 |
| 12 (antes Q-2) | Recetas con perfiles públicos de LinkedIn | **Permitidas**, usando solo las integraciones que NOKKO ya usa (Apollo, Clay, Apify). Fede no pidió ninguna salvaguarda más allá del aviso. Una receta nunca se presenta como análisis o puntuación de perfiles: trata de una señal pública y un motivo para escribir. Riesgo aceptado: ver 7.2 | Fede, 2026-11-12 |
| 13 (antes Q-3) | Contacto de personas de la UE (RGPD) | **Permitido**, con un aviso en el paso de verificación manual. Sin interruptor por empresa. Riesgo aceptado: ver 7.2 | Fede, 2026-11-12 |
| 14 (antes Q-4) | Revisión legal (consentimiento en transcripciones y grabaciones públicas; uso de registros públicos) | **Ninguna acción legal por ahora.** Queda como riesgo abierto aceptado (7.2). El coordinador recomienda una revisión legal antes de los conectores de registros públicos (SDD 4 en adelante); la decisión sigue siendo de Fede | Fede, 2026-11-12 |
| 15 (antes Q-5) | Alcance de la tanda 0 y coste de IA | La tanda 0 se abre a **todas las empresas desde el principio**, no solo a la organización de Fede. Coste de IA: **solo registrar el coste, sin freno** (Fede eligió esto frente a contarlo contra `org_budgets` y frente a limitar a solo bajo demanda). Sin tope y sin cifra inventada. Riesgo aceptado: ver 7.2 | Fede, 2026-11-12 |

**Decisiones de diseño que propone este PRD** (Fede las confirma al aprobar; no están decididas):
| # | Tema | Propuesta |
|---|---|---|
| P-1 | Término interno | «Molde» es solo un término de ingeniería para la estructura común; en la interfaz no existe (decisión 8) |
| P-2 | Los 28 plays existentes | Se quedan como están en `catalog.ts` y se muestran como «De la biblioteca». Los 3 plays nuevos de la tanda 0 se escriben con el molde nuevo y también son «De la biblioteca». Nada se migra |
| P-3 | Estado de un play a medida | Propuesto, aprobado y activo, pausado, descartado. Activar reutiliza `checkToggle` y añade la comprobación de fuentes |
| P-4 | Estado de los de la biblioteca | Sigue en `play_states` (por `play_id`); un play a medida usa su propia fila |
| P-5 | Cómo se mide G-2 | Con `agent_pending_actions` (`tool` de la propuesta), igual que la medida de G-1 del PRD de diagnóstico (decisión 33) |
| P-6 | Datos personales en la evidencia | La cadena de evidencia guarda hechos públicos y la URL de la fuente; el contacto sigue en las tablas de contactos que ya existen. Se confirma en el SDD 1 |

### 6.1 Qué define el molde (lo nuevo que falta)
Todo se valida con código puro antes de guardar. La IA solo propone; el código acepta o rechaza con el motivo en palabras.

| Parte del molde | Regla que debe cumplir |
|---|---|
| **Disparador** | Un evento verificable en una fuente nombrada, no un segmento |
| **Ventana de frescura** | **Obligatoria**: un número de días positivo. Si falta, el play no se guarda. Una señal más vieja que la ventana se descarta con el motivo (reutiliza el motor de puertas: un dato desconocido nunca pasa, `gates.ts:10`) |
| **Pasos de evidencia** | Cada paso numerado declara una fuente (de una lista cerrada), qué pregunta y qué dato devuelve. Cada hecho guarda: número de paso, fuente, URL, fecha de lectura y la cita corta |
| **Entregable de una página** | Un borrador de un tipo nuevo («página») que se construye antes del contacto. Sigue siendo borrador: no se publica ni se envía |
| **Verificación manual** | Lista explícita de comprobaciones que una persona hace antes de usar el borrador, con los riesgos concretos de ese play. Sin ella, no se puede activar |
| **Contacto** | Quién y por qué canal, resuelto con Clay o Apollo si el play lo pide; si no hay contacto, se dice «sin dato» |
| **Mensaje citado** | Tres bloques: hechos con su número de paso, lo construido para esa persona, una petición pequeña. Cada afirmación cita un paso que existe y entra en la ventana. Se rechaza el borrador que no cumple |
| **Diseño de prueba** | Muestra (n), éxito (k) y base. Se **rechaza** si la base no es la muestra, si k > n, si k es 0 o si falta cualquiera de los tres. Se declara antes de enviar. Sin cifras por defecto: las pone la empresa |
| **Parámetros por empresa** | Zona, oficio y umbrales como campos con tipo y rango, no un jsonb libre |
| **Comprobación de fuentes** | Cada fuente de los pasos se contrasta con lo que la empresa tiene conectado. Si falta una, el play queda `bloqueado` por fuente externa con el motivo (decisión 3); nunca se activa ni simula resultados |
| **Salida** | Solo `suggestion`, `task` o `draft`. Nunca un envío automático |
| **Redacción** | La receta habla de una señal pública y de un motivo para escribir; nunca dice que analiza o puntúa perfiles de personas (decisión 12) |
| **Aviso de UE** | Si el contacto es una persona de la UE, el paso de verificación manual incluye un aviso (decisión 13). No hay interruptor por empresa |
| **Coste registrado** | Toda propuesta y toda ejecución registra su coste real (tokens y coste) **por empresa**. Sin ese registro no se guarda la propuesta. No hay tope ni freno en la tanda 0 (decisión 15) |

El diseño de prueba existe porque en el análisis 25 de 61 tests de Glider tenían muestra y base incoherentes (cifra de un resumen automático, confirmada en 2 páginas): aquí es una regla que el código aplica, no una convención.

### 6.2 Fuentes disponibles hoy y qué permiten
Comprobado en `src/lib/AGENTS.md` y `src/lib/agent/tools/` (lectura):
| Fuente | Qué hay | Límite relevante |
|---|---|---|
| Firecrawl | Lectura de páginas públicas y búsqueda (`firecrawl.ts`, `web-research.ts`) | Solo URLs públicas |
| Perplexity | Solo `POST /search`, por pasarela gestionada | **No** admite chat ni investigación profunda: no sirve para preguntar a un buscador de IA y ver qué cita |
| Parallel | Búsqueda, extracción y tareas con citas (`parallel.ts`) | Ejecuciones largas en `research_runs` |
| Apify | Cuatro robots: publicaciones de empresa y de persona en LinkedIn, ofertas de empleo, reseñas de G2 (`apify.ts`, `ACTORS`) | No hay robot de tiendas de apps; perfiles públicos de LinkedIn permitidos (decisión 12), con el riesgo de términos de uso de 7.2 |
| Clay y Apollo | Búsqueda y enriquecimiento de empresas y personas; revelado de contacto (escritura, gasta créditos) | Contacto en la UE permitido con aviso (decisión 13; riesgo en 7.2) |
| PostHog | Uso de producto por empresa, con clave del Owner | Solo para planes de producto |
| Google Drive | Carpeta «Nokko / empresa» | Solo lectura y escritura en esa carpeta |

[Por verificar] dónde se lee el estado de «conectado» de cada fuente por empresa (la comprobación de fuentes necesita una función pura sobre ese estado; el SDD 1 la ubica).

### 6.3 Patrones de Glider frente a lo que NOKKO ya tiene
Los 12 patrones salen del análisis (§2.1, hechos suyos; la asignación a un patrón es opinión del analista). «Existente» = play del catálogo o regla proactiva de NOKKO.
| Patrón | Nº en Glider | Portabilidad (A/B/C) | Existente en NOKKO | Cabe en tanda 0 |
|---|---|---|---|---|
| P1 Contratación pública | 5 | 0 / 5 / 0 | `public-records-signals`, `public-filings-qualification` (bloqueados por decisión de GTM) | No: fuente por país sin verificar |
| P2 Caducidad u obligación regulatoria | 9 | 1 / 6 / 2 | `public-records-signals`. El detector `registration_expiring` es de registros de partners y no está relacionado | No |
| P3 Permiso, obra o inmueble | 7 | 0 / 5 / 2 | `public-records-signals`, `local-business-tam` | No |
| P4 Evento ambiental o desastre | 3 | 0 / 3 / 0 | Ninguno | No |
| P5 Presentación pública o concesión | 8 | 0 / 3 / 5 | `public-filings-qualification`, `funding-signal-scraping` (bloqueado por fuente externa) | No |
| P6 Sanción, recall o puntuación | 6 | 0 / 2 / 4 | `public-filings-qualification` | No |
| P7 Comercio e importación | 3 | 0 / 1 / 2 | Ninguno | No |
| P8 Fin de vida o desaparición de un proveedor | 5 | 4 / 1 / 0 | `tech-stack-signal-detection` (bloqueado) cubre cambios de tecnología de una cuenta, no la retirada de un producto | **Sí** |
| P9 Demanda expresada en reseñas, foros, medios | 7 | 7 / 0 / 0 | `review-site-intent-scoring` (bloqueado por proveedor de datos), `brand-mentions-monitoring` y `competitor-post-engagers` (LinkedIn, D2) | **Sí** |
| P10 Brecha de precio o de mercado | 5 | 1 / 3 / 1 | Ninguno | No |
| P11 Fuga por enlace roto | 3 | 3 / 0 / 0 | Ninguno | No: usa una herramienta de enlaces entrantes que NOKKO no tiene |
| P12 Emparejamiento de excedente con demanda | 2 | 1 / 1 / 0 | Ninguno | No |
La señal de contratación (`hiring-signal-monitoring`, bloqueado por D2) no es un patrón propio en el análisis, sino una señal secundaria que aparece en 9 plays.

### 6.4 Las tres recetas de la tanda 0 (propuesta)
Criterio: grado A, fuentes que NOKKO ya tiene hoy, sin registro oficial, sin perfiles de LinkedIn de personas, sin conectores nuevos. Los nombres son provisionales y propios; no usan los de Glider.
| # | Play propuesto | Patrón | Fuentes de NOKKO | Por qué entra |
|---|---|---|---|---|
| R-1 | Un competidor retira o deja de mantener un producto o plan | P8 | Firecrawl y búsqueda combinada (Firecrawl, Perplexity, Parallel) para documentación, registro de cambios y prensa; Clay o Apollo para el contacto | La señal es pública y fechable, vale en cualquier idioma y mercado, y no necesita ningún conector nuevo |
| R-2 | Clientes de un competidor explican por qué se van o qué les falta | P9 | Apify (reseñas de G2, ya con `motivo_cambio`) y búsqueda web de foros; Clay o Apollo | Ya existe `competitor_reviews` y `create_battlecard_from_reviews` (`linkedin.ts`); la receta añade evidencia citada, verificación y prueba |
| R-3 | Un problema que tu producto resuelve se describe en público | P9 | Búsqueda combinada y lectura de páginas con texto (foros, comunidades, medios, transcripciones publicadas); Clay o Apollo | Es el patrón más amplio, el que mejor se adapta a nichos, y no depende de ningún registro |

**Descartadas con motivo:** `ai-search-cites-competitors` (la pasarela de Perplexity solo admite `/search`; no se puede preguntar a un buscador de IA); `reviews-say-app-crashes` (no hay robot de tiendas de apps; leerlas con Firecrawl es [Por verificar]); `redesign-threw-away-backlinks` (necesita una herramienta de enlaces entrantes y de historial de webs que NOKKO no tiene); los dos basados en LinkedIn (no están entre las tres confirmadas, decisión 11; las recetas con perfiles públicos están permitidas para después, decisión 12).
**Cautela de R-2:** las reseñas de G2 suelen ser anónimas o no traen contacto; el play no «contacta al autor»: usa la señal para elegir cuentas del ICP que usan ese competidor. El SDD 2 lo detalla.
**Límite de la tanda 0:** cada receta puede quedar `bloqueada` en una empresa concreta si le falta un conector (por ejemplo Apollo o Clay para el contacto). Es el comportamiento previsto (decisión 3).

## 7. Riesgos y dependencias
- **Calidad del análisis de origen:** lo resumió un modelo pequeño; los recuentos (17/30/16, 17 de 61, 25 de 61) son orden de magnitud. Nada de lo que construyamos depende de esas cifras; sí lo declaramos aquí.
- **Copiar por accidente:** la tabla de hechos del anexo contiene los hooks originales de Glider. El anexo es interno; el SDD 2 debe incluir una prueba que compruebe que ningún título, hook ni mensaje de la biblioteca coincide con el anexo [Por verificar] cómo se automatiza sin copiar el texto en código.
- **Coste de IA:** cada propuesta y cada ejecución gasta IA y, en R-2, saldo de Apify. Sin tope ni freno en la tanda 0 y abierta a todas las empresas (decisión 15): el gasto de IA por empresa no está acotado. Detalle en 7.2.
- **Datos personales:** el mensaje y el contacto tratan datos de personas. El contacto en la UE está sujeto al RGPD y se permite con aviso (decisión 13; riesgo en 7.2). La evidencia guarda hechos públicos y URL, no datos de personas (P-6).
- **Fuentes que cambian o se prohíben:** una fuente puede cambiar de formato o de términos de uso. La comprobación de fuentes se ejecuta al activar y en cada ejecución, no solo al guardar.
- **La IA propone con la estrategia de la empresa:** si la estrategia está vacía, la propuesta es genérica. La herramienta debe negarse a proponer sin ICP y posicionamiento (reutiliza el estado de onboarding, `companyOnboardingStatus`).
- **Dependencias:** diagnóstico de plays (SDD-20261112-diagnosis-in-chat) aún sin integrar en `main`; NK-0156 (onboarding leído) va antes en la cola y alimenta la estrategia que lee la herramienta; NK-0167 (varias líneas de negocio) puede cambiar cómo se lee el arquetipo. El SDD 3 se redacta cuando estén integrados.
- **Migración:** tabla nueva con RLS; la numeración (la siguiente libre tras `0085`) se fija en el SDD 1 y se contrasta con otras ramas. Nunca se aplica a una base real desde la rama de implementación (patrón de `0077`).
- **Solo lectura hasta aquí:** no he ejecutado nada de lo descrito; no he abierto páginas de Glider salvo lo ya recogido en el anexo.

### 7.1 Lo que NO se afirma
- No se afirma que los plays a medida convertirán mejor o peor que los actuales: sin datos de uso ni resultados de prueba.
- No se afirma que Glider funcione: ninguna de sus páginas da resultados reales, solo metas (según el análisis, que es un resumen automático).
- No se afirma que los equivalentes españoles o europeos de los registros de EE. UU. (PLACSP, TED, BORME, CNMV, Catastro, etc.) existan con la cobertura, el formato, el coste y los términos de uso necesarios. Son hipótesis del análisis, por verificar.
- No se afirma que un cliente real tenga o pueda conectar Clay, Apollo, Apify o PostHog: se comprueba por empresa al activar.
- No se afirma ninguna conclusión legal (RGPD, grabación de llamadas, uso de registros públicos, precios de reventa, paridad de tarifas): son avisos para revisar con un abogado.
- No se afirma qué coste de IA tendrá una propuesta ni qué tope conviene: se registra en la tanda 0 y el tope, si llega, se decide después.
- No se afirma que «De la biblioteca» tenga un número concreto de plays al lanzar: en la tanda 0 son 28 existentes y 3 nuevos, y se confirma en el SDD 2.
- No se afirma la calidad de los datos de contacto de Clay o Apollo (Glider declara los suyos; tampoco los hemos verificado).
- No se afirma que `diagnosis.ts` esté en `main`: no está en el commit leído.

### 7.2 Riesgos aceptados por Fede
Fede decidió estos puntos en la entrevista del 2026-11-12 y aceptó sus consecuencias. Se listan para que nadie las lea mal más adelante. No se suavizan ni se anulan aquí.

| Decisión | Qué se aceptó | Consecuencia que debe quedar clara |
|---|---|---|
| 12 (perfiles públicos de LinkedIn) | Recetas basadas en perfiles públicos de LinkedIn permitidas, solo con Apollo, Clay y Apify. Sin salvaguarda más allá del aviso | **Riesgo de términos de uso** de los proveedores y de LinkedIn. Una receta nunca se presenta como análisis o puntuación de perfiles: trata de una señal pública y un motivo para escribir |
| 13 (contacto UE, RGPD) | Contacto de personas de la UE permitido, con un aviso en la verificación manual. Sin interruptor por empresa | **Riesgo RGPD:** NOKKO puede proponer contacto en frío a personas de la UE sin revisión legal previa y sin poder desactivarlo por empresa. El aviso es la única barrera |
| 14 (legal) | Ninguna acción legal por ahora | **Riesgo abierto aceptado:** consentimiento al usar transcripciones o grabaciones públicas, y uso de registros públicos sin revisión legal. El coordinador recomienda una revisión legal antes de los conectores de registros públicos (SDD 4 en adelante). Sigue siendo decisión de Fede |
| 15 (tanda 0 abierta y sin freno) | Tanda 0 abierta a todas las empresas desde el principio. Coste de IA: solo registrar, sin freno | **Gasto de IA sin tope por empresa en la tanda 0.** Una empresa puede generar propuestas sin límite. Para poder decidir el tope después, **cada propuesta debe registrar su coste real (tokens y coste) por empresa**, y las medidas de G-1 a G-3 y G-7 lo incluyen. No se inventa ningún tope. Sugerencia del coordinador (no decidida): `org_budgets` ya existe si Fede quiere un freno más adelante |

[Por verificar] Las reglas de la organización Postin (LinkedIn «solo API oficial»; nunca decir que se analizan o puntúan perfiles) se fijaron para Postin y puede que no apliquen a NOKKO. Hasta que Fede lo confirme, este PRD mantiene la regla de redacción de la decisión 12 (nunca presentar una receta como análisis o puntuación de perfiles).

### 7.3 Preguntas abiertas para Fede
Las Q-1 a Q-5 originales están decididas (decisiones 11 a 15). Queda una, que no bloquea:
| # | Pregunta | Recomendación |
|---|---|---|
| Q-6 | ¿Confirmas que las reglas de la organización Postin sobre LinkedIn («solo API oficial», no analizar ni puntuar perfiles) no aplican a las recetas de NOKKO? | Confirmarlo por escrito. No bloquea: la regla de redacción de la decisión 12 se mantiene mientras tanto |

## 8. Orden de entrega
Cola: tras NK-0156 y antes de NK-0167 y NK-0168. Cada SDD se redacta uno a uno con `nokko-shape` cuando apruebes este PRD. SDD 1 y 2 no dependen del diagnóstico; el SDD 3 sí lo toca.

| # | SDD (propuesto) | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-plays-a-medida-modelo`: tabla por empresa con RLS (migración), tipos del molde, validación pura (frescura, evidencia citada, mensaje citado, diseño de prueba, parámetros, comprobación de fuentes) | Feature | — (revisar con NK-0156) | G-4, G-5, G-6 |
| 2 | `SDD-…-plays-a-medida-biblioteca`: biblioteca de referencia en código y solo lectura, origen «De la biblioteca» frente a «Creado para tu empresa», 3 recetas R-1, R-2, R-3 | Feature | 1 | G-3, G-5, G-6 |
| 3 | `SDD-…-plays-a-medida-asistente`: herramienta del asistente para proponer y guardar un play con aprobación (Owner y Sales Leader), lectura de la estrategia, registro del coste real de IA por propuesta y por empresa | Feature | 1, 2; diagnóstico de plays integrado | G-1, G-2, G-7 |
| 4+ | Un SDD por conector o vertical: registros oficiales por país (P1 a P7), precios (P10), enlaces rotos (P11), LinkedIn de personas, apps | Feature | Resultados de la tanda 0; revisión legal recomendada por el coordinador (decisión 14, riesgo aceptado en 7.2) | G-1 |

Orden dentro de la iniciativa: 1, luego 2, luego 3. No se lanzan 2 y 3 sin 1 (el molde y la validación son el contrato).

## 9. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección), incluidas las propuestas P-1 a P-6 y las tres recetas R-1 a R-3. Fecha: {…}
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.

## 10. Relacionado
- **NK-0174 (bandeja de respuestas):** Fede eligió «Conectar Gmail u Outlook» (lectura del buzón por OAuth) frente a una dirección de reenvío y a un webhook (2026-11-12). Pertenece al PRD propio de NK-0174, no a esta iniciativa: aquí no se define alcance. La lectura del buzón por OAuth tiene peso de privacidad y permisos que ese PRD debe resolver: reglas de datos de clientes (ningún texto de cliente en logs, ningún dato de una empresa visible para otra) y permisos (scopes) mínimos.
