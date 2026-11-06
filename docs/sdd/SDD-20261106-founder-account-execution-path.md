# SDD-20261106-founder-account-execution-path · [Feature] De la estrategia a la cuenta: comité, primer mensaje, seguimiento y guía de ejecución

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-11-06 (v2). **v2.1 del 2026-11-06 con correcciones de CA tras la segunda revisión del gate: pendiente del OK de Fede** · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** `docs/prd/PRD-20261106-founder-account-execution-path.md` · **Depende de:** — (recomendado detrás de NK-0051; ver §14 por los SDD 1b y 5b del control tower)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Cada CA-n cita el objetivo G-n del PRD que cubre.

**Cambios de la v2.1 respecto a la v2** (cada punto remite al hallazgo de la segunda revisión, §17):
- CA-15: excluye todo texto de LinkedIn de la entrada del borrador (h. 1).
- CA-21, CA-30: pruebas movidas a `src/lib/` para que vitest las ejecute (h. 2).
- §6, CA-9, CA-10: una sola regla para el ICP de la cuenta, sin cambiar Descubiertos (h. 3).
- CA-22: el paso de la secuencia se calcula por días, como en leads (h. 4).
- CA-20 y §10: el borrador se guarda en el stakeholder solo desde la pantalla (h. 5 y 16).
- §14 y PRD §6: efecto de GTM Lab A-6 sobre los cargos del ICP (h. 6).
- §14, U-2: numeración de migraciones según el proceso real (h. 7).
- CA-16, CA-28: pruebas que existen (h. 8).
- U-3: escritura del contacto (h. 9).
- CA-31 nuevo: borrador de los toques (h. 10).
- §10 y pregunta 6: FK compuesta (h. 11).
- §14 y CA-23: solape con los SDD 1b y 5b (h. 12).
- Correcciones menores: h. 13 a 20.
- Tras la revisión 3: regla única de ICP por cuenta alineada con `accountFit`, Descubiertos fuera, CA-22 con la regla de paso hecho, canales reales, huella con rol y cargo, CA-31 sin guardar, FK detallada y orden de U-3 y U-4.

## 1. Resumen
Hoy NOKKO deja de guiar al founder cuando termina la configuración. Este SDD añade cuatro cosas sobre las cuentas objetivo:
- la cobertura del comité de compra frente a los cargos del ICP;
- un borrador de primer mensaje por stakeholder;
- un estado de contacto con su propia secuencia de seguimiento;
- una guía en Inicio con la siguiente acción.

Nada se envía solo: todo son borradores y sugerencias.

## 2. Problema y para quién
Heredado del PRD §1 y §2. El founder (Owner), y cualquier miembro con cuentas objetivo, no sabe qué hacer después de configurar la estrategia, y no tiene seguimiento de las personas a las que escribe en esas cuentas.

## 3. Evidencia y por qué ahora
Heredado del PRD §3. Todo es dato de código; el uso es sin dato, y la iniciativa es una apuesta declarada de Fede. El comportamiento actual se comprobó en `main` (`a6597a0` y `fd43083`) y lo revisaron dos rondas del gate (§17):
- **Guía de configuración** (`src/lib/setup-guide.ts`; `SETUP_ITEMS` en `src/lib/setup-schema.ts:49`).
  - Termina en «Primeras cuentas objetivo» y en «Pipeline: al menos un deal».
  - El paso de cuentas cuenta cualquier cuenta, sea objetivo o no (`src/lib/org-data.ts:26`).
  - Después no propone nada.
- **«Tu siguiente paso» en Inicio** (`src/routes/_authenticated/home.tsx:68`) es el mazo con las 5 primeras sugerencias.
  - Sobre cuentas objetivo hay dos reglas: `no_decision_maker` y `account_signal` (`src/lib/proactive/detectors/account-signal.ts:15`).
  - `no_decision_maker` solo salta si la cuenta tiene al menos un stakeholder y ninguno es Decisor (`no-decision-maker.ts:9`).
- **«Buscar personas clave» desde la cuenta no usa el ICP.**
  - El diálogo empieza con los niveles por defecto (`src/components/orchestrator/key-people.tsx:50`).
  - El ICP solo se aplica sin cargos ni niveles (`src/lib/orchestrator/runner.ts:376`).
  - Descubiertos sí lo aplica (`discoveries.server.ts:86`).
- **Elección del ICP de una cuenta:** hoy hay dos reglas.
  - `icpForSegment` (`src/lib/icp.ts:99`): el del segmento o, si no hay, el primero por `created_at`. La usan la búsqueda de personas (`runner.ts:386-391`) y Descubiertos.
  - `accountFit` (`src/lib/scoring.ts:121-124`): el del segmento o, si no hay, el que mejor encaja. La usan la columna Encaje de la lista y la ficha de cuentas.
  - Descubiertos solo lee los 3 primeros ICP (`discoveries.server.ts:38`) y trabaja sobre empresas candidatas, no sobre cuentas.
- **`stakeholders`** (migración `0000`) no tiene estado de contacto.
- **`accounts.is_target`** es un booleano, sin fecha (`0001:90`).
- **La investigación del stakeholder** se genera con publicaciones de LinkedIn obtenidas por Apify en el prompt (`src/lib/ai-core.ts:98-113`). El texto guardado incluye:
  - la sección «De qué habla en LinkedIn»;
  - entradas «LinkedIn · …» en la lista de fuentes final (`ai-core.ts:116`, `web-research.ts:118-120`).
- **`account_touches`** (migraciones `0001` y `0002`) no tiene persona.
  - Sus lectores: `autopilot.server.ts:81`, `agent/tools/accounts.ts:135,167`, `hooks/screen-queries.ts:25`, `accounts.index.tsx:72`, `accounts.$id.tsx:51`, `abm.tsx:50,69` y `field-baseline.ts:9`.
  - Solo usan `account_id` y `occurred_at`.
- **RLS:** es por empresa, no por cuenta (`0002:117-124`). `org_id` admite nulos (`0002:96-100`).
- **Secuencia de los días 3, 7 y 14:** es pura y solo de leads (`src/lib/followup.ts`).
  - El paso vencido es el último cuyo día ha pasado (`:46-47`).
  - Fin a los 21 días (`SEQUENCE_END_DAYS`, `:12`).
- **Normalización de cargos:** no hay ninguna reutilizable (`match.ts` es para nombres de empresa).
- **Caché de IA:** no hay ninguna genérica en `src/lib`.
- **Pruebas:** vitest solo ejecuta `src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.ts:11`). Las pruebas de base de datos usan `src/test/pg-harness.ts` (ejemplo: `src/lib/migrations.pg.test.ts`).
- **Migraciones:** en producción se aplican a mano (`docs/sdd/annex/migraciones-pendientes-lovable-20261101.md`). `scripts/factory/ledger.mjs` no reserva números.

## 4. Resultado buscado
G-1 a G-5 del PRD §4. Todas las líneas base son «sin dato». La de G-2 se mide con una consulta de solo lectura antes de construir **[Por verificar]**.

## 5. Alcance
**Incluye:**
- Cobertura del comité por cuenta objetivo: cargos del ICP frente a los stakeholders mapeados, y si hay Decisor.
- «Buscar personas clave» que abre con los cargos pendientes y con los niveles del ICP.
- Borrador de primer mensaje por stakeholder, para copiar: email con asunto o texto breve para LinkedIn sin asunto.
- Estado de contacto del stakeholder y su secuencia de los días 3, 7 y 14, con borrador y «Marcar toque hecho».
- Guía de ejecución en Inicio y aviso por toque vencido.
- Columna de cobertura en `/accounts` para las cuentas objetivo.

**No incluye:** lo heredado del PRD §5, y además:
- el «grupo de compra» de GTM Lab;
- cambiar la investigación del stakeholder;
- tocar `/plays`, `/abm` y la tabla `activities` (sin versionar);
- cambiar Descubiertos: busca empresas candidatas, no cuentas, y su límite de 3 ICP se queda como está.

## 6. Cambios de comportamiento (delta)
**Añadido:**
- **Bloque «Comité de compra»** en la pestaña Stakeholders:
  - cargos del ICP, cubiertos o pendientes;
  - aviso si falta el Decisor;
  - qué ICP se usa, con opción de cambiarlo;
  - botón «Buscar los que faltan».
- **Estado de contacto** guardado en cada stakeholder: Sin contactar, Contactado, Respondió, Reunión o Descartado. «Sin respuesta» se calcula y no se guarda.
- **Siguiente toque** con su fecha y «Marcar toque hecho».
- **Borradores:** «Preparar primer mensaje» y borrador del toque vencido.
- **Inicio:** tarjeta «Siguiente acción con tus cuentas», como bloque propio.
- **Aviso `stakeholder_followup`:** sugerencia en la app con prioridad 2. Es una regla fija como `followup_sequence`, no pertenece a ningún play.
- **Herramientas del agente:** `draft_stakeholder_message` (lectura) y `set_stakeholder_contact` (escritura con confirmación), junto a `update_stakeholder`.
- **Columna «Comité»** en `/accounts` para las cuentas objetivo.

**Modificado:**
- **«Buscar personas clave» desde la cuenta.**
  - Antes: siempre abre con los niveles por defecto y no aplica el ICP.
  - Después: abre con los cargos y niveles del ICP de la cuenta, o con los cargos pendientes si viene de «Buscar los que faltan».
- **ICP de una cuenta.**
  - Antes: dos reglas. La búsqueda de personas usa el del segmento o el primero; la columna Encaje, el del segmento o el que mejor encaja.
  - Después: una sola regla para todo lo que trabaja sobre una cuenta: el elegido para esa cuenta, si existe; si no, el del segmento; si no, el que mejor encaja (la de `accountFit`).
  - Cambia la búsqueda de personas en cuentas sin segmento: pasa de «el primero» a «el que mejor encaja». Descubiertos no cambia.
- **`account_touches`.**
  - Antes: sin persona.
  - Después: con persona opcional.
  - Registrar un contacto o un toque hecho crea un toque de cuenta, así que el engagement ABM sube por diseño.
- **Inicio.**
  - Antes: solo el mazo.
  - Después: la tarjeta de ejecución va encima cuando aplica.

**Eliminado:** nada.

## 7. Historias y criterios de aceptación

### H-1: Como founder, quiero ver en Inicio cuál es mi siguiente acción con las cuentas objetivo para no tener que decidir por dónde seguir.
- **CA-1** MIENTRAS la empresa tenga al menos un ICP y haya alguna acción pendiente, Inicio DEBE mostrar una sola siguiente acción de ejecución, con la cuenta, la persona si aplica, el motivo en una frase y un enlace al sitio donde se hace · cubre G-1 · prueba: `src/components/home/execution-card.test.tsx`
- **CA-2** La guía DEBE elegir la acción en este orden fijo:
  1. toque de seguimiento vencido, por la fecha de vencimiento más antigua;
  2. stakeholder sin contactar con borrador preparado, por el borrador más antiguo;
  3. cuenta objetivo con al menos un stakeholder y ninguno Decisor, por la fecha de creación de la cuenta más antigua;
  4. cuenta objetivo con cargos del ICP sin mapear (incluidas las que no tienen stakeholders), con el mismo criterio;
  5. solo para Owner y Sales leader: la empresa tiene menos de 5 cuentas objetivo, incluido el caso de 0.

  · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`
- **CA-3** Los niveles 1 a 4 DEBEN contar solo las cuentas asignadas a la persona y, si es Owner o Sales leader, también las que no tienen dueño · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`
- **CA-4** CUANDO la empresa tenga ICP y no quede ninguna acción pendiente, Inicio DEBE mostrar «Estás al día con tus cuentas objetivo» y un enlace para añadir cuentas · cubre G-1 · prueba: `src/components/home/execution-card.test.tsx`
- **CA-5** El estado de la guía DEBE salir siempre de los datos y no guardarse aparte. Marcar algo en cualquier canal (web, agente o Telegram) cambia la siguiente acción · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`
- **CA-6** SI el aviso `no_decision_maker` está oculto porque su play está en pausa (cuando Plays esté integrado), ENTONCES la guía DEBE saltarse el nivel 3 · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`

### H-2: Como founder, quiero ver qué personas del comité de compra me faltan en cada cuenta objetivo para saber a quién buscar.
- **CA-7** El bloque «Comité de compra» DEBE listar los cargos objetivo del ICP de la cuenta y marcar cada uno como «Cubierto» si un stakeholder tiene un cargo equivalente según CA-8, o como «Pendiente» si no · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`
- **CA-8** La equivalencia de cargos DEBE ignorar mayúsculas, acentos y signos, y tratar como equivalentes los sinónimos de nivel de una lista cerrada que fija la prueba · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`
- **CA-9** El ICP de una cuenta DEBE ser:
  1. el elegido para esa cuenta, si existe;
  2. si no, el de su segmento;
  3. si no, el que mejor encaja con la cuenta (regla actual de la columna Encaje); con empate, el más antiguo por `created_at`.

  El bloque DEBE decir qué ICP usa y permitir elegir otro, que se guarda para esa cuenta · cubre G-2 · prueba: `src/lib/icp.test.ts`
- **CA-10** Toda ruta que trabaja sobre una cuenta existente DEBE usar la regla de CA-9 y dar el mismo ICP para la misma cuenta: bloque del comité, nivel 4 de la guía, columna «Comité», columna Encaje y búsqueda de personas desde la cuenta o desde el agente. Descubiertos queda fuera (§5) · cubre G-2 · prueba: `src/lib/icp.test.ts` (regla), `src/lib/scoring.test.ts` (Encaje), `src/components/orchestrator/key-people.test.tsx` (diálogo) y un caso del runner en `src/lib/orchestrator/runner.test.ts`
- **CA-11** SI el ICP no tiene cargos objetivo, ENTONCES el bloque DEBE decir «Tu ICP no dice a qué cargos dirigirte» y enlazar a Estrategia, ICP · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`
- **CA-12** «Buscar personas clave» abierto desde la cuenta DEBE empezar con los cargos y los niveles del ICP de la cuenta. Desde «Buscar los que faltan», DEBE empezar solo con los cargos pendientes. SI la cuenta no tiene dominio, ENTONCES DEBE decir que lo añadas, como hoy · cubre G-2 · prueba: `src/components/orchestrator/key-people.test.tsx`
- **CA-13** La lista de cuentas DEBE mostrar, en las cuentas objetivo, la cobertura como «cubiertos de total, con o sin Decisor» · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`

### H-3: Como founder, quiero un borrador de primer mensaje para cada stakeholder para saber qué decirle.
- **CA-14** CUANDO pidas «Preparar primer mensaje», el sistema DEBE devolver un borrador que use:
  - el rol de compra, el cargo y la investigación del stakeholder si existe (con CA-15);
  - el posicionamiento y los pilares de mensaje de la empresa.

  El formato depende del canal elegido: email con asunto, o LinkedIn sin asunto · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts` (entrada del modelo y plantilla)
- **CA-15** La entrada del borrador NO DEBE incluir texto de LinkedIn: ni la sección «De qué habla en LinkedIn», ni las entradas de la lista de fuentes con URL de linkedin.com. SI la investigación guardada tiene alguna fuente de linkedin.com, ENTONCES el borrador DEBE usar solo el rol, el cargo y la estrategia, y avisar «La investigación incluye LinkedIn: no la uso hasta que se regenere» · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-16** El borrador DEBE marcar como «(hipótesis)» todo lo que no venga de la investigación permitida ni de la estrategia de la empresa · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts` (comprueba que la instrucción va en el prompt) y un caso nuevo en `src/lib/gtm-lab/eval/` (mide la calidad con IA; es una evaluación, no un test que falle primero)
- **CA-17** SI el stakeholder no tiene investigación, ENTONCES el borrador DEBE avisar «Sin investigación: el mensaje es genérico para su rol» · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-18** SI la empresa no tiene posicionamiento ni pilares, ENTONCES el borrador DEBE avisar «Sin posicionamiento: completa Estrategia para mensajes con tu diferencia» y no inventar una diferencia · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-19** SI la IA falla o no hay presupuesto, ENTONCES el sistema DEBE decir «No he podido preparar el borrador: [motivo]. Vuelve a intentarlo o escríbelo tú» y no guardar nada · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-20** Preparar un borrador NO DEBE enviar nada ni cambiar `contact_status`. Solo la pantalla guarda el último borrador en el stakeholder (texto, canal, fecha y huella). La herramienta del agente no guarda nada · cubre G-5 · prueba: `src/lib/stakeholder-message.test.ts`

### H-4: Como founder, quiero registrar a quién he escrito y que NOKKO me recuerde volver a escribirle para que nadie se quede sin seguimiento.
- **CA-21** CUANDO marques a un stakeholder como «Contactado» con su canal (`email`, `call`, `linkedin`, `meeting` o `other`, con `other` añadido a `TOUCH_CHANNELS`) y su fecha, el sistema DEBE:
  - guardar el estado;
  - crear un único toque de cuenta con esa persona;
  - calcular los toques de los días 3, 7 y 14 desde esa fecha.

  · cubre G-3, G-4 · prueba: `src/lib/stakeholder-contact.test.ts` y `src/lib/stakeholder-contact.pg.test.ts`
- **CA-22** El paso vencido DEBE ser el último cuyo día ha pasado y que no está hecho, con la misma regla que `followupStatus`. Un paso está hecho si existe un toque con esa persona con `occurred_at` igual o posterior a la fecha del paso, sin contar el del primer contacto. «Toque hecho» crea ese toque y así cierra ese paso y los anteriores · cubre G-4 · prueba: `src/lib/stakeholder-sequence.test.ts`
- **CA-23** CUANDO venza un paso según CA-22 y el stakeholder siga en «Contactado», el sistema DEBE crear un único aviso (sugerencia en la app, prioridad 2) para el dueño de la cuenta, o para Equipo si no tiene dueño, con enlace al stakeholder · cubre G-4 · prueba: `src/lib/proactive.test.ts`
- **CA-24** CUANDO marques «Respondió», «Reunión» o «Descartado», la secuencia DEBE pararse y no crear más avisos · cubre G-4 · prueba: `src/lib/stakeholder-sequence.test.ts`
- **CA-25** CUANDO hayan pasado 21 días (`SEQUENCE_END_DAYS`) desde el contacto sin otro estado, el stakeholder DEBE mostrarse como «Sin respuesta», calculado y no guardado, y salir de la guía · cubre G-4 · prueba: `src/lib/stakeholder-sequence.test.ts`
- **CA-26** CUANDO se borre un stakeholder, sus avisos de seguimiento pendientes DEBEN desaparecer · cubre G-4 · prueba: `src/lib/proactive.test.ts`
- **CA-27** CUANDO marques «Reunión», el sistema DEBE ofrecer crear una reunión o un deal en la cuenta, sin crearlos solo · cubre G-4 · prueba: `src/components/account/stakeholders-tab.test.tsx`
- **CA-28** El agente DEBE poder cambiar el estado de contacto o marcar un toque hecho solo con confirmación · cubre G-5 · prueba: `src/lib/agent-tools.test.ts`
- **CA-29** La secuencia del stakeholder NO DEBE crear ni modificar leads, ni contar en la conversión por origen · cubre G-3 · prueba: `src/lib/stakeholder-sequence.test.ts`
- **CA-31** El borrador de los toques 3, 7 y 14 DEBE salir de una plantilla con los pilares de mensaje; «Reescribir con IA» es opcional. Se le aplican CA-15 y CA-20. No se guarda en `message_draft`, que es solo del primer mensaje · cubre G-4 · prueba: `src/lib/stakeholder-sequence.test.ts`

### H-5: Como Owner, quiero que los datos de una empresa no se crucen con los de otra.
- **CA-30** SI un toque de cuenta apunta a un stakeholder de otra cuenta o de otra empresa, o una cuenta apunta a un ICP de otra empresa, ENTONCES la base de datos DEBE rechazarlo · cubre G-2, G-3 · prueba: `src/lib/stakeholder-contact.pg.test.ts` (dos empresas ficticias sobre `src/test/pg-harness.ts`)

## 8. Casos límite y errores
| Caso | Comportamiento | CA |
|---|---|---|
| Empresa sin ICP | No hay guía de ejecución; sigue la de configuración | CA-1 |
| ICP sin cuentas objetivo | Nivel 5 para Owner y Sales leader | CA-2 |
| ICP sin cargos objetivo | Aviso y enlace a Estrategia | CA-11 |
| Varios ICP y la cuenta sin segmento que encaje | Usa el que mejor encaja, como la columna Encaje, y deja elegir otro | CA-9, CA-10 |
| Más de 3 ICP | Descubiertos sigue mirando solo los 3 primeros; no afecta al comité ni a la búsqueda desde la cuenta | CA-10 |
| Cuenta sin dominio | Explica que falta el dominio | CA-12 |
| Cargos parecidos pero distintos | Equivalencia cerrada | CA-8 |
| Stakeholder sin email ni LinkedIn | Se puede marcar como contactado por teléfono, en reunión o por otro canal | CA-21 |
| Sin investigación, o investigación con LinkedIn | Borrador avisado, sin usar LinkedIn | CA-15, CA-17 |
| Sin posicionamiento | Borrador avisado | CA-18 |
| IA caída o sin presupuesto | Mensaje de error; no guarda nada | CA-19 |
| Contacto marcado hace más de 14 días | Vence el último paso sin hacer; un único aviso | CA-22, CA-23 |
| Stakeholder borrado | Sus avisos desaparecen | CA-26 |
| Datos de otra empresa | La base los rechaza | CA-30 |

## 9. Experiencia y copy
Español, con «tú», sin iconos y con los estados escritos en palabras. Los ejemplos usan datos ficticios.
- **Tarjeta de Inicio.** Eyebrow «Siguiente acción con tus cuentas». Ejemplos:
  - «Hoy toca el segundo toque a la directora de operaciones de Empresa Ejemplo. Le escribiste hace 7 días y no ha contestado.» Botón «Preparar mensaje».
  - «Empresa Ejemplo no tiene Decisor en el mapa.» Botón «Buscar personas».
- **Comité de compra:** «ICP: Ejemplo B2B. Cargos: 2 de 4 cubiertos. Falta el Decisor.» Botones «Cambiar ICP» y «Buscar los que faltan».
- **Estados:** Sin contactar · Contactado · Respondió · Reunión · Sin respuesta · Descartado.
- **Borrador:** «Borrador para copiar. NOKKO no lo envía.» Botones «Copiar» y «Marcar como contactado».
- **Errores:** siempre «qué pasó + qué hacer».

## 10. Datos, permisos y privacidad
*[Sugerencia — la revisión del gate valida]*
- **`stakeholders`**, columnas nuevas:
  - `contact_status`: texto con check (`not_contacted`, `contacted`, `replied`, `meeting`, `discarded`); por defecto `not_contacted`.
  - `contacted_at`, `contact_channel` y `contact_updated_at`.
  - `message_draft`: jsonb con canal, texto, fecha y huella. La huella combina el rol de compra, el cargo, la investigación, el posicionamiento y los pilares. Sirve de caché (§11) y de fecha para el nivel 2 de la guía.
- **`account_touches`:** `stakeholder_id` opcional.
- **`accounts`:** `icp_profile_id` opcional.
- **Integridad entre empresas (CA-30):**
  - FK compuesta `(stakeholder_id, account_id, org_id)` → `stakeholders(id, account_id, org_id)`, con `unique` en el destino y `on delete set null (stakeholder_id)`.
  - Lo mismo con `(icp_profile_id, org_id)` → `icp_profiles(id, org_id)`.
  - Exige `unique (id, account_id, org_id)` en `stakeholders`, `unique (id, org_id)` en `icp_profiles` y `org_id not null` en `account_touches` y `accounts` **[Por verificar: que no haya nulos en producción]**. Si los hay, se usa un trigger.
  - `on delete set null (columna)` existe desde Postgres 15; producción usa 17 y PGlite 18, según `SDD-20261030-money-moment-notices.md` **[Por verificar en U-2]**.
- **Común:**
  - `org_id default current_org()`; el cliente no envía `org_id`.
  - Hereda la RLS actual.
  - Cada columna nueva va en `src/lib/field-catalog.ts`.
- **Roles:** todos los miembros preparan borradores y registran contactos en las cuentas que ven. La guía filtra por dueño (CA-3) y el nivel 5 es solo para Owner y Sales leader.
- **Privacidad:** no se añade ninguna fuente de LinkedIn, y el borrador no usa texto de LinkedIn (CA-15). Ningún dato real en tests.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Primer mensaje al stakeholder (CA-14) | regla (sin investigación permitida ni posicionamiento: plantilla sin IA) → caché (`message_draft` con la misma huella y el mismo canal) → modelo barato | Modelo barato de `ai-gateway`, `effort:"low"` | sin dato |
| Toque de seguimiento (CA-31) | regla (plantilla con los pilares) → modelo barato solo con «Reescribir con IA» | Modelo barato, `effort:"low"` | sin dato |
| Guía y cobertura del comité | ninguna (reglas puras) | — | 0 |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Reglas puras: equivalencia de cargos, cobertura del comité, ICP de la cuenta, pasos de la secuencia y orden de la guía | CA-2, CA-3, CA-5 a CA-11, CA-13, CA-22, CA-24, CA-25, CA-29 | `buying-committee.test.ts`, `icp.test.ts`, `stakeholder-sequence.test.ts`, `execution-guide.test.ts` |
| U-2 | Migración (número 0079 o posterior, que se asigna al fusionar según la numeración del plan maestro y se comprueba contra todas las ramas tras `git fetch`) y catálogo de campos | CA-30 | `src/lib/stakeholder-contact.pg.test.ts`, que crea `stakeholders`, `account_touches`, `accounts` e `icp_profiles` sobre el arnés, como `migrations.pg.test.ts` |
| U-3 | `setStakeholderContact` (un solo toque por acción), pestaña Stakeholders, «Buscar personas clave» con ICP y columna en `/accounts` | CA-12, CA-21, CA-27 | `stakeholder-contact.test.ts`, `key-people.test.tsx`, `stakeholders-tab.test.tsx` |
| U-4 | Borradores (primer mensaje y toques) y herramientas del agente | CA-14 a CA-20, CA-28, CA-31 | `stakeholder-message.test.ts`, `stakeholder-sequence.test.ts`, `agent-tools.test.ts` |
| U-5 | Detector `stakeholder_followup` y `src/components/home/execution-card.tsx` | CA-1, CA-4, CA-23, CA-26 | `proactive.test.ts`, `execution-card.test.tsx` |

Orden: U-1 → U-2 → U-3 → U-4 → U-5. U-4 usa `setStakeholderContact` de U-3; los borradores de U-4 pueden empezar en paralelo a U-3.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Reutilizar:**
  - `icpPeopleQuery`, `icpForSegment` (ampliado con el ICP elegido) e `icpBrief` (`src/lib/icp.ts`);
  - `followupStatus`, `FOLLOWUP_STEPS` y `SEQUENCE_END_DAYS` (`src/lib/followup.ts`);
  - el patrón de `setup-guide.ts`;
  - el de `followup-sequence.ts` para el detector;
  - `update_stakeholder` (`agent/tools/accounts.ts:388`).
- **«Buscar personas clave»:** inicializar los cargos y niveles desde el ICP en `key-people.tsx:49-50`.
- **Filtro de LinkedIn (CA-15):** quitar la sección por su encabezado y las líneas de fuentes cuya URL sea de linkedin.com, y probarlo con texto ficticio.
- **Alternativas descartadas:**
  - una tabla de secuencias: el estado más los toques bastan;
  - leer el tablero de GTM Lab: aún no existe;
  - guardar «Sin respuesta»: contradice CA-5;
  - usar `activities`: sin versionar y sin código (anexo de esquema sin versionar, 2026-11-06).

## 14. Riesgos y dependencias
- **Inicio lo tocan tres trabajos:**
  - NK-0051;
  - el SDD 1b del control tower, que rehace Inicio;
  - el SDD 5b, que oculta tarjetas.

  La tarjeta de ejecución es un componente propio (`execution-card.tsx`) y se conserva como bloque bajo el titular de 1b. `stakeholder_followup` es una sugerencia en la app, no un mensaje del agente en el sentido de 5b CA-1, y no entra en la lista cerrada de 5b CA-2.
- **Migraciones:**
  - En producción se aplican a mano.
  - El número se asigna al fusionar (0079 o posterior), según el plan maestro.
  - Ese plan y `reseal-journal.mjs` están fuera del repo **[Por verificar]**.
- **GTM Lab (A-6 y Anexo A).**
  - Riesgo: A-6 vacía los textos de `icp_profiles` y el Anexo A no publica `target_titles` ni `seniorities`, así que el comité se quedaría vacío.
  - Condición: la enmienda del Anexo A DEBE publicar el grupo de compra en `icp_profiles.target_titles` y `seniorities`, y A-6 no vacía esas columnas hasta entonces.
  - Pendiente: una nota cruzada en el PRD de GTM Lab, en un PR aparte.
- **Plays:** su SDD 7 debe reutilizar `buying-committee.ts`, y la guía respeta los plays en pausa (CA-6).
- **Apify:** la investigación sigue usándolo hasta U-0. El borrador lo neutraliza (CA-15).
- **Engagement ABM:** sube con los toques nuevos, por diseño. Si además se usa `log_touch` para el mismo contacto, cuenta doble.
- **Sin instrumentación:** G-1 solo se verifica con pruebas.

## 15. Preguntas para Fede y para la revisión técnica
**Decidido por Fede el 2026-11-06:** las preguntas 1 a 5 se resuelven con la recomendación de cada una. La 6 queda respondida por la segunda revisión del gate (§10).
1. **Fede · Calendario.** ¿Antes de la salida de Lovable A? Recomiendo que sí: solo toca tablas versionadas y las migraciones ya se aplican a mano.
2. **Fede · Secuencia.** ¿Los mismos días 3, 7 y 14 que en leads? Recomiendo que sí.
3. **Fede · Grupo de compra de GTM Lab.** Recomiendo que el comité salga del ICP y que la enmienda del Anexo A publique en las mismas columnas (§14).
4. **Fede · Umbral de 5 cuentas objetivo.** Recomiendo aceptarlo como punto de partida y revisarlo con uso real.
5. **Fede · Guía frente al tablero de GTM Lab.** Recomiendo que la guía salga de los datos y que el tablero enlace a ella.
6. **Revisión técnica · Integridad entre empresas.** FK compuesta, o trigger si hay `org_id` nulos (§10).

## 16. Pendiente de verificar
| Qué | Quién o qué lo comprueba |
|---|---|
| Línea base de G-2 | Consulta de solo lectura en producción |
| Que no haya `org_id` nulos en `stakeholders`, `account_touches`, `accounts` ni `icp_profiles` | Consulta de solo lectura en producción |
| Número de migración libre | Al fusionar U-2, contra todas las ramas |
| Plan maestro y `reseal-journal.mjs` (fuera del repo) | Fede |
| Que `pg-harness` modela la FK compuesta con `on delete set null (col)` | U-2 |
| Coste por borrador | Registro de gasto de IA tras la entrega |

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)

### Revisión 2 (sobre la v2, 2026-11-06). Informe copiado sin editar (solo se han bajado de nivel los encabezados)

**Veredicto: Fusionable con cambios menores.** Los cambios son de texto, pero cuatro tocan el significado de CA ya aprobados (CA-9, CA-15, CA-16 y CA-22). Por eso necesitan una v2.1 con tu OK antes de fusionar. Si se fusiona tal cual, la v2 deja un «Aprobado» que no se puede probar en tres CA y que contradice §6 en otro.

#### Hallazgos

**1. Alta. CA-15 no impide que entre contenido de Apify.**
- Evidencia: `src/lib/ai-core.ts:116` añade al final de la investigación una lista «Fuentes» con entradas `[LinkedIn · <80 caracteres del post>](url)` (`src/lib/web-research.ts:118-120`). CA-15 (`SDD:127`) solo quita la sección «De qué habla en LinkedIn».
- Además, el texto se genera con los posts en el prompt (`ai-core.ts:113`), así que otras secciones pueden venir de ellos.
- La objeción Alta n.º 4 de la v1 sigue abierta.
- Arreglo, nuevo CA-15: «La entrada del borrador NO DEBE incluir texto de LinkedIn: ni la sección "De qué habla en LinkedIn" ni las entradas de "Fuentes" con URL de linkedin.com. SI la investigación guardada tiene alguna fuente de linkedin.com, ENTONCES el borrador DEBE usar solo el rol, el cargo y la estrategia, y avisar "La investigación incluye LinkedIn: no la uso hasta que se regenere"». Prueba: `stakeholder-message.test.ts`, con una investigación ficticia que tenga los dos casos.

**2. Alta. `drizzle/migrations.pg.test.ts` nunca se ejecutaría.**
- Evidencia: `vitest.config.ts` solo incluye `src/**/*.{test,spec}.{ts,tsx}`. La citan `SDD:140`, `SDD:151` y `SDD:211` (U-2, CA-21 y CA-30).
- CA-30 es la única prueba de que una empresa no ve datos de otra.
- Arreglo: usar `src/lib/stakeholder-contact.pg.test.ts` sobre `src/test/pg-harness.ts`.
- El arnés no tiene `stakeholders` ni `account_touches`. Hay que crearlas en el test, como hace `src/lib/migrations.pg.test.ts:17-29` con `quotas` y `deals`.

**3. Alta. Hay tres versiones distintas de cómo se elige el ICP de una cuenta.**
- §6 (`SDD:77-79`) dice «si no, la regla de antes». La regla de antes es la del segmento y, si no hay, **el primero** (`src/lib/icp.ts:98-105`).
- CA-9 (`SDD:110-115`) dice «el único» y, si hay varios, que se pida elegir.
- CA-10 (`SDD:116`) exige el mismo resultado en todas las rutas. Pero `runner.ts:376-392` y `discoveries.server.ts:86` no pueden preguntar a nadie.
- Además, cambia en silencio el comportamiento actual de Descubiertos.
- Arreglo para CA-9 punto 3 y para §6: «si no, el único. Con varios y ninguno encaja, el bloque pide elegir. La búsqueda de personas y Descubiertos no usan ICP (niveles por defecto) hasta que se elija». Necesita tu OK porque cambia Descubiertos.

**4. Media. La regla del paso de la secuencia se contradice.**
- CA-21 (`SDD:138`) calcula los pasos por días.
- CA-22 (`SDD:141`) calcula el siguiente paso por el número de toques hechos.
- §8 (`SDD:165`) dice que solo avisa el último toque vencido.
- Los leads lo hacen por días (`followup.ts:46-47`).
- Ejemplo: con un contacto de hace 20 días, el conteo de toques da el día 3 y §8 da el día 14.
- Arreglo para CA-22: «El paso vencido es el último cuyo día ha pasado, igual que `followupStatus`. "Toque hecho" cierra ese paso y los anteriores. El toque del primer contacto no cuenta como paso».

**5. Media. CA-20 choca con `message_drafted_at`.**
- CA-20 (`SDD:132`) dice que preparar un borrador no cambia el stakeholder.
- Pero el nivel 2 de la guía (`SDD:98`) necesita escribir `message_drafted_at` (`SDD:185`).
- Y `draft_stakeholder_message` está declarada como herramienta de lectura (`SDD:70`), así que escribiría sin confirmación.
- Arreglo para CA-20: «no envía nada ni cambia `contact_status`. Solo la pantalla guarda `message_drafted_at`. La herramienta del agente no lo guarda».

**6. Media. GTM Lab SDD 7 vaciará los cargos del ICP.**
- Evidencia: la decisión A-6 de GTM Lab (`PRD-20261101-gtm-lab-en-nokko.md:107`) vacía los textos de `icp_profiles`.
- El Anexo A (`:146-161`) no publica `target_titles` ni `seniorities`.
- Resultado: el comité de compra se queda vacío y todas las cuentas muestran CA-11.
- `SDD:237` y `PRD:63` solo dicen que el Anexo A se enmendará.
- Arreglo: añadir en §14 y en PRD §6: «La enmienda del Anexo A DEBE publicar el grupo de compra en `icp_profiles.target_titles` y `seniorities`, y A-6 no vacía esas columnas hasta entonces». Y dejar una nota cruzada en el PRD de GTM Lab, en otro PR.

**7. Media. No se puede reservar un número de migración en el ledger.**
- `SDD:211`, `SDD:235` y `PRD:75,97` piden reservarlo, pero `scripts/factory/ledger.mjs` no tiene ese comando (solo log, promote, ship, verify, doc, link, show y list: `:71-208`).
- La «0078 reservada» solo aparece en `../PLAN-MAESTRO-NOKKO.md:163-164`, fuera del repo. Ese plan dice que de la 0079 en adelante se asignan al fusionar con `reseal-journal.mjs`, que tampoco está en el repo.
- Las dos `0074` solo existen en ramas locales (`feat/money-notices` y `feat/ux-graphite-legibility-move`), no en origin.
- Arreglo: «Número 0079 o posterior, asignado al fusionar según la tabla de numeración del plan maestro. Comprobado contra todas las ramas con `git fetch`».

**8. Media. Dos CA no tienen una prueba que pueda ejecutarse.**
- CA-16 (`SDD:128`) apunta a `SDD-20261102-ai-eval-harness`. En `origin/main` (`352c2e7`) ese SDD está marcado como SUPERADO.
- Arreglo para CA-16: «caso nuevo en `src/lib/gtm-lab/eval/` (NK-0048). Además, `stakeholder-message.test.ts` comprueba que la instrucción de marcar "(hipótesis)" va en el prompt».
- CA-28 (`SDD:147`) no nombra ningún archivo. Arreglo: `src/lib/agent-tools.test.ts`.

**9. Media. Ninguna unidad de §12 construye la escritura del contacto.**
- Evidencia: U-2 cierra «CA-21 (guardado)» (`SDD:211`), pero U-2 es una migración. Ninguna unidad entrega la función que guarda el estado y crea el toque, ni la escritura de «Toque hecho» de CA-22.
- Arreglo: añadir a U-3 «`setStakeholderContact` (servidor, un solo toque por acción)», con la prueba `src/lib/stakeholder-contact.test.ts`.

**10. Media. El borrador del toque de seguimiento no tiene ningún CA.**
- Aparece en `SDD:67` y `SDD:202`, pero CA-15 y CA-20 solo hablan del primer mensaje.
- Arreglo, nuevo CA-31: «El borrador del toque 3, 7 o 14 sale de una plantilla con los pilares de mensaje. "Reescribir con IA" es opcional. Se le aplican CA-15 y CA-20» · cubre G-4 · prueba: `stakeholder-sequence.test.ts`.

**11. Media. La pregunta 6 («¿check o trigger?») tiene una respuesta técnica.**
- Evidencia: `SDD:186-187` y `SDD:250`.
- Un CHECK no puede leer otras filas, así que no sirve para comprobar la misma empresa y la misma cuenta.
- Además, `org_id` admite nulos (`0002:96-100`), y una FK compuesta normal no comprueba una fila con `org_id` nulo.
- Arreglo: «FK compuesta `(stakeholder_id, account_id, org_id)` → `stakeholders(id, account_id, org_id)`, con `unique` en el destino y `on delete set null (stakeholder_id)`. Lo mismo para `(icp_profile_id, org_id)`. Con `org_id not null` [Por verificar: que no haya nulos en producción]. Si no, trigger».

**12. Media. No se declara el solape con los SDD 1b y 5b del control tower.**
- 1b rehace Inicio (`SDD-…-1b…:40`, CA-63 `:94`). 5b oculta tarjetas en Inicio (CA-21 `:75`) y cierra la lista de mensajes por iniciativa propia (CA-1 y CA-2 `:51-52`).
- §14 (`SDD:234`) solo menciona NK-0051.
- Arreglo para §14 y CA-23: «la tarjeta se conserva como bloque propio bajo el titular de 1b. `stakeholder_followup` es una sugerencia en la app de prioridad 2, así que no es un mensaje del agente según 5b CA-1 ni entra en la lista cerrada de CA-2».

**13. Baja. La «fecha en que se marcó como objetivo» no existe.**
- Evidencia: `accounts.is_target` es solo un booleano (`0001:90`), y §10 no añade ninguna fecha. Lo usa CA-2 en `SDD:97-98`.
- Arreglo: añadir `target_since timestamptz` en §10 o dejar solo «por fecha de creación».

**14. Baja. La lista de lectores de `account_touches` está incompleta.**
- Evidencia: `SDD:39`. Faltan `src/hooks/screen-queries.ts:25`, `accounts.index.tsx:72`, `accounts.$id.tsx:51`, `abm.tsx:50,69` y `field-baseline.ts:9`.
- La conclusión no cambia: la columna nueva no les afecta.

**15. Baja. Varias ambigüedades en la guía.**
- El nivel 5 no dice si cuenta las cuentas objetivo de la empresa o las de la persona. Con CA-3, un AE con 2 cuentas recibiría el aviso siempre.
- CA-1 dice que siempre hay una acción y CA-4 que puede no haber ninguna.
- «Sin Decisor» no significa lo mismo que en el detector actual, que exige al menos un stakeholder (`no-decision-maker.ts:9`).
- En §8, «sin email ni LinkedIn» y «log_touch doble» apuntan a CA-21, que no los cubre.

**16. Baja. La caché de borradores está a medias.**
- §11 (`SDD:201`) no dice dónde se guarda la caché, y §10 no lo declara.
- La clave no incluye la huella del posicionamiento ni de los pilares, así que un borrador cacheado no cambia cuando cambia la estrategia.

**17. Baja. Incoherencias de texto.**
- §17 anuncia 6 Medias y 4 Bajas, pero lista 7 y 5 (`SDD:263-277`).
- `SDD:23` dice «revisado por el gate», y la v2 no lo está (`SDD:282`).
- `PRD:73` da por abierta la pregunta de la guía frente al tablero, que ya está decidida en `PRD:67`.
- La pregunta 4 no lleva recomendación (`SDD:248`).

**18. Baja. Faltan dos contextos.**
- El motivo para ir antes de la salida de Lovable (`PRD:35,64`) omite que producción no tiene tabla de migraciones y que se aplican a mano (`docs/sdd/annex/migraciones-pendientes-lovable-20261101.md`).
- No se considera la tabla `activities`, que ya existe sin versionar y tiene `account_id` y `person_id` (`annex/esquema-sin-versionar-20261106.md:24`).

**19. Baja. Una afirmación del PRD no se sostiene en el código.**
- Evidencia: `PRD:23` dice que «las tareas de leads sí aplican el ICP». Solo lo aplican `discoveries.server.ts:86` y `runner.ts:391`.
- Arreglo: borrar «y las tareas de leads» o citar el archivo.

**20. Baja. Dos rutas de test no siguen las convenciones del repo.**
- No hay tests en `src/routes/`, salvo `src/test/app-routing.test.tsx`. Mejor extraer la tarjeta a `src/components/home/execution-card.tsx` con su test.
- No hay tests dentro de `src/lib/proactive/detectors/`. Esa ruta es válida para vitest, pero sería la primera.

**El resto se confirma en el código.** Son correctas las citas de PRD §3 y SDD §3 y §13: `setup-schema.ts:49`, `org-data.ts:26`, `key-people.tsx:49-50`, `runner.ts:376`, `icp.ts:99`, `roles.ts:35`, `ai-core.ts:90`, `followup.ts:12`, `home.tsx:41,66-70`, `account-signal.ts:15`, `accounts.ts:135,167,315,388`, `autopilot.server.ts:81`, `0002:117-124` y `match.ts:7`. Todos los CA citan un G-n que existe, todos aparecen en alguna unidad y todo el copy usa «tú». No hay datos de clientes.

#### Objeciones de la v1 que siguen sin resolver
- **Alta 4 (Apify):** parcial. Ver hallazgo 1.
- **Alta 2 (toque hecho):** existe, pero la regla del paso es contradictoria. Ver hallazgo 4.
- **Alta 3 (grupo de compra):** la decisión está tomada, pero falta el efecto de A-6. Ver hallazgo 6.
- **Media, divergencia con `icpForSegment`:** ahora hay contradicción entre §6 y CA-9. Ver hallazgo 3.
- **Media, pruebas que no pueden fallar primero:** siguen las de CA-21, CA-30, CA-16 y CA-28. Ver hallazgos 2 y 8.
- **Media, conflicto de migraciones:** el mecanismo propuesto no existe. Ver hallazgo 7.
- **Bajas, «criterio de más antiguo» y «casos límite sin CA propio»:** parciales. Ver hallazgos 13 y 15.

#### Requisitos de proceso que faltan para fusionar
1. **§17 no es el informe del gate.** `nokko-shape` y `templates/sdd.md` exigen copiarlo sin editar. La §17 actual es un resumen del autor que declara resueltas sus propias objeciones (GROUND-RULES 4). Hay que sustituirla por este informe, copiado sin editar, y dejar el resumen de la v1 como historial.
2. **Las correcciones de CA requieren tu OK.** Hay que subir el SDD a v2.1 con fecha. La cabecera actual ya es válida: el regex de `ledger.mjs:130` acepta «Aprobado».
3. **No hace falta nada más antes de fusionar:**
   - `tickets.toml` es un resto de BMAD (`docs/PROCESO.md` §8).
   - El ledger real es `.factory/ledger.json`, y lo escribe `nokko-tracker` en PR `chore(factory)` aparte (`ea5cbc8`, `075f0b2`).
   - Los PR de docs recientes (`f3dc64d`, `3bfe004`, `e544483`) no tocan el ledger ni los índices. `docs/sdd/README.md` solo cubre la iniciativa del 2026-10-25.
   - No hace falta número NK para fusionar.
4. **Después de fusionar:** `ledger.mjs log "<título>" --kind feature --sdd docs/sdd/SDD-20261106-founder-account-execution-path.md --prd docs/prd/PRD-20261106-founder-account-execution-path.md`. `log` y `doc` exigen que los archivos estén ya en el checkout principal. Sin ticket no hay `promote` ni brief.
5. La rama parte de `fd43083`. `origin/main` ya va por `b878e6f` (PR #87), que no toca estos archivos, así que no hay conflicto.

#### Lo que esta revisión NO demuestra
- No ejecuté `gate.mjs`, tests, tipos ni build.
- No miré producción: ni la línea base de G-2, ni que `org_id` no tenga nulos, ni qué migraciones están aplicadas.
- El contenido de `PLAN-MAESTRO-NOKKO.md` y la existencia de `reseal-journal.mjs` están fuera del repo y no los verifiqué.
- Solo vi las ramas remotas que hay tras `git fetch`. Puede haber otras `0074` o `0077` en máquinas ajenas.
- No comprobé que `pg-harness` modele una FK compuesta con `on delete set null (col)`.
- No sé si el modelo respeta «(hipótesis)», ni si el valor para los founders es real.
- Tampoco sé si cambiarán las ramas de Plays, de tool-plan y de los avisos de dinero.

Archivos revisados:
- `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio-docs-founder-path/docs/prd/PRD-20261106-founder-account-execution-path.md`
- `/Users/fedecosentino/NOKKO GTM BRAIN/seller-strategy-studio-docs-founder-path/docs/sdd/SDD-20261106-founder-account-execution-path.md`

### Respuesta del autor a la revisión 2
**Hallazgo 3:** la v2.1 no sigue el arreglo propuesto, para no cambiar Descubiertos. Tras la revisión 3, todo lo que trabaja sobre una cuenta usa una sola regla: el ICP elegido, el del segmento o, si no, el que mejor encaja (la de `accountFit`). Descubiertos queda fuera porque trabaja sobre empresas candidatas. Esto cierra también los hallazgos nuevos 1 a 3 de la revisión 3.

### Historial: revisión 1 (sobre la v1, 2026-11-06)
Resumen del autor, no es el informe del gate. Veredicto: Objeciones. Hubo 14: 4 Altas (Buscar personas clave sin ICP, toque hecho, grupo de compra de GTM Lab, Apify en el borrador), 7 Medias y 3 Bajas, más correcciones de cita. La v2 las abordó y la revisión 2 encontró las que quedaron a medias.

### Revisión 3 (sobre la v2.1, commit `f1c9f81`, 2026-11-06). Informe copiado sin editar (solo se han bajado de nivel los encabezados)

**Veredicto: fusionable con cambios menores.** El contenido está casi listo: los 20 hallazgos de la revisión 2 quedan resueltos o muy cerca. Pero todavía no se puede fusionar por proceso. Hacen falta tu OK a la v2.1, este informe copiado en §17 y tu orden explícita de fusionar (`nokko-shape`). Los cambios de texto de abajo deberían entrar antes de ese OK.

#### Hallazgos de la revisión 2 todavía abiertos

- **H. 4 (parcial). CA-22 no dice cómo se sabe que un paso está hecho.** En leads, la regla se apoya en `next_step_at` (`followup.ts:46`). Los stakeholders no tienen esa columna, y §10 no guarda los pasos hechos (`SDD:211-216`). §13 dice que «el estado más los toques bastan» (`SDD:258`), pero falta la regla que lo deduce.
  - **Arreglo en CA-22:** «Un paso está hecho si existe un toque con esa persona con `occurred_at` ≥ fecha del paso, sin contar el del primer contacto».
- **H. 3. La regla es coherente pero incompleta, y CA-10 no se puede probar con el test que cita.** Lo detallo en los hallazgos nuevos 1 a 3.
- **Resueltos:** 1, 2 (falta poco), 5 a 20.
  - **H. 1:** el código actual siempre lista al menos una fuente de LinkedIn cuando hay publicaciones. La web aporta 8 como máximo y el corte es en 10 (`web-research.ts:118`), así que detectar por fuente funciona.
  - **H. 2:** el SDD no dice que el test debe crear `stakeholders` y `account_touches` en el arnés, como pedía el gate. Solo §16 lo apunta de lado.

#### Hallazgos nuevos

1. **Media. Hay una cuarta regla de ICP por cuenta y el SDD no la menciona.** `accountFit` usa el ICP del segmento y, si no hay, el que mejor encaja, no el primero (`src/lib/scoring.ts:121-124`). La usan la lista y la ficha de cuentas (`accounts.index.tsx`, `accounts.$id.tsx`, vía `scoreAccount`).
   - Efecto: el bloque puede decir «ICP: A» mientras la columna Encaje mide contra B. Y «Cambiar ICP» no cambiaría el Encaje.
   - También queda incompleto §3 (`SDD:50`).
   - **Arreglo:** declararlo en §3 y decidir si `accountFit` respeta `icp_profile_id`. Si no, ponerlo en «No incluye» con su motivo.
2. **Media. Descubiertos solo mira los 3 primeros ICP** (`discoveries.server.ts:38`, `.limit(3)`).
   - Con más de 3 ICP, ya hoy la búsqueda de personas (`runner.ts:386-391`, sin límite) y Descubiertos dan resultados distintos para la misma cuenta.
   - Las dos frases de CA-10 (`SDD:144`, «mismo resultado» y «sin elección, el de hoy») chocan entre sí.
   - Si una cuenta elige un ICP fuera de esos 3, Descubiertos nunca la procesa.
   - **Arreglo:** quitar el límite o aceptarlo en CA-10, y añadir una fila en §8.
3. **Media. CA-10 no se puede probar con `icp.test.ts`.** Un test de la función pura no demuestra que el runner, Descubiertos, `key-people.tsx`, el bloque, el nivel 4 de la guía y la columna de `/accounts` la llamen.
   - **Arreglo en CA-10:**
     - nombrar también el nivel 4 de la guía y la columna «Comité»;
     - añadir pruebas por ruta (por ejemplo, `key-people.test.tsx` y un caso del runner);
     - fijar que «el primero» es por `created_at`, como ya ordenan `runner.ts:388` y `discoveries.server.ts:38`.
4. **Baja. Los canales de CA-21 no son los del sistema.** CA-21 (`SDD:163`) dice teléfono y otro. `TOUCH_CHANNELS` (`agent/tools/accounts.ts:22-30`) usa `call` y `meeting`, y no tiene «otro». **Arreglo:** mapear los canales en §10 o añadir `other` a la lista.
5. **Baja. La huella de la caché no incluye el rol ni el cargo** (`SDD:214`), aunque CA-14 los usa (`SDD:151`). Si cambias el rol, el borrador cacheado queda viejo. **Arreglo:** incluirlos en la huella.
6. **Baja. CA-31 junto a CA-20 es ambiguo.** No está claro si el borrador de un toque sobrescribe `message_draft` (`SDD:160`, `SDD:177`). **Arreglo:** decir si se guarda o no.
7. **Baja. Trazabilidad de §12.**
   - U-4 cierra CA-31 pero no lista `stakeholder-sequence.test.ts` (`SDD:243`).
   - U-4 (`set_stakeholder_contact`) depende de `setStakeholderContact` de U-3, aunque §12 los pone en paralelo (`SDD:246`).
8. **Baja. La mitad de CA-16 que mide la calidad no es una prueba automática.** El caso en `src/lib/gtm-lab/eval/` es una evaluación con IA, no un test que pueda fallar primero. **Arreglo:** decirlo en CA-16.
9. **Baja, de proceso. El encabezado de Estado engaña al ledger.** El regex de `ledger.mjs:130` lee «Aprobado» en `SDD:4` y `PRD:4`, aunque la v2.1 está pendiente. Si se fusiona así, `promote` aceptaría un SDD sin aprobar. **Arreglo:** no fusionar hasta tu OK y entonces poner «Aprobado por Fede el <fecha> (v2.1)».

**Viabilidad de la FK compuesta (punto 5): sí es viable.** `on delete set null (col)` existe desde PG 15. Por la documentación del repo, no por mí:
- producción es PostgreSQL 17.11;
- PGlite 0.5.x es PG 18 (`SDD-20261030-money-moment-notices.md:390,406`).

No hay código que mueva un stakeholder de cuenta, así que el `ON UPDATE NO ACTION` por defecto no rompe nada. Hace falta declarar explícitamente:
- `unique (id, account_id, org_id)` en `stakeholders` y `unique (id, org_id)` en `icp_profiles`;
- `org_id not null` en las tablas que referencian (`account_touches` y `accounts`), porque con MATCH SIMPLE un `org_id` nulo se salta la comprobación.

**Rutas de test (punto 4): todas en orden.**
- Existen `src/lib/agent-tools.test.ts`, `src/lib/proactive.test.ts`, `src/test/pg-harness.ts`, `src/lib/migrations.pg.test.ts`, `src/lib/icp.test.ts` y `src/lib/gtm-lab/eval/`.
- Todas las rutas nuevas encajan en `src/**/*.{test,spec}.{ts,tsx}`, también `*.pg.test.ts`.
- Ya hay tests en subcarpetas de `src/components/` (`setup/`, `onboarding/`), así que `home/execution-card.test.tsx` sigue la convención.

#### Integridad del §17

Comparé `SDD:304-446` con el informe original de la revisión 2, recuperado del transcript del subagente (`subagents/agent-ae3bebd3939f37b4d.jsonl`). **El cuerpo es idéntico palabra por palabra**, aparte de los niveles de encabezado. Hay dos desviaciones:
- Se omitieron las tres líneas finales «Archivos revisados», con las rutas locales. Es menor, pero técnicamente es una edición: conviene restaurarlas o anotarlo en el título.
- La «Nota del autor sobre el hallazgo 3» (`SDD:447`) está dentro de la subsección del informe, sin encabezado propio, y se puede leer como texto del gate. **Arreglo:** moverla a un apartado «Respuesta del autor».

Para fusionar falta además:
- copiar este informe sin editar en «Revisión 3»;
- tu OK a la v2.1;
- tu orden de fusionar.

La rama no tiene conflicto con `origin/main` (`b878e6f`), que solo toca otros dos SDD.

#### Lo que esta revisión NO demuestra

- No ejecuté tests, tipos, build ni `gate.mjs`. `node_modules` no está instalado en el worktree, así que no vi la versión real de PGlite ni probé la FK en él.
- No miré producción: ni la versión de Postgres, ni los `org_id` nulos, ni la línea base de G-2.
- No verifiqué el plan maestro, `reseal-journal.mjs` ni ramas fuera de origin.
- No sé si el modelo respeta «(hipótesis)», ni si el harness de evaluación de GTM Lab admite un caso que no sea de GTM Lab.

## 18. Delta de implementación (lo rellena el agente al entregar)
—
