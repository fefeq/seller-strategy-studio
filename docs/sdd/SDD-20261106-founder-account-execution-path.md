# SDD-20261106-founder-account-execution-path · [Feature] De la estrategia a la cuenta: comité, primer mensaje, seguimiento y guía de ejecución

**Tipo:** Feature · **Prioridad propuesta:** Alta
**Estado:** Aprobado por Fede el 2026-11-06 (v2, con las recomendaciones de §15) · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**PRD:** `docs/prd/PRD-20261106-founder-account-execution-path.md` · **Depende de:** — (recomendado detrás de NK-0051 para no pisar `home.tsx`)

> Un SDD dice cómo se verifica que está bien hecho. Cada criterio de aceptación (CA-n) debe poder tener una prueba automática que lo nombre.
> Cada CA-n cita el objetivo G-n del PRD que cubre.

## 1. Resumen
Hoy NOKKO deja de guiar al founder cuando termina la configuración. Este SDD añade cuatro cosas sobre las cuentas objetivo:
- la cobertura del comité de compra frente a los cargos del ICP;
- un borrador de primer mensaje por stakeholder;
- un estado de contacto con su propia secuencia de seguimiento;
- una guía en Inicio con la siguiente acción.

Nada se envía solo: todo son borradores y sugerencias.

## 2. Problema y para quién
Heredado del PRD §1 y §2. El founder (Owner), y cualquier miembro con cuentas objetivo, no sabe qué hacer después de configurar la estrategia y no tiene seguimiento de las personas a las que escribe en esas cuentas.

## 3. Evidencia y por qué ahora
Heredado del PRD §3: todo es dato de código en `main` (`a6597a0`), el uso es **sin dato** y la iniciativa es una apuesta declarada de Fede. Comportamiento actual relevante, comprobado en el código el 2026-11-06 y revisado por el gate:

- **Guía de configuración** (`src/lib/setup-guide.ts`; `SETUP_ITEMS` en `src/lib/setup-schema.ts:49`).
  - Termina en «Primeras cuentas objetivo» y «Pipeline: al menos un deal».
  - El paso de cuentas cuenta cualquier cuenta, sea objetivo o no (`src/lib/org-data.ts:26`, sin filtro `is_target`).
  - Después no propone nada más.
- **«Tu siguiente paso» en Inicio** (`src/routes/_authenticated/home.tsx:68`) es el mazo con las 5 primeras sugerencias.
  - Sobre cuentas objetivo hay dos reglas: `no_decision_maker` y `account_signal` (prioridad 2 para objetivo, `src/lib/proactive/detectors/account-signal.ts:15`).
  - Ninguna ordena la ejecución de punta a punta.
- **«Buscar personas clave» desde la cuenta no usa el ICP.**
  - El diálogo empieza con los niveles por defecto (`src/components/orchestrator/key-people.tsx:50`) y los envía siempre.
  - El ICP solo se aplica cuando no llegan ni cargos ni niveles (`src/lib/orchestrator/runner.ts:376`).
  - Sí lo usan Descubiertos y las tareas de leads.
- **Elección del ICP de una cuenta:** la regla es `icpForSegment` (`src/lib/icp.ts:99`): el ICP del segmento o, si no hay, el primero.
- **`stakeholders`** (migración `0000`) tiene rol de compra, postura, prioridades, jefe directo e investigación. No tiene estado de contacto.
- **La investigación del stakeholder** incluye «De qué habla en LinkedIn», con publicaciones obtenidas por Apify (`src/lib/ai-core.ts:98-117`).
- **`account_touches`** (migraciones `0001`/`0002`) registra toques por cuenta y canal, sin persona. Sus lectores (`autopilot.server.ts:81`, `agent/tools/accounts.ts:135,167`) solo usan `account_id` y `occurred_at`.
- **RLS:** es por empresa, no por cuenta (`0002:119-123`).
- **Secuencia de los días 3, 7 y 14:** es pura y solo de leads (`src/lib/followup.ts`; fin a los 21 días, `SEQUENCE_END_DAYS`, `:12`). Un paso se cierra con `next_step_at`.
- **Normalización de cargos:** no hay ninguna reutilizable. `normName` de `match.ts` es para nombres de empresa.
- **Migraciones:** hay conflicto de numeración. En ramas existen dos `0077` (`plays_library_core` e `integrations_owner_write`) y dos `0074`, y la `0078` está reservada para los avisos de dinero.

## 4. Resultado buscado
G-1 a G-5 del PRD §4. Todas las líneas base están en «sin dato». La de G-2 se mide con una consulta de solo lectura antes de construir **[Por verificar]**.

## 5. Alcance
**Incluye:**
- Cobertura del comité por cuenta objetivo: cargos del ICP frente a stakeholders mapeados, y si hay Decisor.
- «Buscar personas clave» que abre con los cargos pendientes y los niveles del ICP.
- Borrador de primer mensaje por stakeholder: email con asunto, o texto breve para LinkedIn sin asunto, para copiar.
- Estado de contacto del stakeholder y su secuencia de los días 3, 7 y 14, con borrador y «Marcar toque hecho» en cada paso.
- Guía de ejecución en Inicio y aviso por toque vencido.
- Columna de cobertura en la lista de cuentas para las marcadas como objetivo.

**No incluye:** heredado del PRD §5, más:
- usar el «grupo de compra» de GTM Lab, que hoy no se publica (pregunta 3);
- cambiar la investigación del stakeholder;
- tocar `/plays` y `/abm`.

## 6. Cambios de comportamiento (delta)
**Añadido:**
- **Bloque «Comité de compra»** en la pestaña Stakeholders: cargos del ICP como cubiertos o pendientes, aviso si falta el Decisor y botón «Buscar los que faltan».
- **Estado de contacto** guardado en cada stakeholder: Sin contactar, Contactado, Respondió, Reunión o Descartado. «Sin respuesta» se calcula y no se guarda.
- **Siguiente toque** del stakeholder con su fecha, y el botón «Marcar toque hecho».
- **«Preparar primer mensaje»** y borrador del toque vencido.
- **Tarjeta «Siguiente acción con tus cuentas»** en Inicio.
- **Aviso `stakeholder_followup`.** Es una regla fija como `followup_sequence` y no pertenece a ningún play.
- **Herramientas del agente:** `draft_stakeholder_message` (lectura) y `set_stakeholder_contact` (escritura con confirmación), junto a `update_stakeholder`.
- **Columna «Comité»** en `/accounts` para las cuentas objetivo.

**Modificado:**
- **«Buscar personas clave» desde la cuenta.**
  - Antes: siempre abre con los niveles por defecto y no aplica el ICP.
  - Después: abre con los cargos y niveles del ICP de la cuenta, o con los cargos pendientes si viene de «Buscar los que faltan».
- **Elegir el ICP de una cuenta.**
  - Antes: el del segmento o, si no, el primero.
  - Después: primero el ICP elegido para esa cuenta, si lo hay; si no, la regla de antes. Se aplica igual en todas las rutas.
- **`account_touches`.**
  - Antes: sin persona.
  - Después: con persona opcional.
  - Registrar un contacto o un toque hecho crea un toque de cuenta. El engagement ABM sube **por diseño** con esos toques.
- **Inicio.**
  - Antes: solo el mazo de sugerencias.
  - Después: la tarjeta de ejecución va encima cuando aplica.

**Eliminado:** nada.

## 7. Historias y criterios de aceptación

### H-1: Como founder, quiero ver en Inicio cuál es mi siguiente acción con las cuentas objetivo para no tener que decidir por dónde seguir.
- **CA-1** MIENTRAS la empresa tenga al menos un ICP, Inicio DEBE mostrar una única siguiente acción de ejecución. Debe incluir la cuenta, la persona si aplica, el motivo en una frase y un enlace al sitio donde se hace · cubre G-1 · prueba: `src/routes/_authenticated/home.test.tsx`
- **CA-2** La guía DEBE elegir la acción en este orden fijo:
  1. toque de seguimiento vencido, el de fecha de vencimiento más antigua;
  2. stakeholder sin contactar al que se le preparó un borrador, el de borrador más antiguo;
  3. cuenta objetivo sin Decisor, la más antigua según la fecha en que se marcó como objetivo, o según la de creación si no hay;
  4. cuenta objetivo con cargos del ICP sin mapear, con el mismo criterio;
  5. menos de 5 cuentas objetivo, incluido el caso de 0.

  · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`
- **CA-3** La guía DEBE tener en cuenta solo las cuentas asignadas a la persona y, si es Owner o Sales leader, también las que no tienen dueño · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`
- **CA-4** CUANDO no quede ninguna acción pendiente, Inicio DEBE mostrar «Estás al día con tus cuentas objetivo» y un enlace para añadir cuentas · cubre G-1 · prueba: `src/routes/_authenticated/home.test.tsx`
- **CA-5** El estado de la guía DEBE salir siempre de los datos y no guardarse aparte. Marcar algo en cualquier canal (web, agente o Telegram) cambia la siguiente acción · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`
- **CA-6** SI el aviso `no_decision_maker` está oculto porque su play está en pausa (cuando Plays esté integrado), ENTONCES la guía DEBE saltarse el nivel 3 · cubre G-1 · prueba: `src/lib/execution-guide.test.ts`

### H-2: Como founder, quiero ver qué personas del comité de compra me faltan en cada cuenta objetivo para saber a quién buscar.
- **CA-7** El bloque «Comité de compra» DEBE listar los cargos objetivo del ICP de la cuenta y marcar cada uno como «Cubierto» si un stakeholder tiene un cargo equivalente según la regla de equivalencia, o como «Pendiente» si no · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`
- **CA-8** La regla de equivalencia de cargos DEBE ignorar mayúsculas, acentos y signos, y tratar como equivalentes los sinónimos de nivel de una lista cerrada que se revisa en la prueba · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`
- **CA-9** El ICP de una cuenta DEBE ser:
  1. el elegido para esa cuenta, si existe;
  2. si no, el de su segmento;
  3. si no, el único que tenga la empresa.

  SI hay varios y ninguno encaja, ENTONCES el bloque DEBE pedir que elijas uno y guardarlo · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`
- **CA-10** Toda ruta que elige el ICP de una cuenta (búsqueda de personas, Descubiertos, bloque del comité) DEBE dar el mismo resultado para la misma cuenta · cubre G-2 · prueba: `src/lib/icp.test.ts`
- **CA-11** SI el ICP no tiene cargos objetivo, ENTONCES el bloque DEBE decir «Tu ICP no dice a qué cargos dirigirte» y enlazar a Estrategia, ICP · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`
- **CA-12** «Buscar personas clave» abierto desde la cuenta DEBE empezar con los cargos y niveles del ICP de la cuenta. Desde «Buscar los que faltan», DEBE empezar solo con los cargos pendientes. SI la cuenta no tiene dominio, ENTONCES DEBE decir que lo añadas, como hoy · cubre G-2 · prueba: `src/components/orchestrator/key-people.test.tsx`
- **CA-13** La lista de cuentas DEBE mostrar, en las cuentas objetivo, la cobertura como «cubiertos de total, con o sin Decisor» · cubre G-2 · prueba: `src/lib/buying-committee.test.ts`

### H-3: Como founder, quiero un borrador de primer mensaje para cada stakeholder para saber qué decirle.
- **CA-14** CUANDO pidas «Preparar primer mensaje», el sistema DEBE devolver un borrador que use:
  - el rol de compra, el cargo y la investigación del stakeholder, si existe;
  - el posicionamiento y los pilares de mensaje de la empresa.

  El formato depende del canal elegido: email con asunto, o LinkedIn sin asunto · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts` (la entrada del modelo y la plantilla) y el arnés de eval (la calidad)
- **CA-15** La entrada del borrador NO DEBE incluir la sección «De qué habla en LinkedIn» de la investigación guardada · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-16** El borrador DEBE marcar como «(hipótesis)» todo lo que no venga de la investigación (sin la sección de LinkedIn) ni de la estrategia de la empresa · cubre G-3 · prueba: arnés de eval (`SDD-20261102-ai-eval-harness`)
- **CA-17** SI el stakeholder no tiene investigación, ENTONCES el borrador DEBE avisar «Sin investigación: el mensaje es genérico para su rol» · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-18** SI la empresa no tiene posicionamiento ni pilares, ENTONCES el borrador DEBE avisar «Sin posicionamiento: completa Estrategia para mensajes con tu diferencia» y no inventar una diferencia · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-19** SI la IA falla o no hay presupuesto, ENTONCES el sistema DEBE decir «No he podido preparar el borrador: [motivo]. Vuelve a intentarlo o escríbelo tú» y no cambiar nada · cubre G-3 · prueba: `src/lib/stakeholder-message.test.ts`
- **CA-20** Preparar un borrador NO DEBE enviar nada ni cambiar el estado del stakeholder · cubre G-5 · prueba: `src/lib/stakeholder-message.test.ts`

### H-4: Como founder, quiero registrar a quién he escrito y que NOKKO me recuerde volver a escribirle para que nadie se quede sin seguimiento.
- **CA-21** CUANDO marques a un stakeholder como «Contactado» con canal y fecha, el sistema DEBE:
  - guardar el estado;
  - crear un único toque de cuenta con esa persona;
  - calcular los toques de los días 3, 7 y 14 desde esa fecha.

  · cubre G-3, G-4 · prueba: `src/lib/stakeholder-sequence.test.ts` y `drizzle/migrations.pg.test.ts`
- **CA-22** CUANDO marques «Toque hecho», el sistema DEBE crear un toque de cuenta con esa persona y dar ese paso por cerrado. El paso siguiente sale del número de toques hechos desde el contacto · cubre G-4 · prueba: `src/lib/stakeholder-sequence.test.ts`
- **CA-23** CUANDO un toque venza y el stakeholder siga en «Contactado» con ese paso sin hacer, el sistema DEBE crear un único aviso para el dueño de la cuenta, o para Equipo si no tiene dueño, con enlace al stakeholder · cubre G-4 · prueba: `src/lib/proactive/detectors/stakeholder-followup.test.ts`
- **CA-24** CUANDO marques «Respondió», «Reunión» o «Descartado», la secuencia DEBE pararse y no crear más avisos · cubre G-4 · prueba: `src/lib/stakeholder-sequence.test.ts`
- **CA-25** CUANDO hayan pasado 21 días (`SEQUENCE_END_DAYS`) desde el contacto sin otro estado, el stakeholder DEBE mostrarse como «Sin respuesta», calculado y no guardado, y salir de la guía · cubre G-4 · prueba: `src/lib/stakeholder-sequence.test.ts`
- **CA-26** CUANDO se borre un stakeholder, sus avisos de seguimiento pendientes DEBEN desaparecer · cubre G-4 · prueba: `src/lib/proactive/detectors/stakeholder-followup.test.ts`
- **CA-27** CUANDO marques «Reunión», el sistema DEBE ofrecer crear una reunión o un deal en la cuenta, sin crearlos solo · cubre G-4 · prueba: `src/components/account/stakeholders-tab.test.tsx`
- **CA-28** El agente DEBE poder cambiar el estado de contacto o marcar un toque hecho solo con confirmación · cubre G-5 · prueba: test de las herramientas de cuentas del agente
- **CA-29** La secuencia del stakeholder NO DEBE crear ni modificar leads, ni contar en la conversión por origen · cubre G-3 · prueba: `src/lib/stakeholder-sequence.test.ts`

### H-5: Como Owner, quiero que los datos de una empresa no se crucen con los de otra.
- **CA-30** SI un toque de cuenta apunta a un stakeholder de otra cuenta o de otra empresa, o una cuenta apunta a un ICP de otra empresa, ENTONCES la base de datos DEBE rechazarlo · cubre G-2, G-3 · prueba: `drizzle/migrations.pg.test.ts` (dos empresas ficticias)

## 8. Casos límite y errores
| Caso | Comportamiento | CA |
|---|---|---|
| Empresa sin ICP | No hay guía de ejecución; sigue la de configuración | CA-1 |
| ICP sin cuentas objetivo | Nivel 5: «marca o añade tus cuentas objetivo» | CA-2 |
| ICP sin cargos objetivo | Aviso y enlace a Estrategia | CA-11 |
| Varios ICP y ninguno encaja | Pide elegir uno y lo guarda | CA-9 |
| Cuenta sin dominio | Explica que falta el dominio | CA-12 |
| Cargos parecidos pero distintos | Regla de equivalencia cerrada | CA-8 |
| Stakeholder sin email ni LinkedIn | Se puede marcar como contactado por otro canal | CA-21 |
| Sin investigación o sin posicionamiento | Borrador avisado | CA-17, CA-18 |
| IA caída o sin presupuesto | Mensaje de error y nada cambia | CA-19 |
| Contacto marcado en el pasado (hace más de 14 días) | Los toques salen de esa fecha; solo avisa el último toque vencido sin hacer | CA-21, CA-23 |
| Stakeholder borrado | Sus avisos desaparecen | CA-26 |
| Mismo contacto registrado también con `log_touch` | Cuenta dos toques. Esta pantalla no usa `log_touch` | CA-21 |
| Datos de otra empresa | Rechazados por la base | CA-30 |

## 9. Experiencia y copy
Español, con «tú», sin iconos y con los estados escritos en palabras. Los ejemplos usan datos ficticios.
- **Tarjeta de Inicio.** Eyebrow «Siguiente acción con tus cuentas». Ejemplos:
  - «Hoy toca el segundo toque a la directora de operaciones de Empresa Ejemplo. Le escribiste hace 7 días y no ha contestado.» Botón «Preparar mensaje».
  - «Empresa Ejemplo no tiene Decisor en el mapa.» Botón «Buscar personas».
- **Comité de compra:** «Cargos de tu ICP: 2 de 4 cubiertos. Falta el Decisor.» Botón «Buscar los que faltan».
- **Estados:** Sin contactar · Contactado · Respondió · Reunión · Sin respuesta · Descartado.
- **Borrador:** «Borrador para copiar. NOKKO no lo envía.» Botones «Copiar» y «Marcar como contactado».
- **Errores:** siempre «qué pasó + qué hacer».

## 10. Datos, permisos y privacidad
*[Sugerencia — la revisión del gate valida]*
- **`stakeholders`:** columnas nuevas.
  - `contact_status`: texto con check (`not_contacted`, `contacted`, `replied`, `meeting`, `discarded`); por defecto `not_contacted`. «Sin respuesta» se calcula.
  - `contacted_at`, `contact_channel`, `contact_updated_at`.
  - `message_drafted_at`: para el nivel 2 de la guía.
- **`account_touches`:** `stakeholder_id` opcional (`on delete set null`), con check o trigger de misma empresa y misma cuenta.
- **`accounts`:** `icp_profile_id` opcional, con check o trigger de misma empresa.
- **Común:**
  - `org_id default current_org()`; el cliente no envía `org_id`.
  - Hereda la RLS actual, que es por empresa.
  - Cada columna nueva va en `src/lib/field-catalog.ts`.
- **Roles:** todos los miembros preparan borradores y registran contactos en las cuentas que ven. La guía filtra por dueño (CA-3).
- **Privacidad:**
  - No se añade ninguna fuente de LinkedIn.
  - El borrador no usa la sección de LinkedIn de la investigación (CA-15).
  - Ningún dato real en tests.

## 11. Llamadas a IA
| Llamada | Orden de preferencia usado | Modelo y esfuerzo | Coste previo |
|---|---|---|---|
| Primer mensaje al stakeholder (CA-14) | regla (sin investigación ni posicionamiento: plantilla sin IA) → caché por stakeholder, canal y huella del texto de investigación → modelo barato | Modelo barato de `ai-gateway`, `effort:"low"` | sin dato |
| Toque de seguimiento (3, 7, 14) | regla (plantilla desde los pilares, como `followup.ts`) → modelo barato solo con «Reescribir con IA» | Modelo barato, `effort:"low"` | sin dato |
| Guía y cobertura del comité | ninguna (reglas puras) | — | 0 |

Una llamada no declarada aquí no se implementa.

## 12. Unidades de trabajo
| U | Qué entrega | CA que cierra | Test que falla primero |
|---|---|---|---|
| U-1 | Reglas puras: equivalencia de cargos, cobertura del comité, ICP de la cuenta, secuencia del stakeholder y orden de la guía | CA-2, CA-3, CA-5, CA-6, CA-7 a CA-11, CA-13, CA-22 (cálculo), CA-24, CA-25, CA-29 | `buying-committee.test.ts`, `stakeholder-sequence.test.ts`, `execution-guide.test.ts`, `icp.test.ts` |
| U-2 | Migración (número reservado en el ledger antes de empezar) y catálogo de campos | CA-21 (guardado), CA-30 | `drizzle/migrations.pg.test.ts` |
| U-3 | Pestaña Stakeholders, «Buscar personas clave» con ICP y columna en `/accounts` | CA-12, CA-27 | `key-people.test.tsx`, `stakeholders-tab.test.tsx` |
| U-4 | Borradores y herramientas del agente | CA-14 a CA-20, CA-28 | `stakeholder-message.test.ts` |
| U-5 | Detector `stakeholder_followup` y tarjeta de Inicio | CA-1, CA-4, CA-23, CA-26 | `stakeholder-followup.test.ts`, `home.test.tsx` |

Orden: U-1 → U-2 → (U-3 y U-4 en paralelo) → U-5.

## 13. Notas técnicas [Sugerencia — la revisión del gate las valida]
- **Reutilizar:**
  - `icpPeopleQuery`, `icpForSegment` (ampliado con el ICP elegido) e `icpBrief` (`src/lib/icp.ts`);
  - `FOLLOWUP_STEPS` y `SEQUENCE_END_DAYS` (`src/lib/followup.ts`);
  - el patrón puro de `setup-guide.ts` para `execution-guide.ts`;
  - el patrón de `followup-sequence.ts` para el detector, registrado en `src/lib/proactive/index.ts`;
  - `update_stakeholder` (`src/lib/agent/tools/accounts.ts:388`) como vecino de `set_stakeholder_contact`.
- **«Buscar personas clave»:** inicializar cargos y niveles desde el ICP en `key-people.tsx:49-50`, o dejar de enviar los niveles por defecto para que `runner.ts:376` aplique el ICP.
- **Tarjeta de Inicio:** `home.tsx:66-70`. NK-0051 toca el mismo archivo.
- **Equivalencia de cargos:** es nueva; `match.ts` no sirve (quita palabras pensadas para nombres de empresa).
- **Alternativas descartadas:**
  - una tabla de secuencias: el estado más los toques bastan;
  - leer el tablero de GTM Lab: aún no existe;
  - guardar `no_reply`: contradice CA-5.

## 14. Riesgos y dependencias
- **NK-0051** toca `home.tsx`: integrar después.
- **Migraciones en conflicto:** dos `0077` y dos `0074` en ramas, y la `0078` reservada. Hay que reservar número en el ledger antes de U-2 **[Por verificar]**.
- **Plays:** su SDD 7 (`multi-thread-inbound-leads`) debe reutilizar `buying-committee.ts`, y la guía respeta los plays en pausa (CA-6).
- **GTM Lab:** su Anexo A dice que el «grupo de compra» **no se publica**. Leerlo exige enmendarlo (pregunta 3).
- **La investigación sigue usando Apify** hasta U-0. Aquí se neutraliza en el borrador (CA-15), pero la investigación en sí no cambia.
- **Engagement ABM:** sube con los toques nuevos, por diseño. Si se registra además con `log_touch`, cuenta doble.
- **Sin instrumentación:** G-1 solo se verifica por prueba.

## 15. Preguntas para Fede y para la revisión técnica
**Decidido por Fede el 2026-11-06:** las preguntas 1 a 5 se resuelven con la recomendación escrita en cada una. La 6 sigue abierta para la revisión técnica.

1. **Fede · Calendario:** ¿antes de la salida de Lovable A? Recomiendo que sí: solo toca tablas versionadas.
2. **Fede · Secuencia:** ¿los mismos días 3, 7 y 14 que en leads? Recomiendo que sí.
3. **Fede · Grupo de compra de GTM Lab (contradicción).** Elegiste «ICP hoy, GTM Lab luego», pero el PRD aprobado de GTM Lab dice que el grupo de compra no se publica en NOKKO. ¿Enmendamos su Anexo A o el comité sale siempre del ICP? Recomiendo enmendar el Anexo A cuando se redacte GTM Lab SDD 7, y que hasta entonces salga del ICP.
4. **Fede · Umbral de 5 cuentas objetivo (CA-2):** es una propuesta sin dato. ¿Lo aceptas o prefieres otro?
5. **Fede · Guía frente al tablero de GTM Lab:** recomiendo que la guía siga saliendo de los datos y que el tablero enlace a ella.
6. **Revisión técnica:** ¿check o trigger para la misma empresa y cuenta (CA-30)?

## 16. Pendiente de verificar
| Qué | Quién o qué lo comprueba |
|---|---|
| Línea base de G-2 | Consulta de solo lectura en producción |
| Número de migración libre | Ledger y `drizzle/migrations` de todas las ramas abiertas |
| Coste por borrador | Registro de gasto de IA tras la entrega |

Resueltos por el gate: no hay normalización de cargos reutilizable. `stakeholder_id` no afecta a los lectores actuales de `account_touches`.

## 17. Revisión técnica independiente (la hace `nokko-gate`, no quien redactó)
Revisión de la v1 (2026-11-06), con contexto fresco, solo lectura y sin código ni `gate.mjs`.
- **Veredicto del gate:** Objeciones (14: 4 Altas, 6 Medias, 4 Bajas).
- **Altas, todas incorporadas en la v2:**
  1. «Buscar personas clave» no aplica el ICP desde la cuenta.
  2. No se podía marcar un toque como hecho.
  3. El grupo de compra de GTM Lab no se publica.
  4. El borrador aceptaba como hecho el contenido de Apify.
- **Medias, incorporadas:**
  - divergencia con `icpForSegment`;
  - faltaban CA de multiempresa;
  - `no_reply` guardado o calculado;
  - pruebas que no podían fallar primero;
  - conflicto de migraciones;
  - detector frente a plays;
  - caso de 0 cuentas objetivo.
- **Bajas, incorporadas:** casos límite sin CA propio, citas corregidas, criterio de «más antiguo», clave de caché y límite de caracteres de LinkedIn retirado por no tener fuente.
- **CA sin prueba posible o sin G-n:** CA-16 solo se puede probar con el arnés de eval.
- **[Por verificar] sin comprobar:** los de §16.
- **Contradicciones con el código o con decisiones previas:** GTM Lab Anexo A (pregunta 3).
- **Lo que esta revisión NO demuestra:** nada de producción; que las ramas de Plays, tool-plan y avisos no cambien; que los CA se puedan implementar con esas pruebas; el valor para los founders. No leyó los SDD 1b y 5b del control tower.
- **La v2 no ha pasado una segunda revisión del gate.**

## 18. Delta de implementación (lo rellena el agente al entregar)
—
