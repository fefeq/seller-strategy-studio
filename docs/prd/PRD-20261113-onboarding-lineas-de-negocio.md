# PRD-20261113-onboarding-lineas-de-negocio · [Iniciativa] Líneas de negocio en el onboarding, un diagnóstico por línea

**Tipo:** Iniciativa (cuatro SDD con orden y dependencias; sección 8) · **Prioridad propuesta:** Media (corrige un diagnóstico equivocado para las empresas con más de un negocio; no hay dato de cuántas son, así que la prioridad es una apuesta declarada; el coste es de ingeniería, sin proveedores ni llamadas nuevas de IA)
**Estado:** Borrador · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-13
**Ticket:** NK-0167 (LOGGED al redactar; el ledger se lee en solo lectura)
**SDD que lo desarrollan:** pendiente (sección 8)

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
En el paso «Diagnóstico» del onboarding eliges un único modelo de negocio (vendo a empresas, vendo a consumidores, conecto oferta y demanda) y de ahí sale **un solo arquetipo** (A a E) del que cuelga la estrategia: el orden de los bloques, el mensaje de Inicio, el siguiente paso y el equipo de plays «Entrantes y producto». Una empresa con dos negocios (por ejemplo B2B más un marketplace, o B2B y B2C) tiene que mentir en una respuesta o promediar dos realidades, y recibe un diagnóstico mezclado o equivocado. Además el ticket, la fricción de adopción y la etapa también son únicos, aunque cada negocio tenga los suyos.

## 2. Para quién
Owner y Sales Leader de empresas con más de una línea de negocio: son quienes hacen el onboarding (los demás miembros ven «Lo esencial para empezar», `src/routes/_authenticated/onboarding.tsx:61`). El resto de miembros y el agente leen las líneas. Sin nombres ni datos de clientes.

## 3. Evidencia y por qué ahora
Leído en `origin/main` @ 36b4b1b (2026-11-13), solo lectura:

| Pieza | Qué hace hoy | Dónde |
|---|---|---|
| Pregunta única | `Choice<Model>` «Modelo» con tres opciones excluyentes; ticket, adopción y etapa también únicos | `src/components/onboarding/steps.tsx:49-54` |
| Reglas puras | `archetypeOf` (modelo y umbrales de ticket 5.000 y 50.000) y `diagnose` (filtro de etapa) devuelven un arquetipo | `src/lib/gtm-diagnosis.ts:23-30`, `:50`, `:13` |
| Almacén | `onboarding_sessions.diagnosis` (jsonb `{input, result}`), una fila por persona y empresa (`UNIQUE (org_id, user_id)`) | `drizzle/migrations/0052_onboarding_sessions.sql`, `src/routes/_authenticated/onboarding.tsx:70-73`, `:157` |
| «Diagnóstico de la empresa» | La función `company_diagnosis` devuelve **una** fila: la tuya o, si no, la más reciente de un compañero | `drizzle/migrations/0065_company_diagnosis.sql` |
| Consumidor 1: orden de bloques | `blockOrder(archetype)` | `src/lib/onboarding.ts:53`; `src/components/onboarding/blocks.tsx:51` |
| Consumidor 2: Inicio y hoja de ruta | «Arquetipo X, nombre. Primero: …» | `src/components/onboarding/home-card.tsx:44-49`; `steps.tsx:91` |
| Consumidor 3: estado de la empresa | `diagnosisSummary` y `companyOnboardingStatus`; `ready` exige diagnóstico, Posicionamiento e ICP | `src/lib/onboarding.ts:258`, `:288`, `:315` |
| Consumidor 4: diagnóstico de plays | `isProduct = status.diagnosis?.motion === "plg"` decide si «Entrantes y producto» encaja; el motivo cita el nombre del arquetipo | `src/lib/plays/diagnosis.ts:83`, `:122-124`, `:151`, `:214` |
| Consumidor 5: agente | `get_onboarding_status` y `onboardingStatusFor`; nunca devuelve el ticket (prueba CA-8) | `src/lib/agent/tools/onboarding.ts:11-60`; `src/lib/agent/tools/onboarding.test.ts:245-275` |
| Aviso de onboarding parado | «son cuatro respuestas» | `src/lib/proactive/detectors/onboarding-stalled.ts:9` |
| Setup (porcentaje) | Ocho ítems con pesos 20, 15, 10, 10, 10, 15, 10, 10 (suman 100); **el diagnóstico GTM no es un ítem** | `src/lib/setup-schema.ts:49-67` |
| Segmentos | `segments.motion` (por ACV: plg, inside, field, strategic) y `segments.acquisition_motion` (plg, slg, marketing, partner, nulo = sin definir) | `src/lib/metrics.ts:58-64`; `src/lib/acquisition-motion.ts:4`; `src/integrations/supabase/types.ts:4479-4500` |
| Diagnóstico AARRR | Por segmento y trimestre, según `acquisition_motion`; no lee el arquetipo | `src/lib/funnel-diagnosis.ts:318-340` |
| Lectura con IA | El prompt de la propuesta no lee arquetipo ni diagnóstico (búsqueda sin resultados en `onboarding.server.ts` y `setup-extract.server.ts`); el orden de pasos es depth, sources, reading, diagnosis, blocks, roadmap | `src/lib/onboarding.ts:225` (STEP_IDS) |
| Pruebas existentes | `gtm-diagnosis.test.ts` (11), `onboarding.test.ts` (27), `agent/tools/onboarding.test.ts` (11), `plays/diagnosis.test.ts` (68), `-onboarding.test.tsx` (4), `home-card.test.tsx` (3), prueba de migración 0065 en `src/lib/migrations.pg.test.ts:415` | recuento de `it(`/`test(` |

Hay **tres vocabularios de «motion»** que no se deben mezclar: el del arquetipo (`plg`, `inside_sales`, `field_sales`; `gtm-diagnosis.ts:17-21`), el del segmento por ACV (`plg`, `inside`, `field`, `strategic`; `metrics.ts:59-64`) y el de adquisición del segmento (`plg`, `slg`, `marketing`, `partner`; `acquisition-motion.ts:4`). Este PRD solo toca el primero y lo **enlaza** con los segmentos; no lo convierte en ninguno de los otros.

Sin datos de uso: no se sabe cuántas empresas tienen más de una línea. Es una apuesta declarada de Fede (2026-11-12). La propuesta del coordinador (una pregunta por línea de negocio, un arquetipo y un enfoque por línea, enlazadas con los segmentos) la aceptó Fede como alcance del SDD.

**Por qué ahora:** el diagnóstico de plays (NK-0153, entregado) ya consume el arquetipo; cada consumidor nuevo que lea «el» arquetipo encarece el cambio.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | Que una empresa pueda declarar más de un negocio y cada uno tenga su propio arquetipo y su propio siguiente paso | Empresas con al menos 2 líneas sobre empresas con al menos 1 línea | Sin dato (la tabla no existe) | Base de datos, `business_lines`, tras el lanzamiento |
| G-2 | Que declarar varias líneas no alargue el onboarding hasta abandonarlo | Onboardings que llegan al paso `roadmap`, comparando empresas con 1 línea y con 2 o más | Sin dato; se puede medir antes del lanzamiento sobre las sesiones actuales | Base de datos: `onboarding_sessions.step = 'roadmap'` y `business_lines` |
| G-3 | Que cada línea quede enlazada con sus segmentos (se enlaza, no se fusiona) | Líneas con al menos un segmento enlazado sobre el total de líneas | Sin dato | Base de datos: `segments.business_line_id` |
| G-4 | Que una empresa con una sola línea reciba exactamente el mismo diagnóstico que hoy (arquetipo, motion, siguiente paso, orden de bloques y equipos de plays) | Pruebas de compatibilidad: debe haber 0 diferencias | Sin dato; se verifica por prueba | Prueba automática de los consumidores, no métrica de uso |
| G-5 | Que ninguna empresa existente pierda ni invente un diagnóstico al migrar | Empresas con diagnóstico antes y después de la migración; líneas sin `input` válido en el origen: 0 | Sin dato; se verifica en la prueba de migración y con una consulta de conteo antes y después | Prueba de migración y base de datos |

Nunca hay línea base estimada. «Completar el diagnóstico por línea» no se mide como porcentaje: una línea solo se guarda con sus cuatro respuestas (decisión 5), así que no existe una línea a medias que contar. Qué no mide esto: no dice si el diagnóstico por línea es más acertado, solo que se usa y que no daña el onboarding.

## 5. No-objetivos
- Deducir las líneas desde la web, los documentos o la lectura con IA. Si algún día se quiere, es otro PRD con su evidencia: hoy el diagnóstico es una declaración tuya y es lo que lo hace explicable (`gtm-diagnosis.ts:1-3`).
- Nuevas llamadas a proveedores de IA. Todo el cambio es pura regla, base de datos e interfaz.
- Fusionar o derivar entre sí los tres vocabularios de motion (sección 3). La línea no escribe `acquisition_motion` ni `segments.motion`, y estos no cambian el arquetipo.
- Estrategia por línea: Posicionamiento, ICP, mensajes, cuota y objetivos siguen siendo uno por empresa; el diagnóstico AARRR sigue siendo por segmento; los plays y su estado (`play_states`) siguen siendo por empresa.
- Un «arquetipo mezcla» o un promedio de tickets. Cada línea tiene el suyo y se muestran por separado.
- Cambiar los cinco arquetipos, sus frameworks, los umbrales de ticket o el filtro de etapa.
- Nuevo ítem en el porcentaje de Configuración (`setup-schema.ts`): los pesos suman 100 y el diagnóstico hoy no puntúa; no se toca.
- Herramienta del agente que escriba líneas: el agente las lee; se editan en la interfaz.
- Ingresos o tamaño por línea.

## 6. Decisiones tomadas y abiertas
| # | Tema | Decisión | Quién y cuándo |
|---|---|---|---|
| 1 | Alcance | El onboarding pregunta por línea de negocio (modelo, ticket anual, adopción y etapa); cada línea produce su arquetipo, diagnóstico y enfoque, enlazada con los segmentos | Propuesta del coordinador, aceptada por Fede como alcance del SDD (2026-11-12) |
| 2 | Dónde viven las líneas | Tabla nueva `business_lines` por empresa: `org_id uuid NOT NULL DEFAULT public.current_org()`, RLS (lee todo miembro; escriben Owner y Sales Leader, el mismo patrón de `play_states`, `0077_plays_library_core.sql:30-39`), campos `model`, `acv`, `friction`, `stage`, `name` (opcional), `is_primary`, `position`, y un índice único parcial para una sola principal por empresa. **No** jsonb en `onboarding_sessions` (es por persona y `company_diagnosis` elige una fila al azar entre compañeros) ni columnas en `segments` (un segmento no es un negocio; la relación es 1 a N y opcional) | Propuesta de este PRD; Fede confirma al aprobar |
| 3 | Enlace con segmentos | Columna nullable `segments.business_line_id` (FK `ON DELETE SET NULL`). Un segmento pertenece como mucho a una línea; una línea tiene varios. Solo es una etiqueta de agrupación: no cambia `motion` ni `acquisition_motion`. En el onboarding se **sugiere** la línea cuyo ticket cae en el rango de ACV del segmento (regla pura existente `matchSegment`, `metrics.ts:70`) y lo confirmas tú; el enlace se edita en Estrategia | Propuesta de este PRD |
| 4 | Qué se guarda | Solo las respuestas (`model`, `acv`, `friction`, `stage`). El arquetipo y el diagnóstico se calculan al leer con las reglas puras. Hoy se guarda también `result` (`onboarding.tsx:157`), que queda viejo si cambian las reglas. Coste: un cambio de texto en `ARCHETYPES` se ve también en diagnósticos antiguos; es lo deseado | Propuesta de este PRD |
| 5 | Línea completa | Una línea solo se guarda con modelo, ticket explícito, adopción y etapa. Hoy el ticket puede quedarse en 0 sin avisar (`steps.tsx:51`, `onboarding.tsx:90`) y daría «PLG»; en una línea, el 0 no vale | Propuesta de este PRD |
| 6 | Etapa | Por línea, siempre guardada; la interfaz la rellena con la de la primera línea («si es distinta, la cambias») | Propuesta del coordinador (2026-11-12), concretada aquí |
| 7 | Consumidores de un solo arquetipo | Ver tabla abajo: orden de bloques y mensaje de Inicio usan la **línea principal**; el estado y el agente listan **todas**; el diagnóstico de plays mira **cualquier línea** para «Entrantes y producto» | Propuesta de este PRD; abiertas 1 y 2 |
| 8 | Empresas existentes | Una línea implícita por empresa a partir de `onboarding_sessions.diagnosis.input`, con la misma fila que hoy devolvería `company_diagnosis` (la más reciente por `updated_at`; la migración no tiene `auth.uid()`); principal; sin nombre; sin enlace a segmentos. Sin diagnóstico, sin línea y el estado sigue diciendo «Diagnóstico GTM sin hacer». Un `input` ausente o inválido no crea línea. No se borra `onboarding_sessions.diagnosis` | Propuesta de este PRD |
| 9 | Quién edita | Owner y Sales Leader (como el resto del onboarding y de los plays). Las líneas son de la **empresa**: un compañero que entra ve y edita las existentes en vez de repetir el diagnóstico por su cuenta | Propuesta de este PRD |
| 10 | Tope de líneas | 4 por empresa, apuesta declarada: sirve a los tres modelos más una línea B2B de otro ticket, que es el caso más probable. Se sube con evidencia | Propuesta de este PRD; abierta 3 |
| 11 | Privacidad | El ticket sigue sin salir por el agente ni el MCP (`onboarding.test.ts:245-275`, CA-8) y tampoco el nombre de la línea si lo escribió el cliente. Hoy cualquier miembro ya lee el ticket vía `company_diagnosis`; no se amplía | Propuesta de este PRD; abierta 4 |

**Cómo se comporta cada consumidor con varias líneas**
| Consumidor | Con varias líneas | Motivo |
|---|---|---|
| `blockOrder` (`onboarding.ts:53`) | Usa el arquetipo de la línea principal | Es una secuencia única de seis bloques: no admite «un orden por línea», y la principal es la que has dicho que manda |
| Inicio y hoja de ruta | Línea principal con su siguiente paso y «y N líneas más» enlazando al paso de líneas | Una tarjeta compacta no debe mezclar tres siguientes pasos; no se oculta que hay más |
| `companyOnboardingStatus` | `diagnosis` se mantiene con la forma de hoy y apunta a la principal (compatibilidad) y se añade `lines` con arquetipo, motion, etapa y siguiente paso de cada una, sin ticket. `ready` = al menos una línea completa más Posicionamiento e ICP (igual que hoy) | Los llamadores existentes no se rompen |
| Diagnóstico de plays (`plays/diagnosis.ts:83`) | «Entrantes y producto» encaja si **alguna** línea tiene motion `plg`; el motivo nombra esa línea. Las demás reglas no cambian | Con solo la principal, un B2B enterprise con una línea PLG nunca vería el equipo que sirve a sus altas de producto. El tope de 3 equipos propuestos se mantiene |
| Agente `get_onboarding_status` | Devuelve `lines` además de `diagnosis` | Para que el asistente razone por línea sin leer tickets |
| Aviso de onboarding parado | Texto «son cuatro respuestas» cambia a una frase que valga para una o varias líneas | Evitar un texto falso |

**Qué cambia en la interfaz**
- El paso «Diagnóstico» pasa a «Líneas de negocio». Una empresa con un solo negocio ve lo de hoy (las cuatro preguntas y su panel de diagnóstico) más un botón «Añadir otra línea». Las líneas se listan en tarjetas; cada una abre sus cuatro preguntas y su panel (arquetipo, se activa, entregable estrella, siguiente paso, descartado con motivo).
- Añadir, editar y quitar una línea. Quitar pide confirmación con `askConfirm` (`AGENTS.md`); no se puede quitar la última; si quitas la principal, pasa a ser principal la siguiente.
- «Hacer principal» en cada línea; la principal se marca con una etiqueta de texto.
- Estrategia (segmentos): selector opcional «Línea de negocio» en cada segmento.
- La hoja de ruta del final muestra el arquetipo y el siguiente paso de cada línea.

## 7. Riesgos y dependencias
- **Diagnóstico mezclado, ahora entre líneas:** si una «línea» en realidad son dos negocios, vuelve el mismo problema. Mitigación: cada línea se diagnostica sola y nunca se promedia; no se puede garantizar que el cliente las separe bien.
- **Regresión en consumidores:** son cinco y comparten la forma `diagnosis`. Mitigación: G-4 por prueba, la forma antigua se conserva en `companyOnboardingStatus` y `companyDiagnosisFor` cae a `company_diagnosis` mientras no haya líneas (patrón ya existente en `src/lib/agent/tools/onboarding.ts:11-37`).
- **Línea principal ambigua:** si nadie la marca, manda la primera. Hay que decidir si es explícita (abierta 1).
- **Longitud del onboarding:** cada línea son cuatro respuestas más. Mitigación: es opcional, el flujo de una línea no cambia, tope de 4 y se vigila con G-2. No se puede saber el efecto antes de medirlo.
- **Migración de datos:** toca datos existentes. La convención del repo es verificarla en un Postgres en proceso (PGlite, `migrations.pg.test.ts`) y aplicarla primero sobre una copia (cabecera de `0065`). Hay que regenerar `src/integrations/supabase/types.ts`, y la tabla es de empresa: debe aparecer en `docs/BASE-DE-DATOS.md`. Rollback: borrar la tabla y la columna; `onboarding_sessions.diagnosis` no se toca.
- **Dos líderes editando las mismas líneas** a la vez: gana la última escritura. Los formularios que copian un registro del servidor usan `mergeServerEdits` (`AGENTS.md`).
- **Contradice a otros documentos:** la decisión P-2 de `PRD-20261110-diagnostico-y-equipos-de-plays.md` (decisión 31: «Entrantes y producto» solo para arquetipos PLG) sigue valiendo **por línea**; este PRD lo matiza, no lo revoca.
- **Relacionado, no duplicado:** NK-0156 y NK-0165 tocan el paso de lectura y sus fuentes (entregado y en cola), no el diagnóstico; conviene que sus SDD no abran a la vez `steps.tsx` y `onboarding.tsx`. NK-0171 (plays a medida, en cola, sin PRD en `main` al redactar esto) puede leer las líneas pero no las necesita.
- **Verificar:** el efecto exacto de `company_diagnosis` al quitar su uso como fuente principal (se mantiene para el respaldo); si hay empresas con sesiones de personas distintas con diagnósticos distintos (la migración cogería solo la más reciente).

## 8. Orden de entrega
| # | SDD | Tipo | Depende de | Cubre |
|---|---|---|---|---|
| 1 | `SDD-…-business-lines-model` (tabla `business_lines`, columna `segments.business_line_id`, RLS, copia de las empresas existentes, reglas puras `src/lib/business-lines.ts`: validar línea, principal, tope, `toDiagnosisInput`, resumen; tipos regenerados; prueba de migración en PGlite) | Feature | — | G-1, G-5 |
| 2 | `SDD-…-business-lines-onboarding-ui` (paso «Líneas de negocio», añadir, quitar y hacer principal, panel por línea, hoja de ruta, `stepReachable` con líneas, escritura en la tabla nueva) | Feature | 1 | G-1, G-2 |
| 3 | `SDD-…-business-lines-consumers` (orden de bloques por línea principal, tarjeta de Inicio, `companyOnboardingStatus` con `lines`, diagnóstico de plays por cualquier línea, aviso de onboarding parado, enlace línea–segmento en Estrategia) | Feature | 1; puede ir en paralelo con el 2 con el contrato de `business-lines.ts` escrito antes | G-3, G-4 |
| 4 | `SDD-…-business-lines-agent-mcp` (`get_onboarding_status` con `lines` sin ticket, `companyDiagnosisFor` desde la tabla con respaldo a `company_diagnosis`, prueba de privacidad ampliada, TITLES y manifiesto del MCP regenerado, docs de `src/lib/AGENTS.md`, `BASE-DE-DATOS.md` y `PANTALLAS.md`) | Mejora | 1 y 3 (usa su resumen) | G-4 |

Los SDD se redactan uno a uno con `nokko-shape` tras aprobar este PRD. Sprint: sin decidir (el orden de cola del sprint siguiente lo fija Fede; el ledger lo sitúa tras NK-0156 y la iniciativa de plays a medida).

**Preguntas abiertas para Fede**
1. **¿La línea principal la marcas tú?** Recomendación: sí, explícita, por defecto la primera que crees (y la existente al migrar). Alternativa descartada: deducirla por ticket o ingresos, que no hay datos fiables para hacerlo.
2. **«Entrantes y producto» con una línea PLG entre varias: ¿propuesto aunque no sea la principal?** Recomendación: sí. Coste: más empresas lo verán propuesto; sigue el tope de 3 equipos y el motivo nombra la línea.
3. **¿Tope de 4 líneas?** Recomendación: 4; si prefieres 3 (uno por modelo), pierdes el caso de dos líneas B2B con tickets muy distintos.
4. **¿Que todo miembro lea el ticket de cada línea, como hoy en `company_diagnosis`?** Recomendación: sí, sin ampliarlo y sin que salga por el agente ni el MCP. Alternativa: solo Owner y Sales Leader, a costa de que el agente de un miembro normal no pueda razonar por línea con el ticket (hoy tampoco lo ve).

## 9. Lo que NO se afirma
- No se afirma que haya empresas con varias líneas: no hay datos de uso. Es una apuesta.
- No se afirma que un diagnóstico por línea acierte más que uno único; solo que representa lo que declaras.
- No se afirma que el onboarding no se alargue: se mide con G-2.
- No se afirma que los umbrales de ticket (5.000 y 50.000) sean correctos para cada negocio; no se cambian.
- No se ha ejecutado nada: todo sale de leer el código en `origin/main` @ 36b4b1b. La tabla y la migración están sin diseñar al detalle; eso es del SDD 1.
- No se han leído datos reales de empresas.

## 10. Registro del gate
| Fecha | Quién | Resultado | Notas |
|---|---|---|---|
| Pendiente | `nokko-gate` (sobre el SDD, no sobre el PRD) | — | El gate revisa cada SDD en Borrador; este PRD lo aprueba Fede |

## 11. Aprobación
- [ ] Fede aprueba el PRD (primer GO de dirección) y responde las cuatro preguntas de la sección 8. Fecha: pendiente
- Al aprobar, el Estado pasa a «Aprobado». Después se redactan los SDD con `nokko-shape`.
