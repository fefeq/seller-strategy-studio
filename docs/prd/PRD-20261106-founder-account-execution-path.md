# PRD-20261106-founder-account-execution-path · [Feature] De la estrategia a la cuenta: el founder sabe a quién buscar, qué decirle y cuándo volver a escribirle

**Tipo:** Feature · **Prioridad propuesta:** Alta (es el recorrido que Fede describe como el uso principal de NOKKO, y hoy se corta después de la configuración; no hay datos de uso que lo confirmen)
**Estado:** Aprobado por Fede el 2026-11-06 (v2). v2.1 del 2026-11-06 con correcciones tras la segunda revisión del gate: pendiente del OK de Fede · **Pide:** Fede · **Aprueba:** Fede · **Fecha:** 2026-11-06
**SDD que lo desarrollan:** `docs/sdd/SDD-20261106-founder-account-execution-path.md`

> Un PRD dice qué se quiere y por qué. No dice cómo se construye ni cómo se prueba: eso es del SDD.

## 1. Problema
Un founder configura en NOKKO su estrategia: ICP, segmentos, posicionamiento, mensajes y cuota. Después NOKKO le deja solo. Para pasar de «tengo un ICP» a «hoy escribo a estas tres personas de estas cuentas, con este mensaje, y el jueves les vuelvo a escribir» tiene que saber a qué pantalla ir y en qué orden. Y cuando por fin escribe a alguien de una cuenta objetivo, NOKKO no le recuerda volver a escribirle.

## 2. Para quién
- **Owner (founder)** que vende él mismo a cuentas objetivo: es quien más lo sufre.
- **Sales leader, AE y SDR** con cuentas asignadas: mismo recorrido sobre sus cuentas.
- Sin nombres ni datos de clientes.

## 3. Evidencia y por qué ahora
Fuentes leídas el 2026-11-06 en `main` (`a6597a0`). Todo es **dato de código**; sobre uso real no hay nada (**sin dato**: NOKKO no tiene instrumentación, riesgo 1 de `INFORME-PRODUCTO-NOKKO-20261106.md`). Que los founders quieran este recorrido es una **apuesta declarada** de Fede.

Lo que ya existe y funciona por separado:
- **Configuración guiada** de 8 pasos (`src/lib/setup-schema.ts:49`, `src/lib/setup-guide.ts`). El último paso de cuentas se da por hecho con **una** cuenta (`d.accounts > 0`). Al completar los 8 pasos, la guía no propone nada más.
- **Buscar empresas del ICP** (herramienta del agente `find_icp_companies`) y **Descubiertos**.
- **Buscar personas clave** en una cuenta. Al abrirla desde la cuenta no aplica el ICP: empieza con los niveles por defecto (`src/components/orchestrator/key-people.tsx:50`, `src/lib/orchestrator/runner.ts:376`). Descubiertos sí lo aplica (`src/lib/discoveries.server.ts:86`).
- **Mapa de poder** por cuenta con rol de compra (Decisor, Champion, Influenciador, Bloqueador, Usuario) y postura (`src/components/account/stakeholders-tab.tsx`, `src/lib/roles.ts:35`).
- **Investigación de cada stakeholder** con prioridades, encaje y 3 aperturas de conversación, que marca como «(hipótesis)» lo que no tiene fuente (`src/lib/ai-core.ts:90`).
- **Aviso «falta identificar al decisor»** en cuentas objetivo (`src/lib/proactive/detectors/no-decision-maker.ts`).
- **Secuencia de seguimiento de días 3, 7 y 14**, pero **solo para leads** (`src/lib/followup.ts`, herramienta `draft_followup`).

Lo que no existe:
- Ningún punto de NOKKO dice «la siguiente acción con tus cuentas objetivo es esta».
- Ninguna pantalla compara los cargos que el ICP pide buscar con los que ya están mapeados en una cuenta.
- No hay un borrador de primer mensaje para un stakeholder: las aperturas son ideas sueltas dentro de un informe.
- Un stakeholder no tiene estado de contacto ni seguimiento. Los stakeholders y los leads son cosas distintas: la secuencia de leads no le llega.

**Por qué ahora:** GTM Lab (`PRD-20261101-gtm-lab-en-nokko`, aprobado) rehace la configuración y el plan, pero no cubre la ejecución sobre cuentas, y espera a la salida de Lovable. Esta capa usa tablas que ya están versionadas (`accounts`, `stakeholders`, migración `0000`), así que puede ir antes. En producción las migraciones ya se aplican a mano (`docs/sdd/annex/migraciones-pendientes-lovable-20261101.md`), así que ir antes no añade un proceso nuevo.

## 4. Objetivos
| ID | Objetivo | Cómo se mide | Línea base | Fuente |
|---|---|---|---|---|
| G-1 | El founder siempre ve cuál es su siguiente acción con las cuentas objetivo | Mientras haya cuentas objetivo con trabajo pendiente, Inicio muestra una siguiente acción concreta | sin dato (no existe) | Prueba automática de la guía; uso, sin dato hasta que haya instrumentación |
| G-2 | Las cuentas objetivo tienen cubierto el comité de compra | Cuentas objetivo con al menos un Decisor y con todos los cargos del ICP mapeados, sobre el total de cuentas objetivo | sin dato **[Por verificar: consulta de solo lectura antes de construir]** | Base de datos: `accounts`, `stakeholders`, `icp_profiles` |
| G-3 | El founder escribe a los stakeholders desde NOKKO | Stakeholders con primer contacto registrado por semana | sin dato (no se registra hoy) | Base de datos tras la entrega |
| G-4 | Nadie se queda sin seguimiento | Stakeholders contactados sin respuesta a los que no se les hizo el toque del día 3, 7 o 14 en su fecha | sin dato | Base de datos tras la entrega |
| G-5 | Ningún mensaje sale sin el founder | Mensajes enviados automáticamente | 0 por diseño | Prueba automática |

Nunca hay línea base estimada.

## 5. No-objetivos
- Configurar la estrategia, el precio, el producto, los objetivos u OKR y el plan de acciones: es de GTM Lab (SDD 3 a 7) y del control tower 1a.
- Enviar emails o mensajes de LinkedIn desde NOKKO. Solo borradores para copiar.
- Leer perfiles o publicaciones de LinkedIn por extracción automática. La investigación actual que lo hace (Apify) se retira en su ticket propio (U-0 del control tower) y aquí no se amplía.
- Puntuar o valorar personas.
- Convertir stakeholders en leads o mezclarlos en el embudo de leads.
- Bandeja de respuestas: que NOKKO detecte solo que alguien ha contestado.
- Abrir NOKKO a empresas fuera de Fede y su equipo (línea roja de GTM Lab 0004).

## 6. Decisiones tomadas y abiertas
| Tema | Decisión | Quién y cuándo |
|---|---|---|
| Alcance | Solo ejecución: cuentas, stakeholders, qué decir y seguimiento. La configuración y el plan quedan para GTM Lab | Fede, 2026-11-06 |
| Documentos | PRD corto más SDD, los dos en Borrador y aprobados juntos | Fede, 2026-11-06 |
| Seguimiento | Secuencia propia del stakeholder, fuera del embudo de leads | Fede, 2026-11-06 |
| Comité de compra | Sale de los cargos y niveles del ICP. Cuando se redacte GTM Lab SDD 7 se enmienda su Anexo A para publicar el «grupo de compra», y a partir de entonces sale de ahí. La enmienda DEBE publicarlo en `icp_profiles.target_titles` y `seniorities`, y la decisión A-6 de GTM Lab no vacía esas columnas hasta entonces (nota cruzada en el PRD de GTM Lab, en otro PR) | Fede, 2026-11-06 |
| Calendario | Se construye antes de la salida de Lovable A, detrás de NK-0051, porque solo toca tablas versionadas | Fede, 2026-11-06 |
| Pasos de la secuencia | Los mismos días 3, 7 y 14 que en leads, con una sola regla | Fede, 2026-11-06 |
| Umbral de la guía | Menos de 5 cuentas objetivo (propuesta sin dato; se revisa con uso real) | Fede, 2026-11-06 |
| Guía y tablero de GTM Lab | La guía sale de los datos; el tablero de GTM Lab enlazará a ella | Fede, 2026-11-06 |

## 7. Riesgos y dependencias
- **Valor:** apuesta sin datos de uso. Si nadie registra contactos en NOKKO, la guía no tiene con qué trabajar (ver criterio de descarte).
- **Usabilidad:** registrar a mano «contactado» y «respondió» es fricción. Sin bandeja de respuestas, la secuencia depende de que el founder lo marque.
- **Negocio y cumplimiento:** solo borradores. Nada de LinkedIn por extracción. La investigación del stakeholder sigue usando Apify hasta que se cierre U-0: el borrador no debe usar como hecho nada que venga de ahí sin marcarlo.
- **Solape con GTM Lab:** su tablero (SDD 6) tendrá tareas de prospección. Decidido (§6): la guía sale de los datos y el tablero enlaza a ella.
- **Solape con Plays:** el play `multi-thread-inbound-leads` (Plays SDD 7) también propone a quién más contactar en una cuenta. Debe reutilizar la misma regla de cobertura del comité.
- **Migraciones con reserva a mano y en conflicto:** hay dos `0077` en ramas abiertas y dos `0074` en ramas locales, y la `0078` está reservada en el plan maestro. El ledger no reserva números: esta usa la 0079 o posterior, asignada al fusionar y comprobada contra todas las ramas.
- **LinkedIn:** la investigación del stakeholder incluye publicaciones obtenidas por Apify. El borrador de mensaje no debe usarlas.
- **Sin instrumentación:** G-1 solo se puede verificar por prueba, no por uso real.

## 8. Orden de entrega (solo iniciativas)
No aplica: es una sola Feature. Las unidades de trabajo están en el SDD.

## 9. Aprobación
- [x] Fede aprueba el PRD (primer GO de dirección), con las recomendaciones de §15 del SDD. Fecha: 2026-11-06
- Al aprobar, el Estado pasa a «Aprobado» y el SDD hereda las secciones 2 a 5.

### Criterio de descarte
- **Antes de construir:** si GTM Lab SDD 6 (tablero) se adelanta y su catálogo ya cubre «mapear comité, primer contacto y seguimiento» como tareas, se descarta la guía (H-1 del SDD) y solo se construyen el comité, los borradores y la secuencia.
- **Después de entregar:** si en las 4 semanas siguientes Fede y su equipo no registran ningún primer contacto con un stakeholder desde NOKKO, se para y se revisa antes de construir nada más encima.

### Alternativas consideradas
- **No construir:** el founder usa el agente para cada paso («busca personas de X», «redacta un mensaje para Y»). Se descarta: el agente no recuerda volver a escribir, y el founder sigue teniendo que saber qué pedir.
- **Convertir cada stakeholder contactado en lead:** reutiliza toda la secuencia sin construir nada nuevo. Se descarta (decisión de Fede): mezcla el outbound a cuentas con el embudo de entrada y distorsiona la conversión por origen.
- **Esperar a GTM Lab:** su tablero tendría estas tareas. Se descarta como única vía: llega después de la salida de Lovable y no cubre el estado de contacto de cada persona.

### Pendiente de verificar
- Línea base de G-2: cuántas cuentas objetivo hay hoy con stakeholders y con Decisor. Lo comprueba una consulta de solo lectura en producción.
- Número de migración libre. Lo comprueba quien implemente al fusionar la migración, contra `drizzle/migrations` y todas las ramas tras `git fetch`.
